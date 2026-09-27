"""画面制御（メンテナンスON/OFF）設定サービス。

2026/09/26 星さん要望（見積もり②・8万円）:
  ・アプリのアクセス時間制限（10:00〜24:00）を撤廃し、24時間ログイン/閲覧可にする
  ・その代わり、急なメンテが必要な時に管理者側（スプレッドシート）から
    「メンテナンス中」画面のON/OFFを切り替えられるようにする
  ・取引（売却/預入/返却/取消）の時間制限は各エンドポイント側で従来どおり判定する

設定はスプレッドシート「settings」シートから読む:
  A列=項目名 / B列=値
  B2: メンテナンス  … ON / OFF（ON でメンテナンス画面）
  B3: メンテナンス文言 … 画面に出す文章（空なら既定文）

反映はフロントの60秒ポーリング（TimeRestrictedApp）＝最大約1分で全画面に反映。
読めない/形式不明の場合は「メンテナンスではない」扱い（設定不備でサイトを止めない安全側）。
"""
import logging

from .base.sheets_base import SheetsBase

SETTINGS_SHEET = "settings"
MAINT_FLAG_RANGE = f"'{SETTINGS_SHEET}'!B2:B2"
MAINT_MSG_RANGE = f"'{SETTINGS_SHEET}'!B3:B3"
DEFAULT_MAINT_MESSAGE = "ただいまメンテナンス中です。恐れ入りますが、しばらく時間をおいて再度アクセスしてください。"
_ON_VALUES = {"ON", "TRUE", "1", "メンテナンス中", "有効"}

logger = logging.getLogger(__name__)


def _first_cell(values) -> str:
    """values().get の戻り値から先頭セルを文字列で取り出す（空なら ""）。"""
    try:
        if values and values[0]:
            return str(values[0][0])
    except Exception:
        pass
    return ""


class SettingsService(SheetsBase):
    """settings シートを読むだけの軽量サービス。"""

    def is_maintenance(self) -> bool:
        """メンテナンス中なら True。読めない場合は False（サイトは公開のまま）。"""
        try:
            raw = _first_cell(self._get_sheet_data(MAINT_FLAG_RANGE))
            return raw.strip().upper() in _ON_VALUES
        except Exception as e:
            logger.error(f"メンテナンスフラグ取得エラー: {e}")
            return False

    def maintenance_message(self) -> str:
        """メンテナンス画面に出す文言。未設定なら既定文。"""
        try:
            raw = _first_cell(self._get_sheet_data(MAINT_MSG_RANGE)).strip()
            return raw or DEFAULT_MAINT_MESSAGE
        except Exception as e:
            logger.error(f"メンテナンス文言取得エラー: {e}")
            return DEFAULT_MAINT_MESSAGE
