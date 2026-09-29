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
        # 2026/09/29 C列(index2)にユーザー名を挿入 → 11列。status=index8, transaction_type=index3
        assert len(row) == 11
        assert row[2] == ""            # C列はシート側 ARRAYFORMULA が埋める（書かない）
        assert row[8] == "見積依頼"    # status
        assert row[3] == "見積依頼"    # transaction_type


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
        assert len(values[0]) == 11
        assert values[0][8] == "申込済"  # status（C列挿入により 7→8）
