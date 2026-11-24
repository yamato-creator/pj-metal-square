import asyncio
from mt_dashboard_backend.api.utils.email import EmailSender


def test_admin_password_change_mail_shows_username_not_email(monkeypatch):
    sent = {}
    sender = EmailSender.__new__(EmailSender)

    async def fake_send(to, subject, body):
        return True

    async def fake_admins(subject, body):
        sent["body"] = body

    monkeypatch.setattr(sender, "send_email", fake_send, raising=False)
    monkeypatch.setattr(sender, "send_email_to_all_admins", fake_admins, raising=False)
    asyncio.run(sender.send_password_change_email(
        user_email="user@example.com", change_datetime="2026-11-24 14:17:36", username="テスト太郎"))
    assert "ユーザー名: テスト太郎" in sent["body"]
    assert "user@example.com" not in sent["body"]
