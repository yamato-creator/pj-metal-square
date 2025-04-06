from fastapi import APIRouter, HTTPException
import logging
import uuid
from typing import Dict
from ...models.user import UserRegister, UserLogin
from ...services.user_service import UserService
from ..utils.email import EmailSender

# ルーターの設定
router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/register")
async def register_user(user: UserRegister):
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
async def login_user(user: UserLogin):
    """
    ユーザーログイン
    """
    try:
        logger.info(f"ログインリクエスト受信: {user.email}")
        user_service = UserService()
        
        # メールアドレスでユーザーを検索
        user_data = user_service.get_user_by_email(user.email)
        
        if not user_data:
            logger.warning(f"ログイン失敗: {user.email}")
            raise HTTPException(
                status_code=401,
                detail="メールアドレスまたはパスワードが間違っています"
            )

        # 退会済みチェック
        if user_data['is_deleted']:
            raise HTTPException(
                status_code=401,
                detail="このアカウントは退会済みです"
            )

        # パスワード検証
        if user_data['password'].strip() != user.password.strip():
            raise HTTPException(
                status_code=401,
                detail="メールアドレスまたはパスワードが間違っています"
            )

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
