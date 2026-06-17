"""create_user の user_id 衝突防止テスト。"""
from unittest.mock import patch

from mt_dashboard_backend.services.user_service import UserService


def _patch_sheets_io():
    """Sheets API を叩かないようにモック。"""
    return [
        patch.object(UserService, "__init__", lambda self, *a, **k: None),
        patch.object(UserService, "append_data", return_value=True),
    ]


def test_user_id_includes_random_suffix():
    """user_id が JST 秒精度の上に3桁ランダムサフィックスを持つ（同秒内衝突防止）。"""
    patches = _patch_sheets_io()
    for p in patches:
        p.start()
    try:
        svc = UserService()
        created1 = svc.create_user("a@example.com", "Password123!", "api1")
        created2 = svc.create_user("b@example.com", "Password123!", "api2")
        assert created1 is not None
        assert created2 is not None
        # 同秒内でも user_id が同じになる確率は 1/1000
        # 14桁(YYYYMMDDHHMMSS) + 3桁(rand) = 17桁の数字
        assert created1["user_id"].startswith("USER")
        assert len(created1["user_id"]) == len("USER") + 17, created1["user_id"]
    finally:
        for p in patches:
            p.stop()


def test_user_id_starts_with_USER_prefix():
    patches = _patch_sheets_io()
    for p in patches:
        p.start()
    try:
        svc = UserService()
        created = svc.create_user("c@example.com", "Password123!", "api3")
        assert created["user_id"].startswith("USER")
    finally:
        for p in patches:
            p.stop()
