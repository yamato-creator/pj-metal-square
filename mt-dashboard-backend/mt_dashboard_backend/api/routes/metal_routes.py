from fastapi import APIRouter, HTTPException, Depends
import logging
from typing import Optional
from ...services.metal_service import MetalService
from ...services.asset_service import AssetService
from ..utils.auth import verify_api_key

# ルーターの設定
router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/metal-prices")
async def get_metal_prices(
    current_user: dict = Depends(verify_api_key)
):
    """最新の金属価格を取得"""
    try:
        metal_service = MetalService()
        prices = metal_service.fetch_metal_prices()
        
        if not prices:
            raise HTTPException(
                status_code=404,
                detail="価格データが見つかりません"
            )
            
        return {
            "status": "success",
            "data": prices
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"価格データ取得エラー: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="価格データの取得に失敗しました"
        )

@router.get("/metal-prices/history")
async def get_metal_prices_history(
    current_user: dict = Depends(verify_api_key)
):
    """金属価格の履歴を取得"""
    try:
        metal_service = MetalService()
        history = metal_service.fetch_metal_prices_history()
        
        if not history:
            raise HTTPException(
                status_code=404,
                detail="価格履歴データが見つかりません"
            )
            
        return {
            "status": "success",
            "data": history
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"価格履歴データ取得エラー: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="価格履歴データの取得に失敗しました"
        )

@router.get("/user/{user_id}/assets")
async def get_user_assets(
    user_id: str,
    current_user: dict = Depends(verify_api_key)
):
    """ユーザーの資産情報を取得"""
    try:
        asset_service = AssetService()
        current_assets = asset_service.fetch_user_assets_with_validation(user_id)
        
        if current_assets is None:
            raise HTTPException(
                status_code=401,
                detail="このユーザーは退会済みです"
            )
            
        if not current_assets:
            raise HTTPException(
                status_code=404,
                detail="資産が見つかりません"
            )
            
        return {
            "status": "success",
            "assets": current_assets
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"資産情報取得エラー: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"資産情報の取得に失敗しました: {str(e)}"
        )
