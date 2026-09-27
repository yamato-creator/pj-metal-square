"""Decimal ベース金額計算ユーティリティの単体テスト。"""
from decimal import Decimal

from mt_dashboard_backend.api.utils.money import (
    calc_tax_yen,
    calc_subtotal_yen,
    floor_grams,
)


class TestCalcTaxYen:
    """消費税は小数点第1位を四捨五入（2026/09/26 星さん指示・Excel ROUND と一致）。"""

    def test_basic(self):
        assert calc_tax_yen(1000) == 100
        assert calc_tax_yen(1009) == 101  # 100.9 → 101 四捨五入

    def test_hoshi_real_case_one_yen_gap(self):
        # 星さんが指摘した実例: 77,567×10% = 7,756.7 → 旧切り捨て 7,756 / 正 7,757
        assert calc_tax_yen(77567) == 7757
        assert calc_tax_yen(77564) == 7756  # .4 は切り下げ
        assert calc_tax_yen(77565) == 7757  # .5 は切り上げ（ROUND_HALF_UP）

    def test_string_input(self):
        assert calc_tax_yen("12345") == 1235  # 1234.5 → 1235

    def test_float_input_no_drift(self):
        # float の 0.1 誤差（0.1*3=0.30000000000000004 等）を Decimal で防止。
        assert calc_tax_yen(10) == 1
        assert calc_tax_yen(3) == 0  # 0.3 → 0

    def test_custom_rate(self):
        assert calc_tax_yen(1000, "0.08") == 80

    def test_decimal_input(self):
        assert calc_tax_yen(Decimal("9999")) == 1000  # 999.9 → 1000


class TestCalcSubtotalYen:
    def test_basic(self):
        assert calc_subtotal_yen(10, 1000) == 10000

    def test_string_grams(self):
        assert calc_subtotal_yen("1.5", 1000) == 1500

    def test_float_drift_eliminated(self):
        # 0.1 × 12345 = 1234.5 だが float では 1234.5000000000002 等になり得る。
        # Decimal なら 1234.5 → 切り捨て 1234。
        assert calc_subtotal_yen("0.1", 12345) == 1234

    def test_zero_or_negative(self):
        assert calc_subtotal_yen(0, 1000) == 0


class TestFloorGrams:
    def test_two_decimals(self):
        assert floor_grams("12.345") == Decimal("12.34")
        assert floor_grams(0.5) == Decimal("0.50")

    def test_custom_decimals(self):
        assert floor_grams("12.3456", decimals=3) == Decimal("12.345")
