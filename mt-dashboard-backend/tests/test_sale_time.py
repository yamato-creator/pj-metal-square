"""売却専用の時間ゲート is_sale_allowed_now のテスト（2026/09/16 星さん要望）。

仕様: 午前＝相場更新後〜12:30 / 午後＝相場更新後〜15:30。
更新前・当日でない・締め超過・形式不明は不可（安全側）。
"""
from datetime import datetime
from zoneinfo import ZoneInfo
from unittest.mock import patch

from mt_dashboard_backend.api.utils import access_time

JST = ZoneInfo("Asia/Tokyo")


def _run(update_str, now_dt):
    with patch("mt_dashboard_backend.services.metal_service.MetalService") as MockMS, \
         patch.object(access_time, "now_jst", return_value=now_dt):
        MockMS.return_value.fetch_price_update_time.return_value = update_str
        return access_time.is_sale_allowed_now()


def test_morning_within_window():
    # 9:57更新、10:30 → 午前の窓内
    assert _run("2026-09-16 09:57:00", datetime(2026, 9, 16, 10, 30, tzinfo=JST)) is True


def test_morning_boundary_1230_ok():
    # ちょうど12:30はOK
    assert _run("2026-09-16 09:57:00", datetime(2026, 9, 16, 12, 30, tzinfo=JST)) is True


def test_morning_after_close():
    # 12:31 → 午前の締め超過で不可
    assert _run("2026-09-16 09:57:00", datetime(2026, 9, 16, 12, 31, tzinfo=JST)) is False


def test_before_update():
    # 更新(9:57)より前(9:50)は不可
    assert _run("2026-09-16 09:57:00", datetime(2026, 9, 16, 9, 50, tzinfo=JST)) is False


def test_gap_between_am_and_pm():
    # 午前更新のまま13:00 → 12:30超過で不可（午後更新が来るまで閉じる）
    assert _run("2026-09-16 09:57:00", datetime(2026, 9, 16, 13, 0, tzinfo=JST)) is False


def test_afternoon_within_window():
    # 14:27更新、15:00 → 午後の窓内
    assert _run("2026-09-16 14:27:00", datetime(2026, 9, 16, 15, 0, tzinfo=JST)) is True


def test_afternoon_after_close():
    # 15:31 → 午後の締め超過で不可
    assert _run("2026-09-16 14:27:00", datetime(2026, 9, 16, 15, 31, tzinfo=JST)) is False


def test_stale_yesterday_update():
    # 前日の更新のまま → 不可
    assert _run("2026-09-15 09:57:00", datetime(2026, 9, 16, 10, 30, tzinfo=JST)) is False


def test_bad_format():
    # 形式不明 → 安全側で不可
    assert _run("not-a-date", datetime(2026, 9, 16, 10, 30, tzinfo=JST)) is False


def test_empty_update():
    # 空 → 不可
    assert _run("", datetime(2026, 9, 16, 10, 30, tzinfo=JST)) is False
