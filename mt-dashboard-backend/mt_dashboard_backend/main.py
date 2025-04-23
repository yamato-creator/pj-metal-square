from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api.routes import auth_routes, user_routes, metal_routes, transaction_routes
import logging
import os

# ロギングの設定
logging.basicConfig(
    level=logging.ERROR,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

# FastAPIアプリケーションの初期化
app = FastAPI()

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

if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.getenv("PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)