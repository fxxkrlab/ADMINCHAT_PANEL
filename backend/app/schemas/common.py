from pydantic import BaseModel, Field
from typing import Any, Generic, List, Optional, TypeVar

T = TypeVar("T")


class APIResponse(BaseModel):
    code: int = 200
    message: str = "success"
    data: Optional[Any] = None


class PaginatedData(BaseModel, Generic[T]):
    items: List[T] = []
    total: int = 0
    page: int = 1
    page_size: int = 20
    total_pages: int = 0


class PaginationParams(BaseModel):
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
