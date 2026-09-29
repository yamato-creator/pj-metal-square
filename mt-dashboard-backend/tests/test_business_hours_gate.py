"""require_business_hours（預入/現物返却/取消のゲート）のテスト。2026/09/29。

受け入れ検証で「売却は相場更新後(例09:53)に開くが、取消/預入/返却は10:00固定のため
09:53〜10:00 は売れるが取消せない」ギャップを検出 → 売却ウィンドウが開いている間は
こちらも許可するよう変更。10:00〜24:00 の従来ルールは維持。
"""
from datetime import datetime
from zoneinfo import ZoneInfo
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from mt_dashboard_backend.api.utils import access_time

JST = ZoneInfo("Asia/Tokyo")


def _run(now_dt, update_str):
    with patch.object(access_time, "now_jst", return_value=now_dt), \
         patch("mt_dashboard_backend.services.metal_service.MetalService") as MockMS:
        MockMS.return_value.fetch_price_update_time.return_value = update_str
        try:
            access_time.require_business_hours()
            return True
        except HTTPException as e:
            assert e.status_code == 403
            return False


def test_pre_10_allowed_when_sale_window_open():
    # 09:55、当日09:53に相場更新済み → 売却窓が開いているので取消/預入も許可（ギャップ解消）
    assert _run(datetime(2026, 9, 29, 9, 55, tzinfo=JST), "2026-09-29 09:53:00") is True


def test_pre_10_blocked_when_no_update_yet():
    # 09:55、まだ当日の更新なし（前日の値）→ 従来どおり不可
    assert _run(datetime(2026, 9, 29, 9, 55, tzinfo=JST), "2026-09-28 14:23:00") is False


def test_deep_night_blocked():
    # 03:00 → 不可（売却窓も閉、10〜24時にも入らない）
    assert _run(datetime(2026, 9, 29, 3, 0, tzinfo=JST), "2026-09-28 14:23:00") is False


def test_after_10_allowed_regardless_of_price_update():
    # 13:00（売却窓は12:30で閉）でも 10〜24時ルールで許可 = 従来動作を維持
    assert _run(datetime(2026, 9, 29, 13, 0, tzinfo=JST), "2026-09-29 09:53:00") is True


def test_after_10_allowed_even_if_price_fetch_fails():
    # 価格が取れない日でも 10〜24時なら従来どおり許可（安全側に倒しすぎない）
    assert _run(datetime(2026, 9, 29, 15, 0, tzinfo=JST), "") is True
