from __future__ import annotations

from pydantic import BaseModel


class Position(BaseModel):
    x: float
    y: float


class CreateChatBody(BaseModel):
    title: str
    position: Position
