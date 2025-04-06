from typing import Dict, Optional
import logging
import pandas as pd
from datetime import datetime
from .base.sheets_base import SheetsBase

class UserService(SheetsBase):
    """
    ユーザー関連の操作を担当するサービス
    認証、ユーザー情報の取得、更新などを処理
    """
    def fetch_user_by_id(self, user_id: str) -> Optional[Dict]:
        """ユーザーIDからユーザー情報を取得"""
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
        """新規ユーザーを作成"""
        try:
            # ユーザーIDの生成（USER + タイムスタンプ）
            user_id = f"USER{pd.Timestamp.now().strftime('%Y%m%d%H%M%S')}"
            
            # ユーザー名の生成（メールアドレスの@前）
            username = email.split('@')[0]
            
            # 現在時刻
            current_time = pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')
            
            # 新規ユーザーデータ
            user_data = [[
                user_id,        # ユーザーID
                username,       # ユーザー名
                email,         # メールアドレス
                password,      # パスワード
                current_time,  # 登録日時
                api_key,       # APIキー
                False,         # is_deleted
                ""            # deleted_at
            ]]
            
            if not self.append_data('users', 'A:H', user_data):
                logging.error("ユーザーデータの追加に失敗")
                return None
            
            created_user = {
                'user_id': user_id,
                'user_name': username,
                'email': email,
                'password': password,
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
        """ユーザーのパスワードを更新"""
        try:
            sheet_data = self._get_sheet_data('users!A:D')
            if not sheet_data:
                return False
                
            for i, row in enumerate(sheet_data[1:], start=2):
                if row[0] == user_id:
                    return self.update_data(f"users!D{i}", [[new_password]])
            return False

        except Exception as e:
            logging.error(f"パスワード更新エラー: {str(e)}")
            return False

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
                
            current_time = pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')
            
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
