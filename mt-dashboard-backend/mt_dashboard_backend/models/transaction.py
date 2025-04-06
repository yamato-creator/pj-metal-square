from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class MetalTransaction(BaseModel):
    """個別の金属取引データモデル"""
    metal_type: str  # Au, Ag, Pt, Pd
    amount: float    # g数
    unit_price: float  # 単価
    total: float     # 合計金額

class TransactionCreate(BaseModel):
    """取引作成リクエストモデル"""
    metals: List[MetalTransaction]
    total_amount: float  # 取引合計金額（税抜）
    tax: float          # 消費税
    total: float        # 総合計（税込）

class DepositCreate(BaseModel):
    """預入作成リクエストモデル"""
    metals: List[MetalTransaction]
    user_id: str

class WithdrawCreate(BaseModel):
    """現物返却作成リクエストモデル"""
    metals: List[MetalTransaction]
    user_id: str

class TransactionResponse(BaseModel):
    """取引情報レスポンスモデル"""
    transaction_id: str
    user_id: str
    transaction_datetime: str
    transaction_type: str
    metal_type: str
    amount: str
    unit_price: str
    total_amount: str
    status: str
    note: Optional[str] = None

class TransactionHistory(BaseModel):
    """取引履歴レスポンスモデル"""
    transactions: List[TransactionResponse]
