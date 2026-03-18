from typing import Dict, List
import logging
from .base.sheets_base import SheetsBase

class MetalService(SheetsBase):
    """
    金属価格関連の操作を担当するサービス
    価格情報の取得、履歴管理などを処理
    """
    def fetch_metal_prices(self) -> List[Dict]:
        """最新の買取価格を取得"""
        try:
            result = self._get_sheet_data("'metal-prices'!A1:C5")
            if not result:
                return []
            
            headers = ['price_id', 'metal_type', 'retail_price']
            data = result[1:]  # ヘッダー行を除外
            
            prices = []
            for row in data:
                if len(row) >= 3:
                    prices.append({
                        'price_id': row[0],
                        'metal_type': row[1],
                        'retail_price': row[2]
                    })
            
            return prices
            
        except Exception as e:
            logging.error(f"価格データ取得エラー: {str(e)}")
            return []

    def fetch_metal_prices_history(self) -> List[Dict]:
        """価格履歴データを取得"""
        try:
            result = self._get_sheet_data("'metal-prices'!A9:E")
            if not result:
                return []

            # ヘッダーを明示的に指定
            headers = ['date', 'au_retail_price', 'pt_retail_price', 'pd_retail_price', 'ag_retail_price']
            data = result[1:]    # ヘッダー以降のデータ
            
            history = []
            for row in data:
                if len(row) >= 5:  # 必要な列数があることを確認
                    history.append(dict(zip(headers, row)))

            return history

        except Exception as e:
            logging.error(f"価格履歴データの取得に失敗: {str(e)}")
            return []

    def fetch_price_update_time(self) -> str:
        """買取価格の更新日時を取得"""
        try:
            result = self._get_sheet_data("'metal-prices'!E2:E2")
            if not result or not result[0]:
                return ""
            
            # E2セルの値を取得
            update_time = result[0][0] if result[0] else ""
            return str(update_time)
            
        except Exception as e:
            logging.error(f"価格更新日時取得エラー: {str(e)}")
            return ""

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
