from fastapi import APIRouter, HTTPException, Depends
import logging
import pandas as pd
from typing import Dict, Optional, List
from ...models.transaction import TransactionCreate, DepositCreate, WithdrawCreate
from ...services.transaction_service import TransactionService
from ...services.asset_service import AssetService
from ..utils.auth import verify_api_key
from ..utils.email import EmailSender
import math

# ルーターの設定
router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("")
async def get_transactions(
    current_user: dict = Depends(verify_api_key)
):
    """取引履歴を取得"""
    try:
        transaction_service = TransactionService()
        # 認証されたユーザーのIDを使用して取引履歴を取得
        user_id = current_user["user_id"]
        transactions = transaction_service.fetch_transactions(user_id)
        return {
            "status": "success",
            "transactions": transactions
        }
    except Exception as e:
        logger.error(f"取引履歴取得エラー: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="取引履歴の取得に失敗しました"
        )

@router.post("/cancel/{transaction_id}")
async def cancel_transaction(
    transaction_id: str,
    current_user: dict = Depends(verify_api_key)
):
    """取引をキャンセルする"""
    try:
        transaction_service = TransactionService()
        asset_service = AssetService()
        email_sender = EmailSender()
        
        # 1. 取引IDに関連するすべての取引を取得
        all_transactions = transaction_service.get_all_transactions_by_id(transaction_id, current_user["user_id"])
        if not all_transactions:
            raise HTTPException(
                status_code=404,
                detail="取引が見つからないか、このユーザーの取引ではありません"
            )
        
        # 2. 最初の取引の日時を使って23:59:59以内かチェック
        if not transaction_service.is_cancelable(all_transactions[0]["transaction_datetime"]):
            raise HTTPException(
                status_code=400,
                detail="取引日を過ぎているためキャンセルできません"
            )
        
        # 3. すべての取引が既にキャンセルされていないかチェック
        if all(transaction.get("status") == "取消" for transaction in all_transactions):
            raise HTTPException(
                status_code=400,
                detail="この取引は既にキャンセルされています"
            )
        
        # 4. 取引ステータスをすべて「取消」に更新
        for transaction in all_transactions:
            if not transaction_service.update_transaction_status(transaction_id, transaction["row_number"], "取消"):
                raise HTTPException(
                    status_code=500,
                    detail="取引ステータスの更新に失敗しました"
                )
        
        # 5. 各金属の資産を元に戻す
        transaction_details_list = []
        for transaction in all_transactions:
            metal_type = transaction["metal_type"]
            amount = float(transaction["weight_g"])
            
            # 現在の保有量を取得
            current_assets = asset_service.fetch_user_assets_with_validation(current_user["user_id"])
            if current_assets is None:
                raise HTTPException(
                    status_code=401,
                    detail="このユーザーは退会済みです"
                )
            
            current_asset = next(
                (asset for asset in current_assets if asset["metal_type"] == metal_type),
                None
            )
            
            if not current_asset:
                # 資産がない場合は新規作成
                new_amount = amount
            else:
                # 取引タイプに基づいて資産を更新
                if transaction["transaction_type"] == "預入":
                    # 預入取引の場合はキャンセル時に減算
                    new_amount = float(current_asset["weight_g"]) - amount
                else:
                    # 売却・現物返却取引の場合はキャンセル時に加算
                    new_amount = float(current_asset["weight_g"]) + amount
            
            # 資産を更新
            if not asset_service.update_asset_after_sale(
                current_user["user_id"],
                metal_type,
                new_amount
            ):
                raise HTTPException(
                    status_code=500,
                    detail=f"{metal_type}の資産更新に失敗しました"
                )
            
            # 取引詳細を記録（メール用）
            transaction_details_list.append(f"{metal_type}: {amount:.2f}g")
        
        # 6. キャンセル完了メールを送信
        try:
            transaction_details = "\n".join(transaction_details_list)
            await email_sender.send_transaction_cancel_email(
                user_email=current_user["email"],
                transaction_details=transaction_details,
                transaction_date=all_transactions[0]["transaction_datetime"]
            )
        except Exception as e:
            logger.error(f"メール送信エラー: {str(e)}")
            # メール送信エラーは非クリティカルとして扱う
        
        # 7. 更新後の資産情報を取得して返却
        updated_assets = asset_service.fetch_user_assets_with_validation(current_user["user_id"])
        return {
            "status": "success",
            "message": "取引をキャンセルしました",
            "updated_assets": updated_assets
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"取引キャンセルエラー: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"取引キャンセルに失敗しました: {str(e)}"
        )

