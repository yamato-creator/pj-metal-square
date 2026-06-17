"""
取引可能時間判定ユーティリティ。

業務要件: JST 10:00:00 - 翌 00:00:00 のみ取引可能。01:00:00-09:59:59 は制限。
時間制限の判定はサーバー側で必ず行う（フロントだけだとAPI直叩きで突破可能）。
"""
from fastapi import HTTPException

from .time import now_jst


def is_within_business_hours() -> bool:
    """JST の現在時刻が取引可能時間内かを返す。"""
    jst = now_jst()
    hour = jst.hour
    minute = jst.minute
    second = jst.second

    # 10:00:00 以降 24:00:00 まで → 許可
    if hour >= 10:
        return True
    # 00:00:00 ちょうどは許可（24:00:00 と同義）
    if hour == 0 and minute == 0 and second == 0:
        return True
    # それ以外（00:00:01-09:59:59）は制限
    return False


def require_business_hours() -> None:
    """取引可能時間外なら HTTP 403 を投げる。Depends で使う想定。"""
    if not is_within_business_hours():
        raise HTTPException(
            status_code=403,
            detail="現在は取引可能時間外です（JST 10:00:00 - 24:00:00 のみ受付）",
        )
