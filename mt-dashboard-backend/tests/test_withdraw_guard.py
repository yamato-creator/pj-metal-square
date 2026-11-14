"""現物返却の入力制限（金のみ・50g単位）のテスト。2026/11/14 再開時に追加。"""
import asyncio
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from mt_dashboard_backend.api.routes import transaction_routes as tr
from mt_dashboard_backend.models.transaction import MetalTransaction, WithdrawCreate

USER = {"user_id": "U1", "email": "u@example.com"}


def _req(*metals):
    return WithdrawCreate(
        user_id="U1",
        metals=[MetalTransaction(metal_type=t, amount=a, unit_price=0, total=0) for t, a in metals],
    )


@pytest.mark.parametrize("metals,msg", [
    ((), "指定"),
    ((("銀", 50),), "金のみ"),
    ((("金", 50), ("プラチナ", 50)), "金のみ"),
    ((("金", 30),), "50g単位"),
    ((("金", 75),), "50g単位"),
    ((("金", 0),), "50g単位"),
])
def test_rejects_invalid_withdraw(metals, msg):
    # 不正な入力はサービス層に触れる前に 400 で止まる
    with patch.object(tr, "TransactionService") as ts:
        with pytest.raises(HTTPException) as ei:
            asyncio.run(tr._create_withdraw_transaction(_req(*metals), USER))
    assert ei.value.status_code == 400
    assert msg in ei.value.detail
    ts.assert_not_called()


@pytest.mark.parametrize("amount", [50, 100, 500])
def test_accepts_gold_in_50g_units(amount):
    # 制限を通過したらサービス層まで進む（ここでは保有データなしで 400 になるところまで確認）
    with patch.object(tr, "TransactionService"), \
         patch.object(tr, "EmailSender"), \
         patch.object(tr, "AssetService") as asv:
        asv.return_value.fetch_user_assets_with_validation.return_value = []
        with pytest.raises(HTTPException) as ei:
            asyncio.run(tr._create_withdraw_transaction(_req(("金", amount)), USER))
    assert "保有データが見つかりません" in ei.value.detail
