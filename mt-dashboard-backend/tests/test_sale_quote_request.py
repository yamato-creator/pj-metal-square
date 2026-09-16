"""売却エンドポイントのテスト。

2026/9/15 星さん確定により「見積もり依頼」フローを廃止し、元の売却完結フローに戻した。
- /api/transactions/sale は保有資産を減算する
- transactions には transaction_type='売却', status='売却' で記録される
- EmailSender.send_sale_completion_email が呼ばれる（お客様＋管理者）
- 保有量を超える売却は 400 エラー（記録・減算・メールなし）
- 退会済みユーザーは 401 エラー
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient


@pytest.fixture
def fake_user():
    return {
        "user_id": "0276583112",
        "user_name": "テスト太郎",
        "email": "test@example.com",
        "password": "dummy",
    }


@pytest.fixture
def app_with_mocks(fake_user):
    """TestClient + mock化した各サービスを返す。"""
    from fastapi import FastAPI
    from mt_dashboard_backend.api.routes.transaction_routes import router
    from mt_dashboard_backend.api.utils.auth import verify_api_key
    from mt_dashboard_backend.api.utils.access_time import require_business_hours, require_sale_time

    app = FastAPI()
    app.include_router(router, prefix="/api/transactions")
    app.dependency_overrides[verify_api_key] = lambda: fake_user
    # 時間ゲート外でも単体テストは流すために noop に差し替え
    app.dependency_overrides[require_business_hours] = lambda: None
    app.dependency_overrides[require_sale_time] = lambda: None

    return app


def _sale_body():
    return {
        "metals": [
            {"metal_type": "金", "amount": 10.0, "unit_price": 12000, "total": 120000},
            {"metal_type": "プラチナ", "amount": 5.0, "unit_price": 5000, "total": 25000},
        ],
        "total_amount": 145000,
        "tax": 14500,
        "total": 159500,
    }


def test_sale_deducts_assets(app_with_mocks):
    """売却では保有資産の減算（update_asset_after_sale）が呼ばれること。"""
    with patch("mt_dashboard_backend.api.routes.transaction_routes.AssetService") as MockAssetService, \
         patch("mt_dashboard_backend.api.routes.transaction_routes.TransactionService") as MockTransactionService, \
         patch("mt_dashboard_backend.api.routes.transaction_routes.EmailSender") as MockEmailSender:

        asset_service = MockAssetService.return_value
        asset_service.fetch_user_assets_with_validation.return_value = [
            {"metal_type": "金", "weight_g": "100"},
            {"metal_type": "プラチナ", "weight_g": "50"},
        ]
        asset_service.update_asset_after_sale.return_value = True

        transaction_service = MockTransactionService.return_value
        transaction_service.create_transaction.return_value = True
        transaction_service._get_metal_name_jp.side_effect = lambda s: s

        email_sender = MockEmailSender.return_value
        email_sender.send_sale_completion_email = AsyncMock(return_value=True)

        client = TestClient(app_with_mocks)
        resp = client.post("/api/transactions/sale", json=_sale_body(), headers={"X-API-Key": "x"})

        assert resp.status_code == 200, resp.text
        assert resp.json()["status"] == "success"
        assert resp.json()["message"] == "売却処理が完了しました"
        # 2金属分の資産減算が呼ばれる
        assert asset_service.update_asset_after_sale.call_count == 2
        # 金: 100 - 10 = 90 / プラチナ: 50 - 5 = 45
        called_new_amounts = {
            (c.args[1]): c.args[2] for c in asset_service.update_asset_after_sale.call_args_list
        }
        assert called_new_amounts["金"] == pytest.approx(90.0)
        assert called_new_amounts["プラチナ"] == pytest.approx(45.0)


def test_sale_records_with_sale_status(app_with_mocks):
    """transactionsレコードが transaction_type=売却, status=売却 で記録される。"""
    with patch("mt_dashboard_backend.api.routes.transaction_routes.AssetService") as MockAssetService, \
         patch("mt_dashboard_backend.api.routes.transaction_routes.TransactionService") as MockTransactionService, \
         patch("mt_dashboard_backend.api.routes.transaction_routes.EmailSender") as MockEmailSender:

        asset_service = MockAssetService.return_value
        asset_service.fetch_user_assets_with_validation.return_value = [
            {"metal_type": "金", "weight_g": "100"},
            {"metal_type": "プラチナ", "weight_g": "50"},
        ]
        asset_service.update_asset_after_sale.return_value = True
        transaction_service = MockTransactionService.return_value
        transaction_service.create_transaction.return_value = True
        transaction_service._get_metal_name_jp.side_effect = lambda s: s
        MockEmailSender.return_value.send_sale_completion_email = AsyncMock(return_value=True)

        client = TestClient(app_with_mocks)
        resp = client.post("/api/transactions/sale", json=_sale_body(), headers={"X-API-Key": "x"})
        assert resp.status_code == 200, resp.text

        # 呼び出し引数を検証
        assert transaction_service.create_transaction.call_count == 2  # 金 + プラチナ
        for call in transaction_service.create_transaction.call_args_list:
            (arg,) = call.args
            assert arg["transaction_type"] == "売却"
            assert arg["status"] == "売却"


def test_sale_sends_completion_email(app_with_mocks, fake_user):
    """売却完了メールが呼ばれる（お客様＋管理者へ send_sale_completion_email）。"""
    with patch("mt_dashboard_backend.api.routes.transaction_routes.AssetService") as MockAssetService, \
         patch("mt_dashboard_backend.api.routes.transaction_routes.TransactionService") as MockTransactionService, \
         patch("mt_dashboard_backend.api.routes.transaction_routes.EmailSender") as MockEmailSender:

        asset_service = MockAssetService.return_value
        asset_service.fetch_user_assets_with_validation.return_value = [
            {"metal_type": "金", "weight_g": "100"},
            {"metal_type": "プラチナ", "weight_g": "50"},
        ]
        asset_service.update_asset_after_sale.return_value = True
        transaction_service = MockTransactionService.return_value
        transaction_service.create_transaction.return_value = True
        transaction_service._get_metal_name_jp.side_effect = lambda s: s
        email_sender = MockEmailSender.return_value
        email_sender.send_sale_completion_email = AsyncMock(return_value=True)

        client = TestClient(app_with_mocks)
        resp = client.post("/api/transactions/sale", json=_sale_body(), headers={"X-API-Key": "x"})
        assert resp.status_code == 200, resp.text

        email_sender.send_sale_completion_email.assert_awaited_once()
        kwargs = email_sender.send_sale_completion_email.call_args.kwargs
        assert kwargs["user_email"] == fake_user["email"]
        assert kwargs["total_amount"] == 145000
        assert kwargs["tax"] == 14500
        assert kwargs["total"] == 159500
        # 2金属分が売却内容に含まれる
        assert "金" in kwargs["sales_details"]
        assert "プラチナ" in kwargs["sales_details"]


def test_sale_rejects_amount_over_holdings(app_with_mocks):
    """保有量を超える売却は 400 エラー（記録・減算・メールなし）。"""
    with patch("mt_dashboard_backend.api.routes.transaction_routes.AssetService") as MockAssetService, \
         patch("mt_dashboard_backend.api.routes.transaction_routes.TransactionService") as MockTransactionService, \
         patch("mt_dashboard_backend.api.routes.transaction_routes.EmailSender") as MockEmailSender:

        asset_service = MockAssetService.return_value
        asset_service.fetch_user_assets_with_validation.return_value = [
            {"metal_type": "金", "weight_g": "5"},  # 10g 希望しているが 5g しかない
            {"metal_type": "プラチナ", "weight_g": "50"},
        ]
        asset_service.update_asset_after_sale.return_value = True
        transaction_service = MockTransactionService.return_value
        transaction_service.create_transaction.return_value = True
        MockEmailSender.return_value.send_sale_completion_email = AsyncMock()

        client = TestClient(app_with_mocks)
        resp = client.post("/api/transactions/sale", json=_sale_body(), headers={"X-API-Key": "x"})
        assert resp.status_code == 400
        # 事前チェックで弾くため、記録・減算・メールいずれも呼ばれないこと
        transaction_service.create_transaction.assert_not_called()
        asset_service.update_asset_after_sale.assert_not_called()
        MockEmailSender.return_value.send_sale_completion_email.assert_not_awaited()


def test_sale_rejects_deactivated_user(app_with_mocks):
    """退会済みユーザーは 401 エラー。"""
    with patch("mt_dashboard_backend.api.routes.transaction_routes.AssetService") as MockAssetService, \
         patch("mt_dashboard_backend.api.routes.transaction_routes.TransactionService") as MockTransactionService, \
         patch("mt_dashboard_backend.api.routes.transaction_routes.EmailSender") as MockEmailSender:

        MockAssetService.return_value.fetch_user_assets_with_validation.return_value = None
        MockEmailSender.return_value.send_sale_completion_email = AsyncMock()

        client = TestClient(app_with_mocks)
        resp = client.post("/api/transactions/sale", json=_sale_body(), headers={"X-API-Key": "x"})
        assert resp.status_code == 401
        MockTransactionService.return_value.create_transaction.assert_not_called()


def test_sale_rolls_back_assets_when_second_metal_fails(app_with_mocks):
    """途中の金属で取引記録が失敗したら、減算済みの資産を元に戻すこと（500）。"""
    with patch("mt_dashboard_backend.api.routes.transaction_routes.AssetService") as MockAssetService, \
         patch("mt_dashboard_backend.api.routes.transaction_routes.TransactionService") as MockTransactionService, \
         patch("mt_dashboard_backend.api.routes.transaction_routes.EmailSender") as MockEmailSender:

        asset_service = MockAssetService.return_value
        asset_service.fetch_user_assets_with_validation.return_value = [
            {"metal_type": "金", "weight_g": "100"},
            {"metal_type": "プラチナ", "weight_g": "50"},
        ]
        asset_service.update_asset_after_sale.return_value = True

        transaction_service = MockTransactionService.return_value
        # 金=成功, プラチナ=失敗
        transaction_service.create_transaction.side_effect = [True, False]
        transaction_service._get_metal_name_jp.side_effect = lambda s: s
        MockEmailSender.return_value.send_sale_completion_email = AsyncMock()

        client = TestClient(app_with_mocks)
        resp = client.post("/api/transactions/sale", json=_sale_body(), headers={"X-API-Key": "x"})
        assert resp.status_code == 500

        # 金を 90 に減算後、失敗を検知して 100 に戻す呼び出しが入っていること
        calls = [(c.args[1], c.args[2]) for c in asset_service.update_asset_after_sale.call_args_list]
        assert ("金", pytest.approx(90.0)) in [(m, pytest.approx(v)) for m, v in calls]
        assert calls[-1][0] == "金"
        assert calls[-1][1] == pytest.approx(100.0)  # ロールバックで原状復帰
        # メールは送られない
        MockEmailSender.return_value.send_sale_completion_email.assert_not_awaited()


def test_sale_aggregates_same_metal_for_holding_check(app_with_mocks):
    """同一金属を複数行で送っても、合計が保有量を超えれば 400（記録・減算なし）。"""
    with patch("mt_dashboard_backend.api.routes.transaction_routes.AssetService") as MockAssetService, \
         patch("mt_dashboard_backend.api.routes.transaction_routes.TransactionService") as MockTransactionService, \
         patch("mt_dashboard_backend.api.routes.transaction_routes.EmailSender") as MockEmailSender:

        asset_service = MockAssetService.return_value
        asset_service.fetch_user_assets_with_validation.return_value = [
            {"metal_type": "金", "weight_g": "15"},  # 保有15g
        ]
        asset_service.update_asset_after_sale.return_value = True
        transaction_service = MockTransactionService.return_value
        transaction_service.create_transaction.return_value = True
        MockEmailSender.return_value.send_sale_completion_email = AsyncMock()

        body = {
            "metals": [
                {"metal_type": "金", "amount": 10.0, "unit_price": 12000, "total": 120000},
                {"metal_type": "金", "amount": 10.0, "unit_price": 12000, "total": 120000},
            ],
            "total_amount": 240000,
            "tax": 24000,
            "total": 264000,
        }
        client = TestClient(app_with_mocks)
        resp = client.post("/api/transactions/sale", json=body, headers={"X-API-Key": "x"})
        assert resp.status_code == 400  # 10+10=20 > 15
        transaction_service.create_transaction.assert_not_called()
        asset_service.update_asset_after_sale.assert_not_called()
