from fastapi import HTTPException, Security
from fastapi.security.api_key import APIKeyHeader
import logging
from typing import Dict
from ...services.user_service import UserService

# APIキーヘッダーの設定
API_KEY_HEADER = APIKeyHeader(name="X-API-Key")

async def verify_api_key(api_key: str = Security(API_KEY_HEADER)) -> Dict:
    """
    APIキーを検証し、ユーザー情報を返す
    
    Args:
        api_key (str): リクエストヘッダーから取得したAPIキー
        
    Returns:
        Dict: ユーザー情報
        
    Raises:
        HTTPException: 認証エラー時
    """
    try:
        user_service = UserService()
        users_data = user_service._get_sheet_data('users!A:H')
        
        for row in users_data[1:]:
            if len(row) >= 6 and row[5] == api_key:
                # is_deletedの確認
                is_deleted = row[6] if len(row) > 6 else False
                if isinstance(is_deleted, str):
                    is_deleted = is_deleted.strip().lower() == 'true'
                
                if not is_deleted:
                    # password はレスポンスに乗せると外部漏洩リスクがあるため除外する。
                    # 認証経路（login / verify-password / change-password）では
                    # UserService.fetch_password_hash() で必要時のみ取得する。
                    return {
                        "user_id": row[0],
                        "user_name": row[1],
                        "email": row[2],
                    }
                else:
                    # 退会済みユーザーの場合
                    raise HTTPException(
                        status_code=401,
                        detail="このアカウントは退会済みです"
                    )
        
        # APIキーが見つからない場合
        raise HTTPException(
            status_code=401,
            detail="無効なAPIキーです。再度ログインしてください。"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"APIキー検証中の予期せぬエラー: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="認証処理中にエラーが発生しました"
        )
