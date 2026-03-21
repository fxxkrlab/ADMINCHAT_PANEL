from pydantic import BaseModel
from typing import Optional


class LoginRequest(BaseModel):
    username: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: "UserInfo"


class UserInfo(BaseModel):
    id: int
    username: str
    role: str
    display_name: Optional[str] = None

    model_config = {"from_attributes": True}


# Rebuild to resolve forward reference
TokenResponse.model_rebuild()
