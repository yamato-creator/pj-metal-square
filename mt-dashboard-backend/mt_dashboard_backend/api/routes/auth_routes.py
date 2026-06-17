from fastapi import APIRouter, HTTPException, Request
import logging
import uuid
from typing import Dict
from slowapi import Limiter
from ...models.user import UserRegister, UserLogin
from ...services.user_service import UserService
from ..utils.email import EmailSender
from ..utils.password import verify_password, hash_password, needs_rehash
from ..utils.rate_limit_key import get_real_ip

# ブルートフォース対策：登録・ログインは IP あたり 5回/分 まで
# X-Forwarded-For を見ることで Render/Vercel 越しでも個別 IP で制限する
limiter = Limiter(key_func=get_real_ip)

# ルーターの設定
router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/register")
@limiter.limit("5/minute")
async def register_user(request: Request, user: UserRegister):
    """
    新規ユーザー登録
    """
    try:
        logger.info(f"ユーザー登録リクエスト受信: {user.email}")
        user_service = UserService()
        email_sender = EmailSender()

        # メールアドレスの重複チェック
        if user_service.check_email_exists(user.email):
            logger.warning(f"メールアドレス重複: {user.email}")
            raise HTTPException(
                status_code=409,
                detail="このメールアドレスは既に登録されています"
            )

        # APIキーの生成
        api_key = str(uuid.uuid4())
        
        # ユーザーの作成
        created_user = user_service.create_user(
            email=user.email,
            password=user.password,
            api_key=api_key
        )

        if not created_user:
            logger.error("ユーザー作成失敗")
            raise HTTPException(
                status_code=500,
                detail="ユーザー登録に失敗しました"
            )

        # メール送信
        try:
            await email_sender.send_user_registration_email(
                user_email=created_user['email'],
                username=created_user['user_name'],
                created_at=created_user['registered_at']
            )
        except Exception as e:
            logger.error(f"メール送信エラー: {str(e)}")
            # メール送信エラーは非クリティカルとして扱う

        return {
            "status": "success",
            "data": {
                "user_id": created_user['user_id'],
                "user_name": created_user['user_name'],
                "email": created_user['email'],
                "created_at": created_user['registered_at'],
                "api_key": api_key
            }
        }

    except ValueError as ve:
        logger.warning(f"バリデーションエラー: {str(ve)}")
        raise HTTPException(status_code=400, detail=str(ve))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"予期せぬエラー: {str(e)}")
        raise HTTPException(status_code=500, detail="ユーザー登録に失敗しました")

@router.post("/login")
@limiter.limit("10/minute")
async def login_user(request: Request, user: UserLogin):
    """
    ユーザーログイン
    """
    try:
        logger.info(f"ログインリクエスト受信: {user.user_id}")
        user_service = UserService()
        
        # ユーザーIDでユーザーを検索
        user_data = user_service.fetch_user_by_id(user.user_id)
        
        if not user_data:
            logger.warning(f"ログイン失敗: {user.user_id}")
            raise HTTPException(
                status_code=401,
                detail="ユーザーIDまたはパスワードが間違っています"
            )

        # 退会済みチェック
        if user_data['is_deleted']:
            raise HTTPException(
                status_code=401,
                detail="このアカウントは退会済みです"
            )

        # パスワード検証（bcrypt と平文の両対応）。
        # 既存ユーザーは平文保管のため、verify_password で平文一致 → 自動でハッシュ化に移行。
        stored_password = user_service.fetch_password_hash(user.user_id)
        if not verify_password(user.password, stored_password):
            raise HTTPException(
                status_code=401,
                detail="ユーザーIDまたはパスワードが間違っています"
            )

        # 平文保管だった場合は即座にハッシュ化して保存（移行マイグレ）。
        if needs_rehash(stored_password):
            try:
                new_hash = hash_password(user.password)
                user_service.update_user_password_hash(user.user_id, new_hash)
                logger.info(f"パスワードを bcrypt 化（ログイン契機の自動マイグレ）: {user.user_id}")
            except Exception as mig_err:
                # マイグレーション失敗はログインを止めない（次回ログインで再試行）
                logger.warning(f"パスワードハッシュ移行に失敗: {mig_err}")

        logger.info(f"ログイン成功: {user_data['user_id']}")
        return {
            "status": "success",
            "data": {
                "user": {
                    "user_id": user_data['user_id'],
                    "user_name": user_data['user_name'],
                    "email": user_data['email'],
                    "api_key": user_data['api_key']
                }
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"ログイン処理エラー: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="ログイン処理中にエラーが発生しました"
        )
