"""現物返却の受付時間（10:00〜12:30 / 14:30〜15:30）の単体テスト。"""
from datetime import datetime
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from mt_dashboard_backend.api.utils.access_time import (
    is_withdraw_allowed_now,
    require_withdraw_time,
)


def _at(h, m, s=0):
    return patch(
        "mt_dashboard_backend.api.utils.access_time.now_jst",
        return_value=datetime(2026, 11, 16, h, m, s),
    )


@pytest.mark.parametrize("h,m,s", [
    (10, 0, 0), (11, 59, 59), (12, 30, 0), (12, 30, 59),
    (14, 30, 0), (15, 0, 0), (15, 30, 59),
])
def test_allowed(h, m, s):
    with _at(h, m, s):
        assert is_withdraw_allowed_now() is True
        require_withdraw_time()


@pytest.mark.parametrize("h,m,s", [
    (9, 59, 59), (12, 31, 0), (13, 0, 0), (14, 29, 59),
    (15, 31, 0), (18, 0, 0), (23, 0, 0), (0, 0, 0),
])
def test_rejected(h, m, s):
    with _at(h, m, s):
        assert is_withdraw_allowed_now() is False
        with pytest.raises(HTTPException) as e:
            require_withdraw_time()
        assert e.value.status_code == 403


def test_withdraw_route_uses_withdraw_gate():
    from mt_dashboard_backend.api.routes import transaction_routes as tr
    import inspect
    src = inspect.getsource(tr.create_withdraw_transaction)
    assert "require_withdraw_time" in src
    assert "require_business_hours" not in src
