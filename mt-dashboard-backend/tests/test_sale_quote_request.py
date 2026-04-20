"""⑩ 売却エンドポイントを見積もり依頼仕様に変更した際のテスト。

- /api/transactions/sale は資産を減算しない
- transactions には transaction_type='見積依頼', status='見積依頼' で記録される
- EmailSender.send_sale_quote_request_email が呼ばれる
- 保有量を超える依頼は 400 エラー
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

    app = FastAPI()
    app.include_router(router, prefix="/api/transactions")
    app.dependency_overrides[verify_api_key] = lambda: fake_user

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


def test_sale_does_not_deduct_assets(app_with_mocks):
    """見積もり依頼では資産減算が呼ばれないこと。"""
    with patch("mt_dashboard_backend.api.routes.transaction_routes.AssetService") as MockAssetService, \
         patch("mt_dashboard_backend.api.routes.transaction_routes.TransactionService") as MockTransactionService, \
         patch("mt_dashboard_backend.api.routes.transaction_routes.EmailSender") as MockEmailSender:

        asset_service = MockAssetService.return_value
        asset_service.fetch_user_assets_with_validation.return_value = [
            {"metal_type": "金", "weight_g": "100"},
            {"metal_type": "プラチナ", "weight_g": "50"},
        ]
        asset_service.update_asset_after_sale = MagicMock()

        transaction_service = MockTransactionService.return_value
        transaction_service.create_transaction.return_value = True
        transaction_service._get_metal_name_jp.side_effect = lambda s: s

        email_sender = MockEmailSender.return_value
        email_sender.send_sale_quote_request_email = AsyncMock(return_value=True)

        client = TestClient(app_with_mocks)
        resp = client.post("/api/transactions/sale", json=_sale_body(), headers={"X-API-Key": "x"})

        assert resp.status_code == 200, resp.text
        assert resp.json()["status"] == "success"
        assert resp.json()["message"] == "見積もり依頼を受け付けました"
        # 資産減算は呼ばれない
        asset_service.update_asset_after_sale.assert_not_called()


def test_sale_records_with_quote_request_status(app_with_mocks):
    """transactionsレコードが transaction_type=見積依頼, status=見積依頼 で記録される。"""
    with patch("mt_dashboard_backend.api.routes.transaction_routes.AssetService") as MockAssetService, \
         patch("mt_dashboard_backend.api.routes.transaction_routes.TransactionService") as MockTransactionService, \
         patch("mt_dashboard_backend.api.routes.transaction_routes.EmailSender") as MockEmailSender:

        MockAssetService.return_value.fetch_user_assets_with_validation.return_value = [
            {"metal_type": "金", "weight_g": "100"},
            {"metal_type": "プラチナ", "weight_g": "50"},
        ]
        transaction_service = MockTransactionService.return_value
        transaction_service.create_transaction.return_value = True
        transaction_service._get_metal_name_jp.side_effect = lambda s: s
        MockEmailSender.return_value.send_sale_quote_request_email = AsyncMock(return_value=True)

        client = TestClient(app_with_mocks)
        resp = client.post("/api/transactions/sale", json=_sale_body(), headers={"X-API-Key": "x"})
        assert resp.status_code == 200, resp.text

        # 呼び出し引数を検証
        assert transaction_service.create_transaction.call_count == 2  # 金 + プラチナ
        for call in transaction_service.create_transaction.call_args_list:
            (arg,) = call.args
            assert arg["transaction_type"] == "見積依頼"
            assert arg["status"] == "見積依頼"


def test_sale_sends_quote_request_email(app_with_mocks, fake_user):
    """ユーザー宛 + 管理者宛の見積もり依頼メールが呼ばれる。"""
    with patch("mt_dashboard_backend.api.routes.transaction_routes.AssetService") as MockAssetService, \
         patch("mt_dashboard_backend.api.routes.transaction_routes.TransactionService") as MockTransactionService, \
         patch("mt_dashboard_backend.api.routes.transaction_routes.EmailSender") as MockEmailSender:

        MockAssetService.return_value.fetch_user_assets_with_validation.return_value = [
            {"metal_type": "金", "weight_g": "100"},
            {"metal_type": "プラチナ", "weight_g": "50"},
        ]
        transaction_service = MockTransactionService.return_value
        transaction_service.create_transaction.return_value = True
        transaction_service._get_metal_name_jp.side_effect = lambda s: s
        email_sender = MockEmailSender.return_value
        email_sender.send_sale_quote_request_email = AsyncMock(return_value=True)

        client = TestClient(app_with_mocks)
        resp = client.post("/api/transactions/sale", json=_sale_body(), headers={"X-API-Key": "x"})
        assert resp.status_code == 200, resp.text

        email_sender.send_sale_quote_request_email.assert_awaited_once()
        kwargs = email_sender.send_sale_quote_request_email.call_args.kwargs
        assert kwargs["user_email"] == fake_user["email"]
        assert kwargs["username"] == fake_user["user_name"]
        assert kwargs["user_id"] == fake_user["user_id"]
        assert kwargs["reference_total"] == 145000
        # 2金属分が依頼詳細に含まれる
        assert "金" in kwargs["quote_details"]
        assert "プラチナ" in kwargs["quote_details"]


def test_sale_rejects_amount_over_holdings(app_with_mocks):
    """保有量を超える売却希望は 400 エラー。"""
    with patch("mt_dashboard_backend.api.routes.transaction_routes.AssetService") as MockAssetService, \
         patch("mt_dashboard_backend.api.routes.transaction_routes.TransactionService") as MockTransactionService, \
         patch("mt_dashboard_backend.api.routes.transaction_routes.EmailSender") as MockEmailSender:

        MockAssetService.return_value.fetch_user_assets_with_validation.return_value = [
            {"metal_type": "金", "weight_g": "5"},  # 10g 希望しているが 5g しかない
            {"metal_type": "プラチナ", "weight_g": "50"},
        ]
        transaction_service = MockTransactionService.return_value
        transaction_service.create_transaction.return_value = True
        MockEmailSender.return_value.send_sale_quote_request_email = AsyncMock()

        client = TestClient(app_with_mocks)
        resp = client.post("/api/transactions/sale", json=_sale_body(), headers={"X-API-Key": "x"})
        assert resp.status_code == 400
        # transaction も email も呼ばれないこと
        transaction_service.create_transaction.assert_not_called()
        MockEmailSender.return_value.send_sale_quote_request_email.assert_not_awaited()


def test_sale_rejects_deactivated_user(app_with_mocks):
    """退会済みユーザーは 401 エラー。"""
    with patch("mt_dashboard_backend.api.routes.transaction_routes.AssetService") as MockAssetService, \
         patch("mt_dashboard_backend.api.routes.transaction_routes.TransactionService") as MockTransactionService, \
         patch("mt_dashboard_backend.api.routes.transaction_routes.EmailSender") as MockEmailSender:

        MockAssetService.return_value.fetch_user_assets_with_validation.return_value = None
        MockEmailSender.return_value.send_sale_quote_request_email = AsyncMock()

        client = TestClient(app_with_mocks)
        resp = client.post("/api/transactions/sale", json=_sale_body(), headers={"X-API-Key": "x"})
        assert resp.status_code == 401
        MockTransactionService.return_value.create_transaction.assert_not_called()
