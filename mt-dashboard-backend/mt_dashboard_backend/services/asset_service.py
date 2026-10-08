from typing import Dict, List, Optional
import logging
from .base.sheets_base import SheetsBase
from ..api.utils.time import jst_str

# assets シートの論理項目（この順が従来の固定レイアウト A〜E）
ASSET_FIELDS = ['asset_id', 'user_id', 'metal_type', 'weight_g', 'updated_at']
# ヘッダーセルは表示形式 ;;;"資産ID" で日本語ラベルを見せている（中身は英語名）。
# Sheets API の既定（FORMATTED_VALUE）では日本語の方が返るので、両方を同じ項目として扱う。
ASSET_HEADER_ALIASES = {
    '資産ID': 'asset_id', 'ユーザーID': 'user_id', '貴金属': 'metal_type',
    '保有量(g)': 'weight_g', '更新日時': 'updated_at',
}
# ヘッダー行を含めて広めに読む（列が増減してもコード変更不要にする）
ASSETS_RANGE = 'assets!A:Z'
ASSETS_HEADER_RANGE = 'assets!A1:Z1'


def _col_letter(idx0: int) -> str:
    """0始まりの列番号 → A1形式の列文字（0→A, 25→Z, 26→AA）。"""
    s = ''
    n = idx0 + 1
    while n > 0:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s


def asset_columns(header_row) -> Dict[str, int]:
    """ヘッダー行から各項目の列番号（0始まり）を特定する。

    2026/10/09: 星さん要望で C列に「ユーザー名」を挿入するため、固定の列番号で
    読み書きするのをやめた。ヘッダーに見つからない項目は従来の固定位置にフォールバック
    するので、旧レイアウト（A〜E）でも新レイアウト（ユーザー名入り）でも同じコードで動く。
    """
    cols = {name: i for i, name in enumerate(ASSET_FIELDS)}
    for i, h in enumerate(header_row or []):
        key = str(h).strip()
        key = ASSET_HEADER_ALIASES.get(key, key)
        if key in cols:
            cols[key] = i
    return cols


def _row_to_asset(row: List, cols: Dict[str, int]) -> Dict:
    """1行を項目名→値の dict にする（短い行は空文字で埋める）。"""
    return {name: (row[idx] if idx < len(row) else '') for name, idx in cols.items()}


class AssetService(SheetsBase):
    """
    資産関連の操作を担当するサービス
    資産情報の取得、更新などを処理
    """
    def fetch_user_assets_with_validation(self, user_id: str) -> Optional[List[Dict]]:
        """
        ユーザーの資産情報を取得（退会確認付き）
        1. まずusersシートでis_deletedを確認
        2. 退会していない場合のみ資産情報を返す
        """
        try:
            # まずユーザーの退会状態を確認
            user_data = self._get_sheet_data('users!A:H')
            user_is_deleted = True

            for row in user_data[1:]:
                if row and row[0] == user_id:
                    is_deleted = row[6] if len(row) > 6 else False
                    if isinstance(is_deleted, str):
                        is_deleted = is_deleted.strip().lower() == 'true'
                    user_is_deleted = is_deleted
                    break

            if user_is_deleted:
                return None

            # 退会していない場合のみ資産情報を取得
            values = self._get_sheet_data(ASSETS_RANGE)

            if not values:
                return []

            cols = asset_columns(values[0])
            uid = cols['user_id']
            assets = []
            for row in values[1:]:
                # 空行が混ざると IndexError になり資産取得全体が失敗するため防御
                if len(row) > uid and row[uid] == user_id:
                    assets.append(_row_to_asset(row, cols))

            return assets

        except Exception as e:
            logging.error(f"資産情報取得エラー: {str(e)}")
            return None

    def update_asset_after_sale(self, user_id: str, metal_type: str, new_amount: float) -> bool:
        """
        売却後の資産情報を更新

        Args:
            user_id (str): ユーザーID
            metal_type (str): 金属種別
            new_amount (float): 更新後の保有量

        Returns:
            bool: 更新成功時True、失敗時False
        """
        try:
            current_time = jst_str()
            values = self._get_sheet_data(ASSETS_RANGE)

            if not values:
                logging.error("資産データの取得に失敗")
                return False

            cols = asset_columns(values[0])
            uid, mid = cols['user_id'], cols['metal_type']

            # 該当する資産の行を探す
            target_row_idx = None
            for idx, row in enumerate(values[1:], start=2):
                if len(row) > max(uid, mid) and row[uid] == user_id and row[mid] == metal_type:
                    target_row_idx = idx
                    break

            if target_row_idx is None:
                logging.error("資産が見つかりません")
                return False

            # 保有量と更新日時を更新（隣接していれば1回、離れていれば2回で書く）
            w, u = cols['weight_g'], cols['updated_at']
            if u == w + 1:
                result = self.update_data(
                    f'assets!{_col_letter(w)}{target_row_idx}:{_col_letter(u)}{target_row_idx}',
                    [[str(new_amount), current_time]]
                )
            else:
                r1 = self.update_data(f'assets!{_col_letter(w)}{target_row_idx}', [[str(new_amount)]])
                r2 = self.update_data(f'assets!{_col_letter(u)}{target_row_idx}', [[current_time]])
                result = r1 and r2

            if not result:
                logging.error("資産更新に失敗")
                return False

            return True

        except Exception as e:
            logging.error(f"資産更新エラー: {str(e)}")
            return False

    def create_asset(self, asset_values: List) -> bool:
        """
        新しい資産を作成

        Args:
            asset_values (List): 資産データ（ASSET_FIELDS の順）
                [asset_id, user_id, metal_type, weight_g, updated_at]

        Returns:
            bool: 作成成功時True、失敗時False
        """
        try:
            # ヘッダーを見て、各値を正しい列に置く。ユーザー名など計算列には '' を置く
            # （シート側の ARRAYFORMULA が表示するため、書かない）。
            header = self._get_sheet_data(ASSETS_HEADER_RANGE)
            header_row = header[0] if header else []
            cols = asset_columns(header_row)
            width = max(len(header_row), max(cols.values()) + 1)
            row = [''] * width
            for name, value in zip(ASSET_FIELDS, asset_values):
                row[cols[name]] = value

            # append API はシート右側の集計表も「使用中の範囲」とみなすため、
            # データが少ないと集計表の下に書かれて途中行が空いてしまう。
            # A列だけを見て最初の空き行を求め、明示的にその行へ書き込む。
            col_a = self._get_sheet_data('assets!A:A')
            next_row = len(col_a) + 1
            for i, r in enumerate(col_a[1:], start=2):
                if not r or not str(r[0]).strip():
                    next_row = i
                    break
            result = self.update_data(f'assets!A{next_row}:{_col_letter(width - 1)}{next_row}', [row])
            return bool(result)

        except Exception as e:
            logging.error(f"資産作成エラー: {str(e)}")
            return False
