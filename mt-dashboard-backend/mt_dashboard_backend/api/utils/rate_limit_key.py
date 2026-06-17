"""
slowapi 用のクライアント識別キー関数。

Render / Vercel / CloudFlare 等のプロキシ越しでは `request.client.host` が
ロードバランサの内部 IP になり全リクエストが同一視され、レート制限が事実上
チーム全員で共有されてしまう（誰か一人が 10/min に達したら全員 429）。

`X-Forwarded-For` ヘッダの先頭エントリ（最も外側のクライアント IP）を採用し、
プロキシ越しでも正しくユーザー単位でレート制限を効かせる。
"""
from slowapi.util import get_remote_address


def get_real_ip(request) -> str:
    """X-Forwarded-For 先頭 → fallback で request.client.host。"""
    xff = (request.headers.get("x-forwarded-for") or "").strip()
    if xff:
        # "client, proxy1, proxy2" の先頭が本来のクライアント IP
        return xff.split(",")[0].strip()
    return get_remote_address(request)
