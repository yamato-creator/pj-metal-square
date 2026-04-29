"""EMAIL_TEST_REDIRECT のテスト。E2E安全装置。"""
import os
import pytest
from unittest.mock import AsyncMock, patch


@pytest.mark.asyncio
async def test_send_email_uses_redirect_when_env_set(monkeypatch):
    """環境変数が設定されていれば、宛先がリダイレクトされ件名にプレフィックス付与。"""
    from mt_dashboard_backend.api.utils.email import EmailSender

    monkeypatch.setenv("EMAIL_TEST_REDIRECT", "redirect@example.com")

    sender = EmailSender()
    captured = {}

    class FakeResp:
        status_code = 200

    async def fake_post(url, json, headers):
        captured["payload"] = json
        return FakeResp()

    class FakeClient:
        async def __aenter__(self):
            return self
        async def __aexit__(self, exc_type, exc, tb):
            return False
        async def post(self, url, json, headers):
            return await fake_post(url, json, headers)

    with patch("mt_dashboard_backend.api.utils.email.httpx.AsyncClient", return_value=FakeClient()):
        ok = await sender.send_email("user@example.com", "件名", "本文")

    assert ok is True
    assert captured["payload"]["to"] == "redirect@example.com"
    assert "[E2E→user@example.com]" in captured["payload"]["subject"]
    assert "件名" in captured["payload"]["subject"]
    assert "本来の宛先は user@example.com" in captured["payload"]["body"]


@pytest.mark.asyncio
async def test_send_email_normal_when_env_unset(monkeypatch):
    """環境変数が無い場合は通常動作（宛先そのまま、件名そのまま）。"""
    from mt_dashboard_backend.api.utils.email import EmailSender

    monkeypatch.delenv("EMAIL_TEST_REDIRECT", raising=False)

    sender = EmailSender()
    captured = {}

    class FakeResp:
        status_code = 200

    async def fake_post(url, json, headers):
        captured["payload"] = json
        return FakeResp()

    class FakeClient:
        async def __aenter__(self):
            return self
        async def __aexit__(self, exc_type, exc, tb):
            return False
        async def post(self, url, json, headers):
            return await fake_post(url, json, headers)

    with patch("mt_dashboard_backend.api.utils.email.httpx.AsyncClient", return_value=FakeClient()):
        await sender.send_email("user@example.com", "件名", "本文")

    assert captured["payload"]["to"] == "user@example.com"
    assert captured["payload"]["subject"] == "件名"
    assert captured["payload"]["body"] == "本文"
