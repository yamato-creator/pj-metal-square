"""
ユーザー単位の排他ロック。

Sheets API は CAS をサポートしないため、read-modify-write のレースで資産が壊れる。
同一ユーザーの取引系エンドポイントを直列化することで、二重タップや同時送信での
資産破壊を防ぐ。プロセスをまたぐ並行は防げないが、Render の単一ワーカー前提では十分。
"""
import asyncio
from collections import defaultdict
from contextlib import asynccontextmanager

_locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)


@asynccontextmanager
async def user_lock(user_id: str):
    """指定ユーザーの取引処理を直列化するためのコンテキストマネージャ。"""
    lock = _locks[user_id]
    async with lock:
        yield
