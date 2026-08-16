"""2026/08/16 星さん要望の修正に対する専用テスト。

- メール変更でユーザー名(B列)を上書きしないこと（C列のみ更新）
- 退会エンドポイントが無効化されている（403）こと
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from mt_dashboard_backend.services.user_service import UserService
from mt_dashboard_backend.api.routes import user_routes
from mt_dashboard_backend.api.utils import auth as auth_util


def test_update_user_email_updates_only_email_column():
    """メール変更は C列(メール)のみ更新し、B列(ユーザー名)には触れない。"""
    svc = UserService.__new__(UserService)  # __init__(認証)を回避
    svc._get_sheet_data = lambda rng: [
        ["user_id", "user_name", "email", "password"],
        ["U1", "オレンジデンタルクリニック", "old@example.com", "pw"],
    ]
    calls = {}

    def fake_update(rng, values):
        calls["range"] = rng
        calls["values"] = values
        return True

    svc.update_data = fake_update

    ok = svc.update_user_email("U1", "new-mail@example.com")

    assert ok is True
    # C列(メール)のみを更新している
    assert calls["range"] == "users!C2"
    assert calls["values"] == [["new-mail@example.com"]]
    # B列(ユーザー名)は絶対に触らない（更新範囲は C列単独）
    assert "B" not in calls["range"]
    # 更新値は1セル(メール)のみ＝ユーザー名を巻き込んで書いていない
    assert len(calls["values"]) == 1 and len(calls["values"][0]) == 1


@pytest.fixture
def client_with_user():
    app = FastAPI()
    app.include_router(user_routes.router, prefix="/api/users")

    async def fake_verify(api_key: str = ""):
        return {"user_id": "USER_A", "user_name": "alice", "email": "alice@example.com"}

    app.dependency_overrides[auth_util.verify_api_key] = fake_verify
    return TestClient(app)


def test_deactivate_is_disabled(client_with_user):
    """退会機能は無効化済み。呼ばれても 403 を返し、退会処理は走らない。"""
    resp = client_with_user.post("/api/users/deactivate")
    assert resp.status_code == 403