@router.post("/sale")
async def create_sale_transaction(
    transaction_data: TransactionCreate,
    current_user: dict = Depends(verify_api_key)
):
    """売却取引を作成"""
    try:
        transaction_service = TransactionService()
        asset_service = AssetService()
        email_sender = EmailSender()

        # 共通の取引IDを生成（全ての金属で使用）
        transaction_id = f"TRS{pd.Timestamp.now().strftime('%Y%m%d%H%M%S')}"

        # 1. 各金属の取引を記録と資産更新
        for metal in transaction_data.metals:
            # 現在の保有量を確認
            current_assets = asset_service.fetch_user_assets_with_validation(current_user["user_id"])
            if current_assets is None:
                raise HTTPException(
                    status_code=401,
                    detail="このユーザーは退会済みです"
                )
            
            current_asset = next(
                (asset for asset in current_assets if asset["metal_type"] == metal.metal_type),
                None
            )
            
            if not current_asset:
                raise HTTPException(
                    status_code=400,
                    detail=f"{metal.metal_type}の保有データが見つかりません"
                )
            
            # 売却可能か確認
            current_amount = float(current_asset["weight_g"])
            sale_amount = float(metal.amount)
            
            if current_amount < sale_amount:
                raise HTTPException(
                    status_code=400,
                    detail=f"{metal.metal_type}の売却量が保有量を超えています"
                )

            # 取引記録
            transaction_values = {
                "user_id": current_user["user_id"],
                "transaction_type": "売却",
                "metal_type": metal.metal_type,
                "weight_g": str(metal.amount),
                "unit_price": str(metal.unit_price),
                "total_amount": str(metal.total),
                "transaction_id": transaction_id,
                "company_name": "スクエア"
            }
            
            if not transaction_service.create_transaction(transaction_values):
                raise HTTPException(
                    status_code=500,
                    detail=f"{metal.metal_type}の売却処理に失敗しました"
                )

            # 資産更新
            new_amount = current_amount - sale_amount
            if not asset_service.update_asset_after_sale(
                current_user["user_id"],
                metal.metal_type,
                new_amount
            ):
                raise HTTPException(
                    status_code=500,
                    detail=f"{metal.metal_type}の資産更新に失敗しました"
                )

        # 2. メール送信処理（全ての金属をまとめて1通）
        try:
            # 売却内容の文字列を作成（全金属分）
            sales_details = "\n".join([
                f"{transaction_service._get_metal_name_jp(metal.metal_type)}: {float(metal.amount):.2f}g ({int(float(metal.unit_price))}円/g)"
                for metal in transaction_data.metals
            ])

            # 売却合計金額を小計と一致させる（切り捨て処理済みの値を使用）
            await email_sender.send_sale_completion_email(
                user_email=current_user["email"],
                sales_details=sales_details,
                total_amount=int(transaction_data.total_amount),
                tax=int(math.floor(transaction_data.tax)),
                total=int(transaction_data.total_amount + math.floor(transaction_data.tax))
            )

        except Exception as e:
            logger.error(f"メール送信エラー: {str(e)}")
            # メール送信エラーは非クリティカルとして扱う

        # 3. 更新後の資産情報を取得して返却
        updated_assets = asset_service.fetch_user_assets_with_validation(current_user["user_id"])
        return {
            "status": "success",
            "message": "売却処理が完了しました",
            "updated_assets": updated_assets
        }

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"売却処理エラー: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"売却処理に失敗しました: {str(e)}"
        )

@router.post("/deposit")
async def create_deposit_transaction(
    transaction_data: DepositCreate,
    current_user: dict = Depends(verify_api_key)
):
    """預入取引を作成"""
    try:
        transaction_service = TransactionService()
        asset_service = AssetService()
        email_sender = EmailSender()

        # 共通の取引IDを生成（全ての金属で使用）
        transaction_id = f"TRS{pd.Timestamp.now().strftime('%Y%m%d%H%M%S')}"

        # 1. 各金属の取引を記録と資産更新
        for metal in transaction_data.metals:
            # 現在の保有量を確認
            current_assets = asset_service.fetch_user_assets_with_validation(current_user["user_id"])
            if current_assets is None:
                raise HTTPException(
                    status_code=401,
                    detail="このユーザーは退会済みです"
                )
            
            current_asset = next(
                (asset for asset in current_assets if asset["metal_type"] == metal.metal_type),
                None
            )
            
            # 取引記録
            transaction_values = {
                "user_id": current_user["user_id"],
                "transaction_type": "預入",
                "metal_type": metal.metal_type,
                "weight_g": str(metal.amount),
                "unit_price": str(metal.unit_price),
                "total_amount": str(metal.total),
                "transaction_id": transaction_id,
                "company_name": "スクエア"
            }
            
            if not transaction_service.create_transaction(transaction_values):
                raise HTTPException(
                    status_code=500,
                    detail=f"{metal.metal_type}の預入処理に失敗しました"
                )

            # 資産更新
            if current_asset:
                # 既存の資産に預入分を追加
                new_amount = float(current_asset["weight_g"]) + float(metal.amount)
                if not asset_service.update_asset_after_sale(
                    current_user["user_id"],
                    metal.metal_type,
                    new_amount
                ):
                    raise HTTPException(
                        status_code=500,
                        detail=f"{metal.metal_type}の資産更新に失敗しました"
                    )
            else:
                # 資産がない場合は新規作成
                asset_id = f"AST{pd.Timestamp.now().strftime('%Y%m%d%H%M%S')}{current_user['user_id'][-4:]}"
                current_time = pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')
                
                asset_values = [
                    asset_id,
                    current_user["user_id"],
                    metal.metal_type,
                    str(metal.amount),
                    current_time
                ]
                
                if not asset_service.create_asset(asset_values):
                    raise HTTPException(
                        status_code=500,
                        detail=f"{metal.metal_type}の資産作成に失敗しました"
                    )

        # 2. メール送信処理（全ての金属をまとめて1通）
        try:
            # 預入内容の文字列を作成（全金属分）
            deposit_details = "\n".join([
                f"{transaction_service._get_metal_name_jp(metal.metal_type)}: {float(metal.amount):.2f}g ({int(float(metal.unit_price))}円/g)"
                for metal in transaction_data.metals
            ])

            await email_sender.send_deposit_completion_email(
                user_email=current_user["email"],
                deposit_details=deposit_details
            )

        except Exception as e:
            logger.error(f"メール送信エラー: {str(e)}")
            # メール送信エラーは非クリティカルとして扱う

        # 3. 更新後の資産情報を取得して返却
        updated_assets = asset_service.fetch_user_assets_with_validation(current_user["user_id"])
        return {
            "status": "success",
            "message": "預入処理が完了しました",
            "updated_assets": updated_assets
        }
        
    except HTTPException as e:
        # 既に発生したHTTPExceptionはそのまま再送
        raise
    except Exception as e:
        logger.error(f"預入処理エラー: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"預入処理に失敗しました: {str(e)}"
        )

