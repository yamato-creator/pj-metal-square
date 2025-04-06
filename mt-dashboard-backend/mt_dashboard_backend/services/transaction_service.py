from typing import Dict, List, Optional
import logging
import pandas as pd
from datetime import datetime, timedelta
from .base.sheets_base import SheetsBase

class TransactionService(SheetsBase):
    """
    取引関連の操作を担当するサービス
    取引履歴の取得、新規取引の作成などを処理
    """
    def fetch_transactions(self, user_id: Optional[str] = None) -> List[Dict]:
        """
        取引履歴を取得
        
        Args:
            user_id (Optional[str]): 特定のユーザーの取引のみを取得する場合はユーザーID
            
        Returns:
            List[Dict]: 取引履歴のリスト
        """
        try:
            values = self._get_sheet_data('transactions!A:J')
            if not values:
                return []

            headers = values[0]
            data = values[1:]
            
            # ユーザーIDと日時でグループ化するための辞書
            grouped_by_user_time = {}
            
            # 各グループの最初の取引IDを記録
            first_transaction_ids = {}
            # 各グループの会社名を記録
            company_names = {}
            # 各グループのステータスを記録
            transaction_statuses = {}
            # 各グループの取引種別を記録
            transaction_types = {}
            
            # まず、すべてのデータを処理して、ユーザーと時間ごとの最初の取引IDと会社名を記録
            for row in data:
                if len(row) < len(headers):
                    continue
                    
                transaction = dict(zip(headers, row))
                
                # ユーザーIDでフィルタリング
                if user_id and transaction.get('user_id') != user_id:
                    continue
                
                user_id_value = transaction.get('user_id', '')
                transaction_time = transaction.get('transaction_datetime', '')
                transaction_id = transaction.get('transaction_id', '')
                company_name = "株式会社ドット・セブンティーン"
                status = transaction.get('status', '申込')
                transaction_type = transaction.get('transaction_type', '')
                
                # ユーザーIDと時間の組み合わせをキーとして使用
                group_key = f"{user_id_value}_{transaction_time}"
                
                # このグループの最初の取引IDと会社名を記録
                if group_key not in first_transaction_ids:
                    first_transaction_ids[group_key] = transaction_id
                    company_names[group_key] = company_name
                    transaction_statuses[group_key] = status
                    transaction_types[group_key] = transaction_type
            
            # 次に、データを再処理して、同じユーザーと時間の取引を同じ取引IDでグループ化
            for row in data:
                if len(row) < len(headers):
                    continue
                    
                transaction = dict(zip(headers, row))
                
                # ユーザーIDでフィルタリング
                if user_id and transaction.get('user_id') != user_id:
                    continue
                
                user_id_value = transaction.get('user_id', '')
                transaction_time = transaction.get('transaction_datetime', '')
                
                # ユーザーIDと時間の組み合わせをキーとして使用
                group_key = f"{user_id_value}_{transaction_time}"
                
                # このグループの最初の取引IDを使用
                common_transaction_id = first_transaction_ids.get(group_key, transaction.get('transaction_id', ''))
                # このグループの会社名を使用
                company_name = "株式会社ドット・セブンティーン"
                # このグループのステータスを使用
                status = transaction_statuses.get(group_key, transaction.get('status', '申込'))
                # このグループの取引種別を使用
                transaction_type = transaction_types.get(group_key, transaction.get('transaction_type', ''))
                
                metal_type = transaction.get('metal_type', '')
                metal_code = ''
                
                # 金属コードを抽出（Au, Ag, Pt, Pd）
                if metal_type == '金':
                    metal_code = 'Au'
                elif metal_type == '銀':
                    metal_code = 'Ag'
                elif metal_type == 'プラチナ':
                    metal_code = 'Pt'
                elif metal_type == 'パラジウム':
                    metal_code = 'Pd'
                
                metal_item = {
                    'metalName': metal_code,
                    'nameJp': metal_type,
                    'amount': float(transaction.get('weight_g', 0)),
                    'unitPrice': float(transaction.get('unit_price', 0)),
                    'total': float(transaction.get('total_amount', 0))
                }
                
                # 共通の取引IDでグループ化
                if common_transaction_id in grouped_by_user_time:
                    grouped_by_user_time[common_transaction_id]['items'].append(metal_item)
                    grouped_by_user_time[common_transaction_id]['subtotal'] += metal_item['total']
                else:
                    grouped_by_user_time[common_transaction_id] = {
                        'id': common_transaction_id,
                        'date': transaction_time,
                        'company': company_name,
                        'items': [metal_item],
                        'subtotal': metal_item['total'],
                        'tax': 0,
                        'total': 0,
                        'status': status,
                        'transaction_type': transaction_type
                    }
            
            # 税金と合計を計算
            result = []
            for transaction in grouped_by_user_time.values():
                transaction['tax'] = round(transaction['subtotal'] * 0.1)
                transaction['total'] = transaction['subtotal'] + transaction['tax']
                result.append(transaction)
            
            # 日付の降順でソート
            result.sort(key=lambda x: x['date'], reverse=True)
            
            return result
            
        except Exception as e:
            logging.error(f"取引履歴取得エラー: {str(e)}")
            return []

    def create_transaction(self, transaction_data: Dict) -> bool:
        """
        取引履歴を追加
        
        Args:
            transaction_data (Dict): 取引データ
                必要なキー: ユーザーID, 取引種別, 貴金属種別, g数, 単価, 合計金額
                オプションのキー: 取引ID（指定がない場合は自動生成）, 会社名（指定がない場合はB会社）
                
        Returns:
            bool: 作成成功時True、失敗時False
        """
        try:
            # 取引IDが提供されていれば、それを使用
            transaction_id = transaction_data.get('transaction_id')
            if not transaction_id:
                # 提供されていない場合のみ新しく生成
                transaction_id = f"TRS{datetime.now().strftime('%Y%m%d%H%M%S')}"
            
            # 必ず現在時刻を使用して日時を記録
            transaction_datetime = datetime.now().strftime('%Y/%m/%d %H:%M:%S')

            # 金属名を日本語に変換
            metal_type_jp = self._get_metal_name_jp(transaction_data.get('metal_type'))

            # 会社名は常に「株式会社ドット・セブンティーン」に設定
            company_name = "株式会社ドット・セブンティーン"

            values = [[
                transaction_id,                                    # 取引ID
                transaction_data.get('user_id'),                   # ユーザーID
                transaction_data.get('transaction_type'),          # 取引種別
                metal_type_jp,                                    # 貴金属種別（日本語）
                transaction_data.get('weight_g'),                  # 取引量(g)
                transaction_data.get('unit_price'),                # 単価(ユーザー報告値)
                str(float(transaction_data.get('total_amount', 0))), # 合計金額
                '申込',                                          # ステータス
                transaction_datetime,                             # 取引日時
                company_name                                      # CP(取引相手先)
            ]]
            
            result = self.append_data('transactions', 'A:J', values)
            return bool(result)
            
        except Exception as e:
            logging.error(f"取引記録エラー: {str(e)}")
            return False

    def get_transaction_details(self, transaction_id: str, user_id: str) -> Optional[Dict]:
        """
        特定の取引の詳細を取得
        
        Args:
            transaction_id (str): 取引ID
            user_id (str): ユーザーID（権限確認用）
            
        Returns:
            Optional[Dict]: 取引詳細、見つからない場合はNone
        """
        try:
            values = self._get_sheet_data('transactions!A:J')
            if not values:
                return None
                
            headers = values[0]
            data = values[1:]
            
            for row in data:
                if len(row) < len(headers):
                    continue
                    
                transaction = dict(zip(headers, row))
                
                # 取引IDとユーザーIDが一致する取引を探す
                if (transaction.get('transaction_id') == transaction_id and 
                    transaction.get('user_id') == user_id):
                    return transaction
            
            return None
            
        except Exception as e:
            logging.error(f"取引詳細取得エラー: {str(e)}")
            return None

    def get_all_transactions_by_id(self, transaction_id: str, user_id: str) -> List[Dict]:
        """
        特定の取引IDに関連するすべての取引を取得
        
        Args:
            transaction_id (str): 取引ID
            user_id (str): ユーザーID（権限確認用）
            
        Returns:
            List[Dict]: 取引詳細のリスト、見つからない場合は空リスト
        """
        try:
            values = self._get_sheet_data('transactions!A:J')
            if not values:
                return []
                
            headers = values[0]
            data = values[1:]
            
            result = []
            for idx, row in enumerate(data, start=2):  # シートの2行目から始まるため
                if len(row) < len(headers):
                    continue
                    
                transaction = dict(zip(headers, row))
                transaction["row_number"] = idx  # 行番号を追加
                
                # 取引IDとユーザーIDが一致する取引を探す
                if (transaction.get('transaction_id') == transaction_id and 
                    transaction.get('user_id') == user_id):
                    result.append(transaction)
            
            return result
            
        except Exception as e:
            logging.error(f"取引詳細取得エラー: {str(e)}")
            return []

    def update_transaction_status(self, transaction_id: str, row_idx: int, new_status: str) -> bool:
        """
        取引のステータスを更新
        
        Args:
            transaction_id (str): 取引ID
            row_idx (int): row number
            new_status (str): 新しいステータス
            
        Returns:
            bool: 更新成功時True、失敗時False
        """
        try:
            # ステータス列（H列）を更新
            result = self.update_data(
                f'transactions!H{row_idx}',
                [[new_status]]
            )
            
            if not result:
                logging.error("取引ステータス更新に失敗")
                return False
            
            return True
            
        except Exception as e:
            logging.error(f"取引ステータス更新エラー: {str(e)}")
            return False

    def is_within_48_hours(self, date_string: str) -> bool:
        """
        取引が48時間以内かどうかを判定
        
        Args:
            date_string (str): 取引日時の文字列 (形式: '%Y/%m/%d %H:%M:%S')
            
        Returns:
            bool: 48時間以内ならTrue、それ以外はFalse
        """
        try:
            # 文字列を日時オブジェクトに変換
            transaction_date = datetime.strptime(date_string, '%Y/%m/%d %H:%M:%S')
            # 現在時刻
            now = datetime.now()
            # 差分を計算
            time_diff = now - transaction_date
            # 48時間（2日）以内かどうかを判定
            return time_diff <= timedelta(hours=48)
        except Exception as e:
            logging.error(f"日時判定エラー: {str(e)}")
            return False

    def _get_metal_name_jp(self, metal_type: str) -> str:
        """
        金属名を日本語に変換
        
        Args:
            metal_type (str): 金属種別（Au, Ag, Pt, Pd）
            
        Returns:
            str: 日本語の金属名
        """
        metal_names = {
            'Au': '金',
            'Ag': '銀',
            'Pt': 'プラチナ',
            'Pd': 'パラジウム'
        }
        return metal_names.get(metal_type, metal_type)
