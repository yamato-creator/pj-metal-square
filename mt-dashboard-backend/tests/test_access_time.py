"""アクセス時間判定ユーティリティの単体テスト。"""
from datetime import datetime
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from mt_dashboard_backend.api.utils.access_time import (
    is_within_business_hours,
    require_business_hours,
)


def _fake_jst(hour: int, minute: int = 0, second: int = 0):
    """JSTの now を固定する patch を返す。"""
    return patch(
        "mt_dashboard_backend.api.utils.access_time.now_jst",
        return_value=datetime(2026, 6, 17, hour, minute, second),
    )


def test_allows_at_10_00_00():
    with _fake_jst(10, 0, 0):
        assert is_within_business_hours() is True


def test_allows_at_23_59_59():
    with _fake_jst(23, 59, 59):
        assert is_within_business_hours() is True


def test_allows_at_midnight_exactly():
    with _fake_jst(0, 0, 0):
        assert is_within_business_hours() is True


def test_rejects_at_00_00_01():
    with _fake_jst(0, 0, 1):
        assert is_within_business_hours() is False


def test_rejects_at_09_59_59():
    with _fake_jst(9, 59, 59):
        assert is_within_business_hours() is False


def test_rejects_at_05_00_00():
    with _fake_jst(5, 0, 0):
        assert is_within_business_hours() is False


def test_require_business_hours_raises_outside():
    with _fake_jst(3, 0, 0):
        with pytest.raises(HTTPException) as exc:
            require_business_hours()
        assert exc.value.status_code == 403


def test_require_business_hours_passes_inside():
    with _fake_jst(15, 0, 0):
        # 例外が出ないこと
        require_business_hours()
