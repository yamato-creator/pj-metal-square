from fastapi import APIRouter, HTTPException, Depends
import logging
import math
import pandas as pd
from typing import Dict, Optional, List
from ...models.transaction import TransactionCreate, DepositCreate, WithdrawCreate
from ...services.transaction_service import TransactionService
from ...services.asset_service import AssetService
from ..utils.auth import verify_api_key
from ..utils.email import EmailSender
from ..utils.time import jst_str, jst_compact
from ..utils.access_time import require_business_hours, require_sale_time
from ..utils.user_lock import user_lock

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
    current_user: dict = Depends(verify_api_key),
    _bh: None = Depends(require_business_hours),
):
    """取引をキャンセルする"""
    async with user_lock(current_user["user_id"]):
      return await _cancel_transaction(transaction_id, current_user)


async def _cancel_transaction(transaction_id: str, current_user: dict):
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
async def create_sale_transaction(
    transaction_data: TransactionCreate,
    current_user: dict = Depends(verify_api_key),
    _st: None = Depends(require_sale_time),
):
    """売却取引を作成（保有資産を減算し、お客様＋管理者へ売却完了メールを送信）。

    2026/9/15 星さん確定: 従来の「見積もり依頼」フローを廃止し、お客様が押した
    時点でアプリ表示価格のまま売却成立とする元の仕様へ戻したもの。
    """
    async with user_lock(current_user["user_id"]):
        return await _create_sale_transaction(transaction_data, current_user)


async def _create_sale_transaction(transaction_data: TransactionCreate, current_user: dict):
    try:
        transaction_service = TransactionService()
        asset_service = AssetService()
        email_sender = EmailSender()

        # 共通の取引IDを生成（全ての金属で使用）
        transaction_id = f"TRS{jst_compact()}"

        # 1. 事前チェック：全金属の保有量が売却希望量以上かをまとめて確認
        #    （資産を1つも減らす前に検証し、部分失敗を最小化する）
        current_assets = asset_service.fetch_user_assets_with_validation(current_user["user_id"])
        if current_assets is None:
            raise HTTPException(
                status_code=401,
                detail="このユーザーは退会済みです"
            )

        # 同一金属が複数行で送られてくるケースに備え、金属ごとに希望量を合計して検証
        requested_by_metal: Dict[str, float] = {}
        for metal in transaction_data.metals:
            requested_by_metal[metal.metal_type] = (
                requested_by_metal.get(metal.metal_type, 0.0) + float(metal.amount)
            )

        for metal_type, requested_amount in requested_by_metal.items():
            current_asset = next(
                (asset for asset in current_assets if asset["metal_type"] == metal_type),
                None
            )
            if not current_asset:
                raise HTTPException(
                    status_code=400,
                    detail=f"{metal_type}の保有データが見つかりません"
                )
            if float(current_asset["weight_g"]) < requested_amount:
                raise HTTPException(
                    status_code=400,
                    detail=f"{metal_type}の売却量が保有量を超えています"
                )

        # 2. 取引記録＋資産減算。Sheets API はアトミックでないため、
        #    途中失敗時は減算済みの資産をベストエフォートで元に戻す。
        asset_rollback = []  # (user_id, metal_type, original_amount) のリスト

        def _rollback():
            for u_id, m_type, orig in reversed(asset_rollback):
                try:
                    asset_service.update_asset_after_sale(u_id, m_type, orig)
                except Exception as rb_err:
                    logger.error(f"資産 ロールバック失敗 metal={m_type}: {rb_err}")

        for metal in transaction_data.metals:
            # 取引記録（ステータス「売却」）
            transaction_values = {
                "user_id": current_user["user_id"],
                "transaction_type": "売却",
                "metal_type": metal.metal_type,
                "weight_g": str(metal.amount),
                "unit_price": str(metal.unit_price),
                "total_amount": str(metal.total),
                "transaction_id": transaction_id,
                "company_name": "スクエア",
                "status": "売却",
            }
            if not transaction_service.create_transaction(transaction_values):
                _rollback()
                raise HTTPException(
                    status_code=500,
                    detail=f"{metal.metal_type}の売却処理に失敗しました"
                )

            # 最新の保有量を取得して減算（ロック内なので安全）
            latest_assets = asset_service.fetch_user_assets_with_validation(current_user["user_id"])
            if latest_assets is None:
                _rollback()
                raise HTTPException(
                    status_code=401,
                    detail="このユーザーは退会済みです"
                )
            latest_asset = next(
                (asset for asset in latest_assets if asset["metal_type"] == metal.metal_type),
                None
            )
            original_amount = float(latest_asset["weight_g"]) if latest_asset else 0.0
            new_amount = original_amount - float(metal.amount)
            if new_amount < 0:
                _rollback()
                raise HTTPException(
                    status_code=400,
                    detail=f"{metal.metal_type}の売却量が保有量を超えています"
                )
            if not asset_service.update_asset_after_sale(
                current_user["user_id"],
                metal.metal_type,
                new_amount
            ):
                _rollback()
                raise HTTPException(
                    status_code=500,
                    detail=f"{metal.metal_type}の資産更新に失敗しました"
                )
            asset_rollback.append((current_user["user_id"], metal.metal_type, original_amount))

        # 3. 売却完了メール（お客様＋管理者へ1通ずつ）
        try:
            sales_details = "\n".join([
                f"{transaction_service._get_metal_name_jp(metal.metal_type)}: {float(metal.amount):.2f}g ({int(float(metal.unit_price))}円/g)"
                for metal in transaction_data.metals
            ])
            subtotal = int(transaction_data.total_amount)
            tax_yen = int(math.floor(transaction_data.tax))
            await email_sender.send_sale_completion_email(
                user_email=current_user["email"],
                sales_details=sales_details,
                total_amount=subtotal,
                tax=tax_yen,
                total=subtotal + tax_yen,
                username=current_user.get("user_name", ""),
                user_id=current_user["user_id"],
            )
        except Exception as e:
            logger.error(f"メール送信エラー: {str(e)}")
            # メール送信エラーは非クリティカルとして扱う

        # 4. 更新後の資産情報を取得して返却
        updated_assets = asset_service.fetch_user_assets_with_validation(current_user["user_id"])
        return {
            "status": "success",
            "message": "売却処理が完了しました",
            "transaction_id": transaction_id,
            "updated_assets": updated_assets
        }

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"売却処理エラー: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="売却処理に失敗しました"
        )

@router.post("/deposit")
async def create_deposit_transaction(
    transaction_data: DepositCreate,
    current_user: dict = Depends(verify_api_key),
    _bh: None = Depends(require_business_hours),
):
    """預入取引を作成"""
    async with user_lock(current_user["user_id"]):
        return await _create_deposit_transaction(transaction_data, current_user)


async def _create_deposit_transaction(transaction_data: DepositCreate, current_user: dict):
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
    current_user: dict = Depends(verify_api_key),
    _bh: None = Depends(require_business_hours),
):
    """現物返却取引を作成（公開ハンドラ）。"""
    async with user_lock(current_user["user_id"]):
        return await _create_withdraw_transaction(transaction_data, current_user)


async def _create_withdraw_transaction(transaction_data: WithdrawCreate, current_user: dict):
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
