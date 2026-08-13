from typing import Dict, List, Optional
import logging
import pandas as pd
from .base.sheets_base import SheetsBase
from ..api.utils.time import jst_str

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
                if row[0] == user_id:
                    is_deleted = row[6] if len(row) > 6 else False
                    if isinstance(is_deleted, str):
                        is_deleted = is_deleted.strip().lower() == 'true'
                    user_is_deleted = is_deleted
                    break

            if user_is_deleted:
                return None

            # 退会していない場合のみ資産情報を取得
            values = self._get_sheet_data('assets!A:E')
            
            if not values:
                return []
            
            headers = ['asset_id', 'user_id', 'metal_type', 'weight_g', 'updated_at']
            assets = []
            for row in values[1:]:
                if row[1] == user_id:
                    asset_dict = dict(zip(headers, row))
                    assets.append(asset_dict)
            
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
            values = self._get_sheet_data('assets!A:E')
            
            if not values:
                logging.error("資産データの取得に失敗")
                return False
            
            # 該当する資産の行を探す
            target_row_idx = None
            for idx, row in enumerate(values[1:], start=2):
                if row[1] == user_id and row[2] == metal_type:
                    target_row_idx = idx
                    break
            
            if target_row_idx is None:
                logging.error("資産が見つかりません")
                return False
            
            # 保有量と更新日時を更新
            result = self.update_data(
                f'assets!D{target_row_idx}:E{target_row_idx}',
                [[str(new_amount), current_time]]
            )
            
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
            asset_values (List): 資産データ
                [asset_id, user_id, metal_type, weight_g, updated_at]
                
        Returns:
            bool: 作成成功時True、失敗時False
        """
        try:
            # append API はシート右側の集計表（G2:H7）も「使用中の範囲」とみなすため、
            # データが少ないと集計表の下（8行目〜）に書かれて2〜7行が空いてしまう。
            # A列だけを見て最初の空き行を求め、明示的にその行へ書き込む。
            col_a = self._get_sheet_data('assets!A:A')
            next_row = len(col_a) + 1
            for i, row in enumerate(col_a[1:], start=2):
                if not row or not str(row[0]).strip():
                    next_row = i
                    break
            result = self.update_data(f'assets!A{next_row}:E{next_row}', [asset_values])
            return bool(result)

        except Exception as e:
            logging.error(f"資産作成エラー: {str(e)}")
            return False
