"""パスワードハッシュユーティリティの単体テスト。"""

import pytest

from mt_dashboard_backend.api.utils.password import (
    hash_password,
    verify_password,
    is_hashed,
    needs_rehash,
)


def test_hash_password_produces_bcrypt_hash():
    h = hash_password("Sup3rSecret!")
    assert is_hashed(h)
    assert h.startswith("$2b$") or h.startswith("$2a$")


def test_hash_password_is_idempotent_for_already_hashed_value():
    h1 = hash_password("Sup3rSecret!")
    h2 = hash_password(h1)
    assert h1 == h2  # 既にハッシュなら再ハッシュしない


def test_verify_password_matches_bcrypt_hash():
    h = hash_password("password123")
    assert verify_password("password123", h) is True
    assert verify_password("wrong-password", h) is False


def test_verify_password_matches_plaintext_for_legacy_data():
    """既存DBの平文パスワードと一致する場合 True を返す（移行期間用）。"""
    assert verify_password("legacypass", "legacypass") is True
    assert verify_password(" legacypass ", "legacypass") is True  # strip 比較
    assert verify_password("legacypass", "different") is False


def test_verify_password_returns_false_for_empty_inputs():
    assert verify_password("", "anything") is False
    assert verify_password("anything", None) is False
    assert verify_password("", "") is False


def test_needs_rehash_true_for_plaintext_false_for_hashed():
    assert needs_rehash("plain_text_legacy") is True
    assert needs_rehash(hash_password("anything")) is False
    assert needs_rehash(None) is False


def test_is_hashed_detects_bcrypt_prefixes():
    assert is_hashed("$2b$12$abc...") is True
    assert is_hashed("$2a$12$abc...") is True
    assert is_hashed("plain") is False
    assert is_hashed("") is False
    assert is_hashed(None) is False
