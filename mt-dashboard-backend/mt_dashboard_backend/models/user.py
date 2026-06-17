from pydantic import BaseModel, EmailStr, field_validator
import re
from typing import Optional

_EMAIL_PATTERN = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')


class UserBase(BaseModel):
    """ユーザーの基本情報を定義する基底モデル"""
    email: str

    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        if not _EMAIL_PATTERN.match(v):
            raise ValueError("不正なメールアドレス形式です")
        return v

class UserRegister(UserBase):
    """ユーザー登録時のリクエストモデル"""
    password: str

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("パスワードは8文字以上で入力してください")
        return v

class UserLogin(BaseModel):
    """ログイン時のリクエストモデル"""
    user_id: str
    password: str

class UserResponse(UserBase):
    """ユーザー情報のレスポンスモデル"""
    user_id: str
    user_name: str
    created_at: str
    api_key: str
    is_deleted: bool
    deleted_at: Optional[str] = None

class PasswordChange(BaseModel):
    """パスワード変更のリクエストモデル"""
    user_id: str
    old_password: str
    new_password: str

    @field_validator('new_password')
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("新しいパスワードは8文字以上で入力してください")
        return v

class EmailChange(BaseModel):
    """メールアドレス変更のリクエストモデル"""
    user_id: str
    new_email: str

    @field_validator('new_email')
    @classmethod
    def validate_new_email(cls, v: str) -> str:
        if not _EMAIL_PATTERN.match(v):
            raise ValueError("不正なメールアドレス形式です")
        return v
