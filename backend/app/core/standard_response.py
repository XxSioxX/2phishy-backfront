from typing import Generic, TypeVar, Optional
from pydantic import BaseModel
from pydantic.generics import GenericModel

T = TypeVar("T")

class StandardResponse(GenericModel, Generic[T]):
    success: bool
    message: str
    data: Optional[T] = None
