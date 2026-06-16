from typing import Dict, Optional
import logging
import pandas as pd
from datetime import datetime
from .base.sheets_base import SheetsBase
from ..api.utils.password import hash_password
from ..api.utils.time import jst_str, jst_compact

class UserService(SheetsBase):
    """
    ユーザー関連の操作を担当するサービス
    認証、ユーザー情報の取得、更新などを処理
    """
    def fetch_user_by_id(self, user_id: str, include_password: bool = False) -> Optional[Dict]:
        """ユーザーIDからユーザー情報を取得。

        include_password=False の場合は password を戻り値から除外する（既定）。
        password が必要なのは login / change-password / verify-password 等の認証経路のみ。
        """
        try:
            sheet_data = self._get_sheet_data('users!A:H')
            if not sheet_data:
                return None

            headers = ['user_id', 'user_name', 'email', 'password',
                      'registered_at', 'api_key', 'is_deleted', 'deleted_at']

            for row in sheet_data[1:]:
                if row[0] == user_id:
                    user_dict = dict(zip(headers, row))
                    # is_deletedをブール値に変換
                    user_dict['is_deleted'] = str(user_dict.get('is_deleted', '')).strip().lower() == 'true'
                    if not include_password:
                        user_dict.pop('password', None)
                    return user_dict

            return None

        except Exception as e:
            logging.error(f"ユーザー情報取得エラー: {str(e)}")
            return None

    def get_user_by_email(self, email: str) -> Optional[Dict]:
        """メールアドレスからユーザー情報を取得"""
        try:
            sheet_data = self._get_sheet_data('users!A:H')
            if not sheet_data:
                return None

            # 同じメールアドレスのアカウントが複数ある場合、最新のものを使用
            matching_user = None
            for row in sheet_data[1:]:
                if len(row) >= 7 and row[2].strip() == email.strip():
                    matching_user = {
                        'user_id': row[0],
                        'user_name': row[1],
                        'email': row[2],
                        'password': row[3],
                        'registered_at': row[4],
                        'api_key': row[5],
                        'is_deleted': row[6] if isinstance(row[6], bool) else str(row[6]).strip().lower() == 'true',
                        'deleted_at': row[7] if len(row) > 7 else ""
                    }

            if not matching_user:
                return None

            return matching_user

        except Exception as e:
            logging.error(f"ユーザー情報取得エラー: {str(e)}")
            return None

    def check_email_exists(self, email: str) -> bool:
        """メールアドレスの重複をチェック（退会済みアカウントは除く）"""
        try:
            sheet_data = self._get_sheet_data('users!A:H')
            
            if not sheet_data or len(sheet_data) <= 1:
                return False

            for row in sheet_data[1:]:
                if len(row) >= 7 and row[2].strip() == email.strip():
                    is_deleted = row[6] if isinstance(row[6], bool) else str(row[6]).strip().lower() == 'true'
                    if not is_deleted:
                        return True

            return False

        except Exception as e:
            logging.error(f"メールアドレス重複チェックエラー: {str(e)}")
            return False

    def create_user(self, email: str, password: str, api_key: str) -> Optional[Dict]:
        """新規ユーザーを作成（パスワードは bcrypt で保管）。"""
        try:
            # ユーザーIDの生成（USER + タイムスタンプ）
            user_id = f"USER{jst_compact()}"

            # ユーザー名の生成（メールアドレスの@前）
            username = email.split('@')[0]

            # 現在時刻
            current_time = jst_str()

            # パスワードを bcrypt でハッシュ化して保管
            hashed = hash_password(password)

            # 新規ユーザーデータ
            user_data = [[
                user_id,        # ユーザーID
                username,       # ユーザー名
                email,         # メールアドレス
                hashed,        # パスワード(bcryptハッシュ)
                current_time,  # 登録日時
                api_key,       # APIキー
                False,         # is_deleted
                ""            # deleted_at
            ]]

            if not self.append_data('users', 'A:H', user_data):
                logging.error("ユーザーデータの追加に失敗")
                return None

            # 戻り値にはハッシュ済みパスワードを含めない（呼び出し側でレスポンスにそのまま返す危険を避ける）
            created_user = {
                'user_id': user_id,
                'user_name': username,
                'email': email,
                'registered_at': current_time,
                'api_key': api_key,
                'is_deleted': False,
                'deleted_at': ""
            }

            return created_user

        except Exception as e:
            logging.error(f"ユーザー作成エラー: {str(e)}")
            return None

    def update_user_password(self, user_id: str, new_password: str) -> bool:
        """ユーザーのパスワードを更新（bcrypt ハッシュで保管）。"""
        try:
            sheet_data = self._get_sheet_data('users!A:D')
            if not sheet_data:
                return False

            hashed = hash_password(new_password)

            for i, row in enumerate(sheet_data[1:], start=2):
                if row[0] == user_id:
                    return self.update_data(f"users!D{i}", [[hashed]])
            return False

        except Exception as e:
            logging.error(f"パスワード更新エラー: {str(e)}")
            return False

    def update_user_password_hash(self, user_id: str, hashed_password: str) -> bool:
        """既にハッシュ化済みのパスワードをそのまま保存する（移行マイグレ用）。"""
        try:
            sheet_data = self._get_sheet_data('users!A:D')
            if not sheet_data:
                return False
            for i, row in enumerate(sheet_data[1:], start=2):
                if row[0] == user_id:
                    return self.update_data(f"users!D{i}", [[hashed_password]])
            return False
        except Exception as e:
            logging.error(f"パスワードハッシュ移行エラー: {str(e)}")
            return False

    def fetch_password_hash(self, user_id: str) -> Optional[str]:
        """ユーザーIDに対応する保管パスワード（ハッシュ or 平文）を取得する。"""
        try:
            sheet_data = self._get_sheet_data('users!A:D')
            if not sheet_data:
                return None
            for row in sheet_data[1:]:
                if row and row[0] == user_id:
                    return row[3] if len(row) > 3 else None
            return None
        except Exception as e:
            logging.error(f"パスワード取得エラー: {str(e)}")
            return None

    def update_user_email(self, user_id: str, new_email: str) -> bool:
        """ユーザーのメールアドレスとユーザー名を更新"""
        try:
            sheet_data = self._get_sheet_data('users!A:D')
            if not sheet_data:
                return False
                
            # メールアドレスから新しいユーザー名を生成（@の前の部分）
            new_user_name = new_email.split('@')[0]
            
            for i, row in enumerate(sheet_data[1:], start=2):
                if row[0] == user_id:
                    # メールアドレス（C列）とユーザー名（B列）を更新
                    self.update_data(f"users!C{i}", [[new_email]])
                    return self.update_data(f"users!B{i}", [[new_user_name]])
            return False

        except Exception as e:
            logging.error(f"メールアドレス更新エラー: {str(e)}")
            return False

    def deactivate_user(self, user_id: str) -> bool:
        """ユーザーアカウントを論理削除"""
        try:
            # ユーザー情報を取得
            users_data = self._get_sheet_data('users!A:H')
            if not users_data:
                logging.error("ユーザーデータの取得に失敗")
                return False
                
            # ユーザーIDの列のインデックスを検索
            user_row_idx = None
            for idx, row in enumerate(users_data):
                if row[0] == user_id:
                    user_row_idx = idx + 1
                    break
                    
            if user_row_idx is None:
                logging.error(f"ユーザーが見つかりません: {user_id}")
                return False
                
            current_time = jst_str()
            
            # is_deletedとdeleted_atを更新
            update_range = f'users!G{user_row_idx}:H{user_row_idx}'
            result = self.update_data(update_range, [[True, current_time]])
            
            if not result:
                logging.error("ユーザーの退会処理に失敗")
                return False
                
            return True
            
        except Exception as e:
            logging.error(f"ユーザー退会処理エラー: {str(e)}")
            return False
