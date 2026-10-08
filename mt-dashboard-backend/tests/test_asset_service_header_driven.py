"""assets シートの列を「ヘッダー名」で特定することの検証（2026/10/09）。

星さん要望で assets の C列に「ユーザー名」を挿入する。固定の列番号で読み書きしていると
金属・保有量・更新日時がズレて売却の減算先が狂うため、旧レイアウト（A〜E）でも
新レイアウト（C=ユーザー名）でも同じコードで正しく動くことを保証する。
"""

from unittest.mock import patch, call

from mt_dashboard_backend.services.asset_service import AssetService, asset_columns

USERS = [
    ['user_id', 'user_name', 'email', 'password', 'registered_at', 'api_key', 'is_deleted', 'deleted_at'],
    ['0367150884', 'クリニック', 'c@example.com', 'pw', '2026/08/13', 'k', 'FALSE', ''],
]

LEGACY = [
    ['asset_id', 'user_id', 'metal_type', 'weight_g', 'updated_at'],
    ['AST1', '0367150884', '金', '12', '2026/08/13 12:42:08'],
    ['AST2', '0367150884', '銀', '30', '2026/08/13 12:42:08'],
]

# C列に ユーザー名 が入った新レイアウト
NEW = [
    ['asset_id', 'user_id', 'ユーザー名', 'metal_type', 'weight_g', 'updated_at'],
    ['AST1', '0367150884', 'クリニック', '金', '12', '2026/08/13 12:42:08'],
    ['AST2', '0367150884', 'クリニック', '銀', '30', '2026/08/13 12:42:08'],
]


def _svc(assets):
    svc = AssetService()
    def fake_get(rng):
        if rng.startswith('users!'):
            return USERS
        if rng == 'assets!A1:Z1':
            return [assets[0]]
        if rng == 'assets!A:A':
            return [[r[0]] if r else [] for r in assets]
        return assets
    return svc, fake_get


def test_asset_columns_legacy_and_new():
    assert asset_columns(LEGACY[0]) == {'asset_id': 0, 'user_id': 1, 'metal_type': 2, 'weight_g': 3, 'updated_at': 4}
    assert asset_columns(NEW[0]) == {'asset_id': 0, 'user_id': 1, 'metal_type': 3, 'weight_g': 4, 'updated_at': 5}
    # ヘッダーが無ければ従来の固定位置
    assert asset_columns([]) == asset_columns(LEGACY[0])


def test_fetch_assets_new_layout_maps_fields_correctly():
    svc, fake = _svc(NEW)
    with patch.object(svc, '_get_sheet_data', side_effect=fake):
        assets = svc.fetch_user_assets_with_validation('0367150884')
    assert [a['metal_type'] for a in assets] == ['金', '銀']
    assert [a['weight_g'] for a in assets] == ['12', '30']
    assert assets[0]['updated_at'] == '2026/08/13 12:42:08'
    # ユーザー名列は資産dictに混ざらない（フロントの契約を変えない）
    assert set(assets[0].keys()) == {'asset_id', 'user_id', 'metal_type', 'weight_g', 'updated_at'}


def test_fetch_assets_legacy_layout_unchanged():
    svc, fake = _svc(LEGACY)
    with patch.object(svc, '_get_sheet_data', side_effect=fake):
        assets = svc.fetch_user_assets_with_validation('0367150884')
    assert [a['metal_type'] for a in assets] == ['金', '銀']


def test_update_after_sale_new_layout_writes_E_F():
    svc, fake = _svc(NEW)
    with (
        patch.object(svc, '_get_sheet_data', side_effect=fake),
        patch.object(svc, 'update_data', return_value=True) as mock_update,
        patch('mt_dashboard_backend.services.asset_service.jst_str', return_value='now'),
    ):
        assert svc.update_asset_after_sale('0367150884', '銀', 29.5) is True
    # 銀は3行目。新レイアウトでは 保有量=E, 更新日時=F
    mock_update.assert_called_once_with('assets!E3:F3', [['29.5', 'now']])


def test_update_after_sale_legacy_layout_writes_D_E():
    svc, fake = _svc(LEGACY)
    with (
        patch.object(svc, '_get_sheet_data', side_effect=fake),
        patch.object(svc, 'update_data', return_value=True) as mock_update,
        patch('mt_dashboard_backend.services.asset_service.jst_str', return_value='now'),
    ):
        assert svc.update_asset_after_sale('0367150884', '金', 11) is True
    mock_update.assert_called_once_with('assets!D2:E2', [['11', 'now']])


def test_create_asset_new_layout_leaves_username_blank():
    svc, fake = _svc(NEW)
    with (
        patch.object(svc, '_get_sheet_data', side_effect=fake),
        patch.object(svc, 'update_data', return_value=True) as mock_update,
    ):
        assert svc.create_asset(['AST9', 'U1', '金', 0, 'now']) is True
    # 末尾（4行目）に、C列=ユーザー名 を '' のまま6列で書く（ARRAYFORMULA が表示するため書かない）
    mock_update.assert_called_once_with('assets!A4:F4', [['AST9', 'U1', '', '金', 0, 'now']])
