"""Decimal ベース金額計算ユーティリティの単体テスト。"""
from decimal import Decimal

from mt_dashboard_backend.api.utils.money import (
    calc_tax_yen,
    calc_subtotal_yen,
    floor_grams,
)


class TestCalcTaxYen:
    def test_basic(self):
        assert calc_tax_yen(1000) == 100
        assert calc_tax_yen(1009) == 100  # 100.9 → 100 切り捨て

    def test_string_input(self):
        assert calc_tax_yen("12345") == 1234

    def test_float_input_no_drift(self):
        # 旧コード: math.floor(0.1 * 1000) は 100 だが、
        # math.floor(0.1 * 10) は 0（0.999... になる）。これを Decimal で防止。
        assert calc_tax_yen(10) == 1  # 1.0 を切り捨て
        # 0.1 を float で扱うと 0.1 * 10 = 1.0000000000000002 → floor=1 だが
        # 0.1 * 3 = 0.30000000000000004 → 0 → 元の math.floor(3 * 0.1)も 0
        assert calc_tax_yen(3) == 0

    def test_custom_rate(self):
        assert calc_tax_yen(1000, "0.08") == 80

    def test_decimal_input(self):
        assert calc_tax_yen(Decimal("9999")) == 999


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
