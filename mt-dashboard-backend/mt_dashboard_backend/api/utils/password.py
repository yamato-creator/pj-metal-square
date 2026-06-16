"""パスワードのハッシュ化と検証ユーティリティ（bcrypt 採用）。

既存DBには平文パスワードが残っているため、移行期間は両対応する：
- 保管値が bcrypt ハッシュ（`$2a$` / `$2b$` 等で始まる）→ bcrypt.checkpw で照合
- 保管値が平文 → strip 比較し、一致したら呼び出し側で再ハッシュ化（自動マイグレ）
"""

from __future__ import annotations

import bcrypt

# bcrypt が生成するハッシュ値の prefix（識別子の違いを吸収）
_BCRYPT_PREFIXES = ("$2a$", "$2b$", "$2x$", "$2y$")


def is_hashed(value: str | None) -> bool:
    """値が bcrypt ハッシュ形式かを判定する。"""
    if not value:
        return False
    return value.startswith(_BCRYPT_PREFIXES)


def hash_password(plain_password: str) -> str:
    """平文パスワードを bcrypt ハッシュに変換する。

    引数が既にハッシュ値だった場合は二重ハッシュを避けるためそのまま返す。
    """
    if not plain_password:
        raise ValueError("password is required")
    if is_hashed(plain_password):
        return plain_password
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(plain_password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, stored_password: str | None) -> bool:
    """ユーザー入力パスワードが保管値と一致するかを返す。

    保管値が bcrypt ハッシュなら bcrypt.checkpw、平文なら strip 後の単純比較。
    どちらでも一致しなければ False。
    """
    if not plain_password or stored_password is None:
        return False
    if is_hashed(stored_password):
        try:
            return bcrypt.checkpw(
                plain_password.encode("utf-8"),
                stored_password.encode("utf-8"),
            )
        except (ValueError, TypeError):
            return False
    # 平文（旧データ）との比較。既存ユーザーがログインしてきた時に通る経路。
    return plain_password.strip() == stored_password.strip()


def needs_rehash(stored_password: str | None) -> bool:
    """保管値が平文（=再ハッシュが必要）かを返す。"""
    return stored_password is not None and not is_hashed(stored_password)
