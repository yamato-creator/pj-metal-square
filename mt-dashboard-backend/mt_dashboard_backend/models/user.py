from pydantic import BaseModel, EmailStr, validator
import re
from typing import Optional

class UserBase(BaseModel):
    """ユーザーの基本情報を定義する基底モデル"""
    email: str

    @validator('email')
    def validate_email(cls, v):
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(pattern, v):
            raise ValueError("不正なメールアドレス形式です")
        return v

class UserRegister(UserBase):
    """ユーザー登録時のリクエストモデル"""
    password: str

    @validator('password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError("パスワードは8文字以上で入力してください")
        return v

class UserLogin(UserBase):
    """ログイン時のリクエストモデル"""
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

    @validator('new_password')
    def validate_new_password(cls, v):
        if len(v) < 8:
            raise ValueError("新しいパスワードは8文字以上で入力してください")
        return v

class EmailChange(BaseModel):
    """メールアドレス変更のリクエストモデル"""
    user_id: str
    new_email: str

    @validator('new_email')
    def validate_new_email(cls, v):
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(pattern, v):
            raise ValueError("不正なメールアドレス形式です")
        return v
