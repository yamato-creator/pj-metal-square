"""send_sale_quote_request_email の挙動テスト。"""
import pytest
from unittest.mock import AsyncMock, patch


@pytest.mark.asyncio
async def test_quote_request_email_sends_to_user_and_admins():
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

        # ユーザーへ受付メール
        mock_user_send.assert_awaited_once()
        user_args = mock_user_send.call_args.args
        assert user_args[0] == "u@example.com"
        assert "見積もり依頼" in user_args[1]
        assert "TRS20260420120000" in user_args[2]
        assert "120,000円" in user_args[2]

        # 管理者全員への通知
        mock_admin_send.assert_awaited_once()
        admin_args = mock_admin_send.call_args.args
        assert "見積もり依頼" in admin_args[0]
        assert "テスト太郎" in admin_args[1]
        assert "0276583112" in admin_args[1]
        assert "u@example.com" in admin_args[1]