@router.post("/withdraw")
async def create_withdraw_transaction(
    transaction_data: WithdrawCreate,
    current_user: dict = Depends(verify_api_key)
):
    """現物返却取引を作成"""
    try:
        transaction_service = TransactionService()
        asset_service = AssetService()
        email_sender = EmailSender()

        # 共通の取引IDを生成（全ての金属で使用）
        transaction_id = f"TRS{pd.Timestamp.now().strftime('%Y%m%d%H%M%S')}"

        # 1. 各金属の取引を記録と資産更新
        for metal in transaction_data.metals:
            # 現在の保有量を確認
            current_assets = asset_service.fetch_user_assets_with_validation(current_user["user_id"])
            if current_assets is None:
                raise HTTPException(
                    status_code=401,
                    detail="このユーザーは退会済みです"
                )
            
            current_asset = next(
                (asset for asset in current_assets if asset["metal_type"] == metal.metal_type),
                None
            )
            
            if not current_asset:
                raise HTTPException(
                    status_code=400,
                    detail=f"{metal.metal_type}の保有データが見つかりません"
                )
            
            # 返却可能か確認
            current_amount = float(current_asset["weight_g"])
            withdraw_amount = float(metal.amount)
            
            if current_amount < withdraw_amount:
                raise HTTPException(
                    status_code=400,
                    detail=f"{metal.metal_type}の返却量が保有量を超えています"
                )

            # 取引記録 - 金額情報は記録しない
            transaction_values = {
                "user_id": current_user["user_id"],
                "transaction_type": "現物返却",
                "metal_type": metal.metal_type,
                "weight_g": str(metal.amount),
                "unit_price": "0", # 単価は記録しない
                "total_amount": "0", # 金額は記録しない
                "transaction_id": transaction_id,
                "company_name": "スクエア"
            }
            
            if not transaction_service.create_transaction(transaction_values):
                raise HTTPException(
                    status_code=500,
                    detail=f"{metal.metal_type}の現物返却処理に失敗しました"
                )

            # 資産更新
            new_amount = current_amount - withdraw_amount
            if not asset_service.update_asset_after_sale(
                current_user["user_id"],
                metal.metal_type,
                new_amount
            ):
                raise HTTPException(
                    status_code=500,
                    detail=f"{metal.metal_type}の資産更新に失敗しました"
                )

        # 2. メール送信処理（全ての金属をまとめて1通）
        try:
            # 返却内容の文字列を作成（全金属分）- 金額情報は含めない
            withdraw_details = "\n".join([
                f"{transaction_service._get_metal_name_jp(metal.metal_type)}: {float(metal.amount):.2f}g"
                for metal in transaction_data.metals
            ])

            await email_sender.send_withdraw_completion_email(
                user_email=current_user["email"],
                withdraw_details=withdraw_details
            )

        except Exception as e:
            logger.error(f"メール送信エラー: {str(e)}")
            # メール送信エラーは非クリティカルとして扱う

        # 3. 更新後の資産情報を取得して返却
        updated_assets = asset_service.fetch_user_assets_with_validation(current_user["user_id"])
        return {
            "status": "success",
            "message": "現物返却処理が完了しました",
            "updated_assets": updated_assets
        }
        
    except HTTPException as e:
        # 既に発生したHTTPExceptionはそのまま再送
        raise
    except Exception as e:
        logger.error(f"現物返却処理エラー: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"現物返却処理に失敗しました: {str(e)}"
        )
