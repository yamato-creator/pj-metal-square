"""シートに空行（管理者が行の内容だけ消した跡）が混ざっても各処理が壊れないことの検証。

管理者運用ではユーザー行を「行削除」ではなく「内容クリア」することがあり、
その場合 Sheets API は該当行を [] （空リスト）として返す。
空行で IndexError になると該当ユーザーだけでなく全ユーザーの処理が失敗するため、
主要な検索ループが空行を読み飛ばすことを保証する。
"""

from unittest.mock import patch

from mt_dashboard_backend.services.user_service import UserService
from mt_dashboard_backend.services.asset_service import AssetService

HEADERS = ['user_id', 'user_name', 'email', 'password',
           'registered_at', 'api_key', 'is_deleted', 'deleted_at']

# 2行目が内容クリアされた users シートを再現（3行目に有効ユーザー）
USERS_WITH_EMPTY_ROW = [
    HEADERS,
    [],  # 内容クリアされた行
    ['0367150884', 'クリニック', 'c@example.com', 'pw12345678',
     '2026/08/13 12:38:31', 'apikey_test', 'FALSE', ''],
]

ASSETS_WITH_EMPTY_ROW = [
    ['asset_id', 'user_id', 'metal_type', 'weight_g', 'updated_at'],
    [],  # 内容クリアされた行
    ['AST1', '0367150884', '金', '12', '2026/08/13 12:42:08'],
]


def test_fetch_user_by_id_skips_empty_rows():
    svc = UserService()
    with patch.object(svc, '_get_sheet_data', return_value=USERS_WITH_EMPTY_ROW):
        user = svc.fetch_user_by_id('0367150884')
    assert user is not None
    assert user['user_id'] == '0367150884'


def test_update_user_password_skips_empty_rows():
    svc = UserService()
    with (
        patch.object(svc, '_get_sheet_data', return_value=USERS_WITH_EMPTY_ROW),
        patch.object(svc, 'update_data', return_value=True) as mock_update,
    ):
        assert svc.update_user_password('0367150884', 'newpass123') is True
    # 有効ユーザーは3行目にいる（空行の分を読み飛ばして正しい行を更新）
    mock_update.assert_called_once_with('users!D3', [['newpass123']])


def test_fetch_user_assets_skips_empty_rows():
    svc = AssetService()

    def fake_get(range_name):
        if range_name.startswith('users'):
            return USERS_WITH_EMPTY_ROW
        return ASSETS_WITH_EMPTY_ROW

    with patch.object(svc, '_get_sheet_data', side_effect=fake_get):
        assets = svc.fetch_user_assets_with_validation('0367150884')
    assert assets is not None
    assert len(assets) == 1
    assert assets[0]['metal_type'] == '金'


def test_create_asset_targets_first_empty_row():
    """空行があれば詰めて書き、無ければ末尾に書く。"""
    svc = AssetService()
    col_a = [['asset_id'], [], ['AST1']]  # 2行目が空き
    with (
        patch.object(svc, '_get_sheet_data', return_value=col_a),
        patch.object(svc, 'update_data', return_value=True) as mock_update,
    ):
        assert svc.create_asset(['AST9', 'U1', '金', 0, 'now']) is True
    mock_update.assert_called_once_with('assets!A2:E2', [['AST9', 'U1', '金', 0, 'now']])
