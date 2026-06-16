"""user_routes の認可（自分以外のリソース操作を拒否）テスト。"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from mt_dashboard_backend.api.routes import user_routes
from mt_dashboard_backend.api.utils import auth as auth_util


@pytest.fixture
def client_with_user(monkeypatch):
    """current_user=USER_A 固定で認証を通したテストクライアント。"""
    app = FastAPI()
    app.include_router(user_routes.router, prefix="/api/users")

    async def fake_verify(api_key: str = ""):
        return {"user_id": "USER_A", "user_name": "alice", "email": "alice@example.com"}

    app.dependency_overrides[auth_util.verify_api_key] = fake_verify
    return TestClient(app)


def test_get_user_forbids_other_user(client_with_user):
    """USER_A が USER_B のリソースを取得しようとしたら 403。"""
    resp = client_with_user.get("/api/users/USER_B")
    assert resp.status_code == 403


def test_change_password_forbids_other_user(client_with_user):
    """USER_A が他人のパスワードを変更しようとしたら 403。"""
    resp = client_with_user.post(
        "/api/users/change-password",
        json={
            "user_id": "USER_B",
            "old_password": "oldpassword123",
            "new_password": "newpassword123",
        },
    )
    assert resp.status_code == 403


def test_change_email_forbids_other_user(client_with_user):
    """USER_A が他人のメールを変更しようとしたら 403。"""
    resp = client_with_user.post(
        "/api/users/change-email",
        json={
            "user_id": "USER_B",
            "new_email": "evil@example.com",
        },
    )
    assert resp.status_code == 403


def test_verify_password_requires_password_in_body(client_with_user, monkeypatch):
    """verify-password に password を含めなければ 400。"""
    resp = client_with_user.post("/api/users/verify-password", json={})
    assert resp.status_code == 400


def test_change_password_rejects_same_new_old(client_with_user, monkeypatch):
    """新パスワードが旧パスワードと同じなら 400。"""
    # password lookup を bcrypt 化済みのものでモック
    from mt_dashboard_backend.api.utils.password import hash_password
    stored = hash_password("currentpass1")

    class FakeService:
        def fetch_password_hash(self, user_id):
            return stored
        def update_user_password(self, user_id, new_password):
            return True

    monkeypatch.setattr(user_routes, "UserService", lambda: FakeService())
    # EmailSender も置換（404 を出さないため）
    class FakeMailer:
        async def send_password_change_email(self, **kwargs):
            return True
    monkeypatch.setattr(user_routes, "EmailSender", lambda: FakeMailer())

    resp = client_with_user.post(
        "/api/users/change-password",
        json={
            "user_id": "USER_A",
            "old_password": "currentpass1",
            "new_password": "currentpass1",  # 同じ
        },
    )
    assert resp.status_code == 400
