from fastapi import APIRouter, HTTPException, Depends, Body
import logging
import pandas as pd
from typing import Dict
from ...models.user import PasswordChange, EmailChange
from ...services.user_service import UserService
from ..utils.auth import verify_api_key
from ..utils.email import EmailSender
from ..utils.password import verify_password
from ..utils.time import jst_str

# ルーターの設定
router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/{user_id}")
async def get_user(
    user_id: str,
    current_user: dict = Depends(verify_api_key)
):
    """ユーザー情報の取得（自身のみ）。"""
    # 認可：他のユーザーの情報は取得不可
    if current_user.get('user_id') != user_id:
        raise HTTPException(
            status_code=403,
            detail="他のユーザーの情報は取得できません"
        )
    try:
        user_service = UserService()
        # password を含めずに取得（include_password=False がデフォルト）
        user = user_service.fetch_user_by_id(user_id)

        if not user:
            raise HTTPException(
                status_code=404,
                detail=f"ユーザーID {user_id} が見つかりません"
            )

        return {
            "status": "success",
            "data": user
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"ユーザー情報取得エラー: {e}")
        # クライアントには内部詳細を返さない
        raise HTTPException(
            status_code=500,
            detail="ユーザー情報の取得に失敗しました"
        )

@router.post("/change-password")
async def change_password(
    password_data: PasswordChange,
    current_user: dict = Depends(verify_api_key)
):
    """パスワードの変更（自身のみ）。"""
    # 認可：他のユーザーのパスワードは変更不可
    if current_user.get('user_id') != password_data.user_id:
        raise HTTPException(
            status_code=403,
            detail="他のユーザーのパスワードは変更できません"
        )
    try:
        user_service = UserService()
        email_sender = EmailSender()

        # 現在のパスワードを Sheets から取得して検証（bcrypt / 平文両対応）
        stored = user_service.fetch_password_hash(password_data.user_id)
        if not verify_password(password_data.old_password, stored):
            raise HTTPException(
                status_code=401,
                detail="現在のパスワードが正しくありません"
            )

        # 新旧同一は拒否
        if password_data.old_password == password_data.new_password:
            raise HTTPException(
                status_code=400,
                detail="新しいパスワードは現在のパスワードと異なるものを指定してください"
            )

        # 新パスワードをハッシュ化して保存
        success = user_service.update_user_password(
            password_data.user_id,
            password_data.new_password
        )

        if not success:
            raise HTTPException(
                status_code=500,
                detail="パスワードの更新に失敗しました"
            )

        # メール送信
        try:
            await email_sender.send_password_change_email(
                user_email=current_user["email"],
                change_datetime=jst_str()
            )
        except Exception as e:
            logger.error(f"メール送信エラー: {e}")
            # メール送信エラーは非クリティカルとして扱う

        return {
            "status": "success",
            "message": "パスワードを更新しました"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"パスワード更新エラー: {e}")
        raise HTTPException(
            status_code=500,
            detail="パスワード更新中にエラーが発生しました"
        )

@router.post("/verify-password")
async def verify_password_endpoint(
    password_data: dict = Body(...),
    current_user: dict = Depends(verify_api_key)
):
    """パスワードの検証（退会や決済前などの再認証用途）。"""
    try:
        submitted = password_data.get('password') if isinstance(password_data, dict) else None
        if not submitted:
            raise HTTPException(status_code=400, detail="パスワードを入力してください")

        user_service = UserService()
        stored = user_service.fetch_password_hash(current_user['user_id'])
        if not verify_password(submitted, stored):
            raise HTTPException(
                status_code=401,
                detail="パスワードが正しくありません"
            )

        return {"status": "success", "message": "パスワード検証成功"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"パスワード検証エラー: {e}")
        raise HTTPException(
            status_code=500,
            detail="パスワード検証中にエラーが発生しました"
        )

@router.post("/change-email")
async def change_email(
    email_data: EmailChange,
    current_user: dict = Depends(verify_api_key)
):
    """メールアドレスの変更（自身のみ）。"""
    # 認可：他のユーザーのメールは変更不可
    if current_user.get('user_id') != email_data.user_id:
        raise HTTPException(
            status_code=403,
            detail="他のユーザーのメールアドレスは変更できません"
        )
    try:
        user_service = UserService()
        email_sender = EmailSender()

        # メールアドレスの重複チェック
        if user_service.check_email_exists(email_data.new_email):
            raise HTTPException(
                status_code=409,
                detail="このメールアドレスは既に使用されています"
            )

        # メールアドレスを更新
        success = user_service.update_user_email(
            email_data.user_id,
            email_data.new_email
        )

        if not success:
            raise HTTPException(
                status_code=500,
                detail="メールアドレスの更新に失敗しました"
            )

        # メール送信
        try:
            await email_sender.send_email_change_notification(
                old_email=current_user["email"],
                new_email=email_data.new_email,
                user_id=current_user["user_id"],
                change_datetime=jst_str()
            )
        except Exception as e:
            logger.error(f"メール送信エラー: {e}")
            # メール送信エラーは非クリティカルとして扱う

        return {
            "status": "success",
            "message": "メールアドレスを更新しました"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"メールアドレス更新エラー: {e}")
        raise HTTPException(
            status_code=500,
            detail="メールアドレス更新中にエラーが発生しました"
        )

@router.post("/deactivate")
async def deactivate_user(
    current_user: dict = Depends(verify_api_key)
):
    """ユーザーアカウントの退会処理。"""
    try:
        user_service = UserService()
        email_sender = EmailSender()

        # ユーザーの退会処理
        if not user_service.deactivate_user(current_user['user_id']):
            logger.error("ユーザー退会処理失敗")
            raise HTTPException(
                status_code=500,
                detail="退会処理に失敗しました"
            )

        # 退会完了メールの送信
        try:
            await email_sender.send_deactivation_email(
                user_email=current_user['email'],
                deactivation_datetime=jst_str()
            )
        except Exception as e:
            logger.error(f"退会完了メール送信エラー: {e}")
            # メール送信エラーは非クリティカルとして扱う

        return {"status": "success", "message": "退会処理が完了しました"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"退会処理エラー: {e}")
        raise HTTPException(
            status_code=500,
            detail="退会処理中にエラーが発生しました"
        )
