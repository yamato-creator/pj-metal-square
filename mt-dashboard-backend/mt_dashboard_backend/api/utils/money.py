"""
金額計算ユーティリティ（Decimal ベース、float の小数誤差を排除）。

スプシは値を文字列で持っているため、入力は str/float/int いずれも受け付ける。
内部演算は Decimal、出力は int（円は整数）で返す方針。
"""
from decimal import Decimal, ROUND_DOWN
from typing import Union

Number = Union[int, float, str, Decimal]


def _to_decimal(value: Number) -> Decimal:
    """float→Decimal は文字列経由（直接渡すと float の誤差が乗る）。"""
    if isinstance(value, Decimal):
        return value
    if isinstance(value, float):
        return Decimal(str(value))
    if isinstance(value, int):
        return Decimal(value)
    if isinstance(value, str):
        try:
            return Decimal(value.strip() or "0")
        except Exception:
            return Decimal(0)
    return Decimal(0)


def calc_tax_yen(subtotal: Number, rate: Number = "0.1") -> int:
    """消費税を整数（円）で返す。切り捨て、Decimal 演算で誤差ゼロ。"""
    sub = _to_decimal(subtotal)
    r = _to_decimal(rate)
    return int((sub * r).quantize(Decimal("1"), rounding=ROUND_DOWN))


def calc_subtotal_yen(grams: Number, unit_price_yen_per_g: Number) -> int:
    """重量×単価で小計（円）を返す。整数切り捨て。"""
    g = _to_decimal(grams)
    p = _to_decimal(unit_price_yen_per_g)
    return int((g * p).quantize(Decimal("1"), rounding=ROUND_DOWN))


def floor_grams(value: Number, decimals: int = 2) -> Decimal:
    """重量(g)を指定小数桁で切り捨て。デフォルト2桁（フロントと統一）。"""
    v = _to_decimal(value)
    q = Decimal(1).scaleb(-decimals)
    return v.quantize(q, rounding=ROUND_DOWN)
