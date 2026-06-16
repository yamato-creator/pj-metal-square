from fastapi import APIRouter, HTTPException, Depends
import logging
import pandas as pd
from typing import Dict, Optional, List
from ...models.transaction import TransactionCreate, DepositCreate, WithdrawCreate
from ...services.transaction_service import TransactionService
from ...services.asset_service import AssetService
from ..utils.auth import verify_api_key
from ..utils.email import EmailSender
from ..utils.time import jst_str, jst_compact

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
        #    Sheets API はアトミックでないため、失敗時に成功済み分を逆操作（ベストエフォート）
        status_rollback = []  # (row_number, original_status) のリスト
        for transaction in all_transactions:
            original_status = transaction.get("status")
            if not transaction_service.update_transaction_status(transaction_id, transaction["row_number"], "取消"):
                # ロールバック：既に「取消」に変えてしまったレコードを元に戻す
                for row_no, orig in reversed(status_rollback):
                    try:
                        transaction_service.update_transaction_status(transaction_id, row_no, orig)
                    except Exception as rb_err:
                        logger.error(f"ステータス ロールバック失敗 row={row_no}: {rb_err}")
                raise HTTPException(
                    status_code=500,
                    detail="取引ステータスの更新に失敗しました"
                )
            status_rollback.append((transaction["row_number"], original_status))

        def _rollback_all(asset_rollback):
            """ステータスと資産の両方をベストエフォートで元に戻す。"""
            for row_no, orig in reversed(status_rollback):
                try:
                    transaction_service.update_transaction_status(transaction_id, row_no, orig)
                except Exception as rb_err:
                    logger.error(f"ステータス ロールバック失敗 row={row_no}: {rb_err}")
            for u_id, m_type, original_amount in reversed(asset_rollback):
                try:
                    asset_service.update_asset_after_sale(u_id, m_type, original_amount)
                except Exception as rb_err:
                    logger.error(f"資産 ロールバック失敗 metal={m_type}: {rb_err}")

        # 5. 各金属の資産を元に戻す
        transaction_details_list = []
        asset_rollback = []  # (user_id, metal_type, original_amount) のリスト
        for transaction in all_transactions:
            metal_type = transaction["metal_type"]
            amount = float(transaction["weight_g"])

            # 現在の保有量を取得
            current_assets = asset_service.fetch_user_assets_with_validation(current_user["user_id"])
            if current_assets is None:
                _rollback_all(asset_rollback)
                raise HTTPException(
                    status_code=401,
                    detail="このユーザーは退会済みです"
                )

            current_asset = next(
                (asset for asset in current_assets if asset["metal_type"] == metal_type),
                None
            )

            original_amount = float(current_asset["weight_g"]) if current_asset else 0.0
            if not current_asset:
                # 資産がない場合は新規作成
                new_amount = amount
            else:
                # 取引タイプに基づいて資産を更新
                if transaction["transaction_type"] == "預入":
                    # 預入取引の場合はキャンセル時に減算
                    new_amount = original_amount - amount
                else:
                    # 売却・現物返却取引の場合はキャンセル時に加算
                    new_amount = original_amount + amount

            # 資産を更新
            if not asset_service.update_asset_after_sale(
                current_user["user_id"],
                metal_type,
                new_amount
            ):
                _rollback_all(asset_rollback)
                raise HTTPException(
                    status_code=500,
                    detail=f"{metal_type}の資産更新に失敗しました"
                )
            asset_rollback.append((current_user["user_id"], metal_type, original_amount))

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
        logger.error(f"取引キャンセルエラー: {e}")
        # クライアントには内部エラー詳細を返さない（情報漏洩対策）
        raise HTTPException(
            status_code=500,
            detail="取引キャンセルに失敗しました"
        )

@router.post("/sale")
async def create_sale_quote_request(
    transaction_data: TransactionCreate,
    current_user: dict = Depends(verify_api_key)
):
    """売却の見積もり依頼を作成（資産は減らさず、スクエアへ通知のみ）"""
    try:
        transaction_service = TransactionService()
        asset_service = AssetService()
        email_sender = EmailSender()

        # 共通の取引IDを生成（全ての金属で使用）
        transaction_id = f"TRS{jst_compact()}"

        # 1. 保有量チェックと見積もり依頼記録（資産更新はしない）
        current_assets = asset_service.fetch_user_assets_with_validation(current_user["user_id"])
        if current_assets is None:
            raise HTTPException(
                status_code=401,
                detail="このユーザーは退会済みです"
            )

        for metal in transaction_data.metals:
            current_asset = next(
                (asset for asset in current_assets if asset["metal_type"] == metal.metal_type),
                None
            )

            if not current_asset:
                raise HTTPException(
                    status_code=400,
                    detail=f"{metal.metal_type}の保有データが見つかりません"
                )

            # 希望量が保有量以内か確認
            current_amount = float(current_asset["weight_g"])
            requested_amount = float(metal.amount)

            if current_amount < requested_amount:
                raise HTTPException(
                    status_code=400,
                    detail=f"{metal.metal_type}の売却希望量が保有量を超えています"
                )

            # 取引記録（ステータス「見積依頼」）
            transaction_values = {
                "user_id": current_user["user_id"],
                "transaction_type": "見積依頼",
                "metal_type": metal.metal_type,
                "weight_g": str(metal.amount),
                "unit_price": str(metal.unit_price),
                "total_amount": str(metal.total),
                "transaction_id": transaction_id,
                "company_name": "スクエア",
                "status": "見積依頼"
            }

            if not transaction_service.create_transaction(transaction_values):
                raise HTTPException(
                    status_code=500,
                    detail=f"{metal.metal_type}の見積もり依頼の記録に失敗しました"
                )

        # 2. メール送信処理（ユーザーへ受付通知 + スクエア管理者へ依頼通知）
        try:
            quote_details = "\n".join([
                f"{transaction_service._get_metal_name_jp(metal.metal_type)}: {float(metal.amount):.2f}g (参考価格 {int(float(metal.unit_price))}円/g)"
                for metal in transaction_data.metals
            ])

            await email_sender.send_sale_quote_request_email(
                user_email=current_user["email"],
                username=current_user.get("user_name", ""),
                user_id=current_user["user_id"],
                quote_details=quote_details,
                reference_total=int(transaction_data.total_amount),
                transaction_id=transaction_id,
            )

        except Exception as e:
            logger.error(f"メール送信エラー: {str(e)}")
            # メール送信エラーは非クリティカルとして扱う

        # 3. 資産情報は変更なしだが、フロント更新用に現在の資産情報を返す
        return {
            "status": "success",
            "message": "見積もり依頼を受け付けました",
            "transaction_id": transaction_id,
            "updated_assets": current_assets
        }

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"見積もり依頼エラー: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="見積もり依頼の処理に失敗しました"
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
        transaction_id = f"TRS{jst_compact()}"

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
                asset_id = f"AST{jst_compact()}{current_user['user_id'][-4:]}"
                current_time = jst_str()
                
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
            detail="預入処理に失敗しました"
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
        transaction_id = f"TRS{jst_compact()}"

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
            detail="現物返却処理に失敗しました"
        )
