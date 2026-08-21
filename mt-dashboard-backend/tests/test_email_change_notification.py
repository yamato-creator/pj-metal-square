"""send_email_change_notification の挙動テスト。

仕様変更 2026/08/21 星さん電話:
  メアド変更時、お客様の「新しいアドレス」に完了メールが届かないケースの保険として、
  新アドレス・旧アドレスの両方に通知し、管理者にも必ず通知する。
"""
import pytest
from unittest.mock import AsyncMock, patch


@pytest.mark.asyncio
async def test_email_change_notifies_new_old_and_admins():
    """変更完了メールを新・旧アドレスの両方へ送り、管理者にも通知する。"""
    from mt_dashboard_backend.api.utils.email import EmailSender

    sender = EmailSender()
    with patch.object(sender, "send_email", new_callable=AsyncMock, return_value=True) as mock_send, \
         patch.object(sender, "send_email_to_all_admins", new_callable=AsyncMock, return_value=True) as mock_admin_send:
        result = await sender.send_email_change_notification(
            old_email="old@example.com",
            new_email="new@example.com",
            user_id="0276583112",
            change_datetime="2026/08/21 10:00:00",
        )
        assert result is True

        # 新・旧の両アドレスに送信されている
        sent_to = {call.args[0] for call in mock_send.call_args_list}
        assert "new@example.com" in sent_to
        assert "old@example.com" in sent_to

        # 管理者通知も送られる（ユーザー送信の成否に依存しない）
        mock_admin_send.assert_awaited_once()


@pytest.mark.asyncio
async def test_email_change_notifies_admins_even_if_user_send_fails():
    """お客様宛の送信が全て失敗しても、管理者への通知は必ず行う。"""
    from mt_dashboard_backend.api.utils.email import EmailSender

    sender = EmailSender()
    with patch.object(sender, "send_email", new_callable=AsyncMock, return_value=False), \
         patch.object(sender, "send_email_to_all_admins", new_callable=AsyncMock, return_value=True) as mock_admin_send:
        result = await sender.send_email_change_notification(
            old_email="old@example.com",
            new_email="new@example.com",
            user_id="0276583112",
            change_datetime="2026/08/21 10:00:00",
        )
        # ユーザー送信は失敗（両方 False）
        assert result is False
        # それでも管理者には通知される
        mock_admin_send.assert_awaited_once()
