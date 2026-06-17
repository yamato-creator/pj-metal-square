"""X-Forwarded-For 対応の slowapi key 関数テスト。"""
from unittest.mock import MagicMock

from mt_dashboard_backend.api.utils.rate_limit_key import get_real_ip


def _req(headers=None, client_host="127.0.0.1"):
    req = MagicMock()
    req.headers = headers or {}
    req.client.host = client_host
    return req


def test_uses_xff_first_entry():
    req = _req(headers={"x-forwarded-for": "203.0.113.5, 10.0.0.1, 10.0.0.2"})
    assert get_real_ip(req) == "203.0.113.5"


def test_xff_single_ip():
    req = _req(headers={"x-forwarded-for": "203.0.113.5"})
    assert get_real_ip(req) == "203.0.113.5"


def test_falls_back_to_client_host_when_no_xff():
    req = _req(client_host="198.51.100.7")
    assert get_real_ip(req) == "198.51.100.7"


def test_empty_xff_falls_back():
    req = _req(headers={"x-forwarded-for": "   "}, client_host="198.51.100.7")
    assert get_real_ip(req) == "198.51.100.7"
