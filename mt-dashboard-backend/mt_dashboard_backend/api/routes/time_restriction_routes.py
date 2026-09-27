from fastapi import APIRouter
import os

from ...services.settings_service import SettingsService
from ..utils.time import now_jst

# ルーターの設定
router = APIRouter()


@router.get("/check-access-time")
async def check_access_time():
    """アプリ全体のアクセス可否を返す。

    2026/09/26 星さん要望（見積もり②）:
      ・従来の「JST 10:00〜24:00 のみアクセス可」を撤廃し、24時間ログイン/閲覧可にする
      ・代わりに、スプレッドシート「settings」シートのメンテナンスフラグ（B2=ON/OFF）で
        「メンテナンス中」画面を管理者側から即時に出し分ける（反映は最大約1分）
      ・取引の時間制限はここでは判定しない（売却=相場更新後〜12:30/15:30、
        預入/返却/取消=10:00〜24:00 を各エンドポイントで判定）

    レスポンス形はフロント（TimeRestrictedApp）互換のまま。
    """
    svc = SettingsService()
    maintenance = svc.is_maintenance()
    message = svc.maintenance_message() if maintenance else "アクセス可能"

    jst = now_jst()
    return {
        "is_allowed": not maintenance,
        "maintenance": maintenance,
        "current_time": jst.isoformat(),
        "current_hour": jst.hour,
        "current_minute": jst.minute,
        "current_second": jst.second,
        "allowed_hours": "24時間（メンテナンス中を除く）",
        "restricted_hours": "メンテナンス中のみ",
        "message": message,
        "environment": os.environ.get("ENVIRONMENT", "production"),
    }
