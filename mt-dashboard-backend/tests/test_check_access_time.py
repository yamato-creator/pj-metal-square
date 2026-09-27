"""/api/check-access-time のテスト。2026/09/26 星さん要望②。

- 24時間開放: メンテナンスOFFなら深夜でも is_allowed=True（旧10:00〜24:00制限は撤廃）
- メンテナンスONなら is_allowed=False で、settings!B3 の文言を返す
- レスポンス形はフロント（TimeRestrictedApp）互換
"""
from datetime import datetime
from zoneinfo import ZoneInfo
from unittest.mock import patch, MagicMock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from mt_dashboard_backend.api.routes import time_restriction_routes as tr

JST = ZoneInfo("Asia/Tokyo")


def _client_and_mock(maintenance: bool, message: str = "メンテ中です"):
    app = FastAPI()
    app.include_router(tr.router, prefix="/api")
    m = MagicMock()
    m.is_maintenance.return_value = maintenance
    m.maintenance_message.return_value = message
    return TestClient(app), m


def test_allowed_when_maintenance_off():
    client, m = _client_and_mock(False)
    with patch.object(tr, "SettingsService", return_value=m):
        r = client.get("/api/check-access-time")
    assert r.status_code == 200
    body = r.json()
    assert body["is_allowed"] is True
    assert body["maintenance"] is False
    assert body["message"] == "アクセス可能"
    # フロント互換キーが揃っていること
    for k in ("current_time", "current_hour", "allowed_hours", "message"):
        assert k in body


def test_blocked_when_maintenance_on_with_custom_message():
    client, m = _client_and_mock(True, "本日18時までメンテナンスです")
    with patch.object(tr, "SettingsService", return_value=m):
        body = client.get("/api/check-access-time").json()
    assert body["is_allowed"] is False
    assert body["maintenance"] is True
    assert body["message"] == "本日18時までメンテナンスです"


def test_open_24h_no_clock_gating_at_3am():
    """深夜3時でもメンテOFFなら許可（旧10:00〜24:00の時間制限が無いこと）。"""
    client, m = _client_and_mock(False)
    fake_now = datetime(2026, 9, 27, 3, 0, 0, tzinfo=JST)
    with patch.object(tr, "SettingsService", return_value=m), \
         patch.object(tr, "now_jst", return_value=fake_now):
        body = client.get("/api/check-access-time").json()
    assert body["is_allowed"] is True
    assert body["current_hour"] == 3
