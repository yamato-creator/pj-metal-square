"""send_sale_completion_email の挙動テスト（2026/09/16 星さん要望A）。

- お客様へ売却完了メールを送る
- 管理者宛メールに「誰が売却したか」（ユーザー名/ID/メール）が含まれる
- 配信先(admin_emails)に小倉のアドレスが含まれる
"""
import pytest
from unittest.mock import AsyncMock, patch


@pytest.mark.asyncio
async def test_sale_completion_email_includes_user_info_for_admin():
    from mt_dashboard_backend.api.utils.email import EmailSender

    sender = EmailSender()
    with patch.object(sender, "send_email", new_callable=AsyncMock, return_value=True) as mock_user_send, \
         patch.object(sender, "send_email_to_all_admins", new_callable=AsyncMock, return_value=True) as mock_admin_send:
        result = await sender.send_sale_completion_email(
            user_email="u@example.com",
            sales_details="金: 0.01g (21330円/g)",
            total_amount=213,
            tax=21,
            total=234,
            username="テスト太郎",
            user_id="0276583112",
        )
        assert result is True

        # お客様へは送信される
        mock_user_send.assert_awaited_once()
        assert mock_user_send.call_args.args[0] == "u@example.com"

        # 管理者宛に「誰が売却したか」が含まれる
        mock_admin_send.assert_awaited_once()
        admin_body = mock_admin_send.call_args.args[1]
        assert "テスト太郎" in admin_body
        assert "0276583112" in admin_body
        assert "u@example.com" in admin_body
        assert "0.01g" in admin_body


def test_ogura_in_admin_emails():
    """配信先に小倉のアドレスが含まれる。"""
    from mt_dashboard_backend.api.utils.email import EmailSender
    sender = EmailSender()
    assert "ogura.yamato123@gmail.com" in sender.admin_emails
