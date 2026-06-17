"""metal_routes の認可テスト：自分の user_id 以外の資産アクセスを拒否する。"""
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from mt_dashboard_backend.main import app
from mt_dashboard_backend.api.utils.auth import verify_api_key


@pytest.fixture
def client_as_userA():
    def _fake_verify():
        return {"user_id": "USER_A_001", "user_name": "A", "email": "a@example.com"}

    app.dependency_overrides[verify_api_key] = _fake_verify
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.pop(verify_api_key, None)


def test_get_other_user_assets_returns_403(client_as_userA):
    """USER_A_001 が USER_B_999 の資産を取りに行くと 403"""
    resp = client_as_userA.get("/api/user/USER_B_999/assets")
    assert resp.status_code == 403, resp.text
    assert "他のユーザーの資産は取得できません" in resp.text


def test_get_own_assets_passes_authz(client_as_userA):
    """自分の user_id の資産はサービス層まで到達（戻り値の内容は問わない）。"""
    with patch(
        "mt_dashboard_backend.services.asset_service.AssetService.fetch_user_assets_with_validation",
        return_value=[],
    ):
        resp = client_as_userA.get("/api/user/USER_A_001/assets")
    # 認可は通り、resource 層で 404 になることを確認（403 で止まっていないこと）
    assert resp.status_code in (404, 200), resp.text
