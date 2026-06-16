"""login の bcrypt 検証 + 平文→ハッシュ自動マイグレーションのテスト。"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from mt_dashboard_backend.api.routes import auth_routes
from mt_dashboard_backend.api.utils.password import hash_password


@pytest.fixture
def app_client():
    app = FastAPI()
    app.include_router(auth_routes.router, prefix="/api/users")
    return TestClient(app)


def _make_service_mock(stored_password: str, capture: dict):
    """UserService をモックし、fetch_password_hash / update_user_password_hash を制御する。"""

    class FakeUserService:
        def fetch_user_by_id(self, user_id, include_password=False):
            return {
                "user_id": user_id,
                "user_name": "alice",
                "email": "alice@example.com",
                "api_key": "fake-api-key",
                "is_deleted": False,
            }
        def fetch_password_hash(self, user_id):
            return capture.get("stored", stored_password)
        def update_user_password_hash(self, user_id, new_hash):
            capture["migrated_hash"] = new_hash
            capture["stored"] = new_hash
            return True

    return FakeUserService


def test_login_succeeds_with_bcrypt_hash(monkeypatch, app_client):
    capture = {}
    stored = hash_password("correct-pass!")
    monkeypatch.setattr(auth_routes, "UserService", _make_service_mock(stored, capture))

    resp = app_client.post(
        "/api/users/login",
        json={"user_id": "USER_A", "password": "correct-pass!"},
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["user"]["user_id"] == "USER_A"
    # 既にハッシュ済みなのでマイグレ発生しない
    assert "migrated_hash" not in capture


def test_login_fails_with_wrong_password(monkeypatch, app_client):
    capture = {}
    stored = hash_password("correct-pass!")
    monkeypatch.setattr(auth_routes, "UserService", _make_service_mock(stored, capture))

    resp = app_client.post(
        "/api/users/login",
        json={"user_id": "USER_A", "password": "wrong-pass"},
    )
    assert resp.status_code == 401


def test_login_with_plaintext_password_triggers_auto_migration(monkeypatch, app_client):
    """既存DBの平文パスワードでも login 可能、かつ即時に bcrypt ハッシュへ移行する。"""
    capture = {}
    monkeypatch.setattr(
        auth_routes, "UserService", _make_service_mock("legacyplain123", capture)
    )

    resp = app_client.post(
        "/api/users/login",
        json={"user_id": "USER_A", "password": "legacyplain123"},
    )
    assert resp.status_code == 200
    # 平文 → bcrypt ハッシュへ移行されたことを確認
    assert "migrated_hash" in capture
    assert capture["migrated_hash"].startswith("$2b$") or capture["migrated_hash"].startswith("$2a$")
