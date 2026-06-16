"""タイムゾーン（JST）の取り扱いを統一するユーティリティ。

`datetime.now()` / `pd.Timestamp.now()` をそのまま使うと、稼働環境（Render は UTC）
に左右されて日付ロジック（キャンセル可能判定など）にズレが出る。
このモジュールを介して常に JST で取得する。
"""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

JST = ZoneInfo("Asia/Tokyo")


def now_jst() -> datetime:
    """現在時刻を JST のタイムゾーン付き datetime で返す。"""
    return datetime.now(JST)


def jst_str(fmt: str = "%Y-%m-%d %H:%M:%S") -> str:
    """現在時刻を JST 文字列で返す（フォーマット指定可能）。"""
    return now_jst().strftime(fmt)


def jst_compact() -> str:
    """ID 生成用のコンパクトな JST 日時文字列。形式: %Y%m%d%H%M%S"""
    return now_jst().strftime("%Y%m%d%H%M%S")


def today_jst() -> datetime:
    """JST の今日 00:00:00 を返す（境界判定に使う）。"""
    return now_jst().replace(hour=0, minute=0, second=0, microsecond=0)
