from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from .api.utils.rate_limit_key import get_real_ip
from .api.routes import auth_routes, user_routes, metal_routes, transaction_routes, time_restriction_routes
import logging
import os

# ロギングの設定
logging.basicConfig(
    level=logging.ERROR,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

# レート制限（slowapi）。デフォルトは緩め、認証系は各ルートで個別に厳しく付与する。
limiter = Limiter(key_func=get_real_ip, default_limits=["120/minute"])

# FastAPIアプリケーションの初期化
app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# 環境変数からCORSの許可オリジンを取得（カンマ区切りの文字列を想定）
# デフォルトはローカル開発用
origins = os.environ.get("CORS_ORIGINS", "http://localhost:3000,https://preciousmetalmine.com,https://www.preciousmetalmine.com,https://api.preciousmetalmine.com").split(",")
logger.info(f"CORS origins: {origins}")

# CORSミドルウェアの設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# ルーターの登録
app.include_router(auth_routes.router, prefix="/api/users", tags=["auth"])
app.include_router(user_routes.router, prefix="/api/users", tags=["users"])
app.include_router(metal_routes.router, prefix="/api", tags=["metals"])
app.include_router(transaction_routes.router, prefix="/api/transactions", tags=["transactions"])
app.include_router(time_restriction_routes.router, prefix="/api", tags=["time-restriction"])


@app.get("/api/healthz", tags=["health"])
async def healthz():
    """Render の死活監視 / uptime チェック用。認証不要・依存ゼロ・常に 200。"""
    from .api.utils.time import jst_str
    return {"status": "ok", "now_jst": jst_str()}


if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.getenv("PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)