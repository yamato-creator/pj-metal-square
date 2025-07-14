from fastapi import APIRouter
from datetime import datetime, timezone, timedelta

# ルーターの設定
router = APIRouter()

@router.get("/check-access-time")
async def check_access_time():
    """
    現在時刻がアクセス許可時間内かをチェック
    許可時間: 10:00:00-24:00:00 (JST)
    制限時間: 00:00:01-09:59:59 (JST)
    UTC時刻から日本時刻を計算（本番環境では完全に独立）
    """
    # UTC時刻を取得してJST（UTC+9）に変換
    utc_now = datetime.now(timezone.utc)
    jst_now = utc_now + timedelta(hours=9)
    current_hour = jst_now.hour
    current_minute = jst_now.minute
    current_second = jst_now.second
    
    # 10:00:00-24:00:00の間かチェック（秒単位で正確）
    # 許可: 10:00:00以降 または 00:00:00ちょうど
    # 制限: 00:00:01-09:59:59
    
    if current_hour >= 10:
        # 10時以降は許可
        is_allowed = True
    elif current_hour == 0 and current_minute == 0 and current_second == 0:
        # 00:00:00ちょうど（24:00:00）は許可
        is_allowed = True
    elif current_hour >= 1 and current_hour <= 9:
        # 1時台-9時台は制限
        is_allowed = False
    elif current_hour == 0:
        # 0時台（但し00:00:00以外）は制限
        is_allowed = False
    else:
        # その他は許可（念のため）
        is_allowed = True
    
    return {
        "is_allowed": is_allowed,
        "current_time": jst_now.replace(tzinfo=timezone(timedelta(hours=9))).isoformat(),
        "current_hour": current_hour,
        "current_minute": current_minute,
        "current_second": current_second,
        "allowed_hours": "10:00:00-24:00:00 (JST)",
        "restricted_hours": "00:00:01-09:59:59 (JST)",
        "message": "アクセス可能" if is_allowed else "アクセス制限時間です",
        "environment": "production" if utc_now.hour != datetime.now().hour else "development"
    } 