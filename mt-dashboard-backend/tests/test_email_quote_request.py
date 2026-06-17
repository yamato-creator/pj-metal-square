"""send_sale_quote_request_email の挙動テスト。

仕様: 見積書 ⑩
  「スクエア様（管理者）にのみ見積もり依頼の通知メールを送信する
   （ユーザーへのメール送信なし）」
"""
import pytest
from unittest.mock import AsyncMock, patch


@pytest.mark.asyncio
async def test_quote_request_email_only_sends_to_admins_not_user():
    """売却見積依頼は管理者のみに送信し、ユーザーには送らない（仕様 ⑩）。"""
    from mt_dashboard_backend.api.utils.email import EmailSender

    sender = EmailSender()
    with patch.object(sender, "send_email", new_callable=AsyncMock, return_value=True) as mock_user_send, \
         patch.object(sender, "send_email_to_all_admins", new_callable=AsyncMock, return_value=True) as mock_admin_send:
        result = await sender.send_sale_quote_request_email(
            user_email="u@example.com",
            username="テスト太郎",
            user_id="0276583112",
            quote_details="金: 10.00g (参考価格 12000円/g)",
            reference_total=120000,
            transaction_id="TRS20260420120000",
        )
        assert result is True

        # ユーザーへは送らない（send_email 単体は呼ばれない）
        mock_user_send.assert_not_awaited()

        # 管理者全員への通知のみ送信
        mock_admin_send.assert_awaited_once()
        admin_args = mock_admin_send.call_args.args
        assert "見積もり依頼" in admin_args[0]
        assert "テスト太郎" in admin_args[1]
        assert "0276583112" in admin_args[1]
        assert "u@example.com" in admin_args[1]
        assert "120,000円" in admin_args[1]
        assert "TRS20260420120000" in admin_args[1]
