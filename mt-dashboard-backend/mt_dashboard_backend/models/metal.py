from pydantic import BaseModel
from typing import List, Dict
from datetime import datetime

class MetalPrice(BaseModel):
    """金属価格情報モデル"""
    price_id: str
    metal_type: str
    retail_price: str

class MetalPriceResponse(BaseModel):
    """金属価格情報レスポンスモデル"""
    status: str = "success"
    data: List[MetalPrice]

class MetalPriceHistory(BaseModel):
    """金属価格履歴データモデル"""
    date: str
    au_price: str
    ag_price: str
    pt_price: str
    pd_price: str

class MetalPriceHistoryResponse(BaseModel):
    """金属価格履歴レスポンスモデル"""
    status: str = "success"
    data: List[MetalPriceHistory]

class UserAsset(BaseModel):
    """ユーザーの金属資産情報モデル"""
    asset_id: str
    user_id: str
    metal_type: str
    amount: str
    updated_at: str

class UserAssetResponse(BaseModel):
    """ユーザーの資産情報レスポンスモデル"""
    status: str = "success"
    assets: List[UserAsset]
