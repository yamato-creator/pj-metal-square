"""create_transaction が status 引数を尊重することの単体テスト。"""
from unittest.mock import patch, MagicMock


def test_create_transaction_uses_custom_status():
    """transaction_data に status を渡すとそれがシートに書き込まれる。"""
    from mt_dashboard_backend.services.transaction_service import TransactionService

    svc = TransactionService()
    with patch.object(svc, "append_data", return_value={"updates": {}}) as mock_append:
        result = svc.create_transaction({
            "user_id": "0000000001",
            "transaction_type": "見積依頼",
            "metal_type": "Au",
            "weight_g": "10",
            "unit_price": "12000",
            "total_amount": "120000",
            "transaction_id": "TRS20260420120000",
            "company_name": "スクエア",
            "status": "見積依頼",
        })
        assert result is True
        values = mock_append.call_args.args[2]
        row = values[0]
        # status列(インデックス7)が「見積依頼」であること
        assert row[7] == "見積依頼"
        # transaction_type(インデックス2)
        assert row[2] == "見積依頼"


def test_create_transaction_defaults_to_moushikomi_zumi():
    """status を渡さない場合は従来通り「申込済」になること。"""
    from mt_dashboard_backend.services.transaction_service import TransactionService

    svc = TransactionService()
    with patch.object(svc, "append_data", return_value={"updates": {}}) as mock_append:
        svc.create_transaction({
            "user_id": "0000000001",
            "transaction_type": "預入",
            "metal_type": "Au",
            "weight_g": "10",
            "unit_price": "0",
            "total_amount": "0",
            "transaction_id": "TRS20260420120000",
            "company_name": "スクエア",
        })
        values = mock_append.call_args.args[2]
        assert values[0][7] == "申込済"
