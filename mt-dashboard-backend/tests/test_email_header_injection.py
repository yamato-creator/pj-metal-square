"""メールヘッダーインジェクション防止テスト。"""
from unittest.mock import patch, AsyncMock

import pytest

from mt_dashboard_backend.api.utils.email import EmailSender


def test_strip_headers_removes_crlf():
    """CR / LF / NUL を to と subject から除去する。"""
    assert EmailSender._strip_headers("foo@x.com\r\nBcc: evil@y.com") == "foo@x.comBcc: evil@y.com"
    assert EmailSender._strip_headers("Subject\nInjected: header") == "SubjectInjected: header"
    assert EmailSender._strip_headers("a\x00b") == "ab"


def test_strip_headers_handles_empty():
    assert EmailSender._strip_headers("") == ""
    assert EmailSender._strip_headers(None) == ""  # type: ignore[arg-type]


@pytest.mark.asyncio
async def test_send_email_sanitizes_to_before_payload(monkeypatch):
    """send_email 経由でも to の CRLF が落ちることを確認。"""
    sender = EmailSender()
    captured = {}

    class FakeResp:
        status_code = 200
        def json(self):
            return {"ok": True}

    class FakeClient:
        async def __aenter__(self):
            return self
        async def __aexit__(self, *a):
            return False
        async def post(self, url, json=None, headers=None):
            captured["payload"] = json
            return FakeResp()

    monkeypatch.setattr("mt_dashboard_backend.api.utils.email.httpx.AsyncClient", lambda *a, **k: FakeClient())
    monkeypatch.delenv("EMAIL_TEST_REDIRECT", raising=False)

    ok = await sender.send_email(
        to="victim@x.com\r\nBcc: attacker@evil",
        subject="hello\r\nFrom: spoofed",
        body="normal body",
    )

    assert ok is True
    assert captured["payload"]["to"] == "victim@x.comBcc: attacker@evil"
    assert captured["payload"]["subject"] == "helloFrom: spoofed"
