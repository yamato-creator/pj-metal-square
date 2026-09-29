"""
取引可能時間判定ユーティリティ。

業務要件: JST 10:00:00 - 翌 00:00:00 のみ取引可能。01:00:00-09:59:59 は制限。
時間制限の判定はサーバー側で必ず行う（フロントだけだとAPI直叩きで突破可能）。
"""
from datetime import datetime, time as _dtime

from fastapi import HTTPException

from .time import JST, now_jst


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
    """取引可能時間外なら HTTP 403 を投げる。Depends で使う想定（預入/現物返却/取消）。

    2026/09/29 受け入れ検証で判明: 売却は相場更新後（例 09:53）に開くが、取消/預入/返却は
    10:00 固定開始のため、09:53〜10:00 の数分間「売れるが取消せない」状態が生じていた。
    → 売却ウィンドウが開いている間は、こちらも許可する（10:00〜24:00 の従来ルールは維持）。
    """
    if not (is_within_business_hours() or is_sale_allowed_now()):
        raise HTTPException(
            status_code=403,
            detail="現在は取引可能時間外です（JST 10:00:00 - 24:00:00 のみ受付）",
        )


# --- 売却専用の時間ゲート（2026/09/16 星さん要望） ---------------------------
# 売却は「相場が更新された後」〜締め時刻（午前12:30 / 午後15:30）のみ可能とする。
# 更新前の古い価格での売却を防ぐため、価格更新時刻（metal-prices!E2）を基準にする。
# 田中貴金属は基本 9:57ごろ(午前) と 14:27ごろ(午後) の1日2回更新。
_SALE_AM_CLOSE = _dtime(12, 30)   # 午前の締め
_SALE_PM_CLOSE = _dtime(15, 30)   # 午後の締め
_SALE_PM_UPDATE_FROM_HOUR = 13    # 13時以降の相場更新を「午後」として扱う


def is_sale_allowed_now() -> bool:
    """相場更新後〜締め時刻の売却可能ウィンドウ内かを返す（JST）。

    仕様: 午前＝相場更新後〜12:30 / 午後＝相場更新後〜15:30。
    更新時刻が取れない・当日でない・更新前・締め超過は不可（安全側）。
    """
    # 遅延 import（util層からservice層への循環参照を避ける）
    from ...services.metal_service import MetalService
    try:
        raw = (MetalService().fetch_price_update_time() or "").strip()
        update_dt = datetime.strptime(raw, "%Y-%m-%d %H:%M:%S").replace(tzinfo=JST)
    except Exception:
        # 更新時刻が取得できない/形式不明 → 安全側（売却不可）
        return False

    now = now_jst()
    # 当日更新でなければ不可（前日の価格のまま売らせない）
    if update_dt.date() != now.date():
        return False
    # 相場更新前は不可
    if now < update_dt:
        return False
    # 午前更新なら12:30まで、午後更新なら15:30まで
    close = _SALE_AM_CLOSE if update_dt.hour < _SALE_PM_UPDATE_FROM_HOUR else _SALE_PM_CLOSE
    return now.time() <= close


def require_sale_time() -> None:
    """売却可能ウィンドウ外なら HTTP 403 を投げる。/sale の Depends で使う。"""
    if not is_sale_allowed_now():
        raise HTTPException(
            status_code=403,
            detail="現在は売却できません（相場更新後〜午前12:30／午後15:30のみ受付）",
        )
