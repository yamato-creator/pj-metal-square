import os
import base64
import json
from google.oauth2 import service_account
from googleapiclient.discovery import build
from typing import List, Dict, Any, Optional
import pandas as pd
from pathlib import Path
import logging

# Google APIクライアントのキャッシュ警告を抑制
logging.getLogger('googleapiclient.discovery_cache').setLevel(logging.ERROR)

class SheetsBase:
    """
    Google Sheetsの基本操作を提供するベースクラス
    全てのサービスクラスの親クラスとなる
    """
    def __init__(self):
        # 環境変数からスプレッドシートIDを取得、なければデフォルト値を使用
        self.SPREADSHEET_ID = os.environ.get("SPREADSHEET_ID", "1IPbiCuKKKwVvFqlobJGaiONISkl_iNwF6gkslOM6R58")
        self.SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
        self.service = self._get_sheets_service()

    def _get_sheets_service(self):
        try:
            # 環境変数から認証情報を取得する方法を優先
            if "GOOGLE_CREDENTIALS_BASE64" in os.environ:
                # Base64エンコードされた認証情報を復号
                credentials_json = base64.b64decode(os.environ["GOOGLE_CREDENTIALS_BASE64"]).decode('utf-8')
                credentials_info = json.loads(credentials_json)
                
                credentials = service_account.Credentials.from_service_account_info(
                    credentials_info,
                    scopes=self.SCOPES
                )
            else:
                # ファイルから認証情報を取得する（従来の方法）
                current_dir = Path(__file__).parent.parent.parent.parent
                credentials_path = current_dir / 'credentials.json'
                
                if not credentials_path.exists():
                    raise FileNotFoundError(f"Credentials file not found at {credentials_path}")
                
                credentials = service_account.Credentials.from_service_account_file(
                    str(credentials_path),
                    scopes=self.SCOPES
                )
            
            service = build('sheets', 'v4', credentials=credentials)
            return service

        except Exception as e:
            logging.error(f"Sheets service initialization error: {str(e)}")
            raise

    def _get_sheet_data(self, range_name: str) -> List[List[str]]:
        """シートからデータを取得する共通メソッド"""
        try:
            result = self.service.spreadsheets().values().get(
                spreadsheetId=self.SPREADSHEET_ID,
                range=range_name
            ).execute()
            return result.get('values', [])
        except Exception as e:
            logging.error(f"Sheet data fetch error: {str(e)}")
            return []

    def append_data(self, sheet_name: str, range_suffix: str, values: List[List[Any]]) -> bool:
        """シートにデータを追加する"""
        try:
            range_name = f"{sheet_name}!{range_suffix}"
            self.service.spreadsheets().values().append(
                spreadsheetId=self.SPREADSHEET_ID,
                range=range_name,
                valueInputOption='USER_ENTERED',
                insertDataOption='INSERT_ROWS',
                body={'values': values}
            ).execute()
            return True
        except Exception as e:
            logging.error(f"Data append error: {str(e)}")
            return False

    def update_data(self, range_name: str, values: List[List[Any]]) -> bool:
        """シートのデータを更新する"""
        try:
            self.service.spreadsheets().values().update(
                spreadsheetId=self.SPREADSHEET_ID,
                range=range_name,
                valueInputOption='USER_ENTERED',
                body={'values': values}
            ).execute()
            return True
        except Exception as e:
            logging.error(f"Data update error: {str(e)}")
            return False

    def fetch_data_as_df(self, sheet_name: str, range_name: str) -> Optional[pd.DataFrame]:
        """シートからデータを取得してDataFrameで返す"""
        try:
            result = self.service.spreadsheets().values().get(
                spreadsheetId=self.SPREADSHEET_ID,
                range=f"'{sheet_name}'!{range_name}"
            ).execute()
            
            values = result.get('values', [])
            if not values:
                return None
            
            df = pd.DataFrame(values[1:], columns=values[0])
            return df
            
        except Exception as e:
            logging.error(f"DataFrame conversion error: {str(e)}")
            return None