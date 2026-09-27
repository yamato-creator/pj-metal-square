"""SettingsService（メンテナンスON/OFF）のテスト。2026/09/26 星さん要望②。

- settings!B2 が ON 系ならメンテナンス中
- OFF/空/無し/不明値はメンテナンスではない
- 文言は settings!B3、空なら既定文
- シートが読めない場合はメンテナンスではない扱い（サイトを止めない安全側）
"""
import pytest
from unittest.mock import patch, MagicMock

from mt_dashboard_backend.services import settings_service as ss


def _svc(flag_cells, msg_cells=None):
    """認証を通さずに SettingsService を作り、シート読みだけ差し替える。"""
    with patch.object(ss.SettingsService, "_get_sheets_service", return_value=MagicMock()):
        svc = ss.SettingsService()

    def fake_get(range_name):
        if range_name == ss.MAINT_FLAG_RANGE:
            return flag_cells
        if range_name == ss.MAINT_MSG_RANGE:
            return msg_cells if msg_cells is not None else []
        return []

    svc._get_sheet_data = fake_get
    return svc


@pytest.mark.parametrize("cells,expected", [
    ([["ON"]], True),
    ([["on"]], True),
    ([[" On "]], True),
    ([["TRUE"]], True),
    ([["1"]], True),
    ([["メンテナンス中"]], True),
    ([["OFF"]], False),
    ([["off"]], False),
    ([[""]], False),
    ([[]], False),
    ([], False),
    ([["なにか別の値"]], False),
])
def test_is_maintenance(cells, expected):
    assert _svc(cells).is_maintenance() is expected


def test_message_custom_and_default():
    assert _svc([["ON"]], [["本日18時までメンテナンスです"]]).maintenance_message() == "本日18時までメンテナンスです"
    assert _svc([["ON"]], [[""]]).maintenance_message() == ss.DEFAULT_MAINT_MESSAGE
    assert _svc([["ON"]], []).maintenance_message() == ss.DEFAULT_MAINT_MESSAGE


def test_read_error_fails_open():
    """シートが読めない時はメンテナンス扱いにしない（設定不備でサイトを止めない）。"""
    svc = _svc([["ON"]])
    svc._get_sheet_data = MagicMock(side_effect=RuntimeError("sheets down"))
    assert svc.is_maintenance() is False
    assert svc.maintenance_message() == ss.DEFAULT_MAINT_MESSAGE
