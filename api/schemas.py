from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class Position(BaseModel):
    x: float
    y: float


class CreateChatBody(BaseModel):
    title: str
    position: Position


class CreateMessageBody(BaseModel):
    role: Literal["user", "app"]
    text: str


class ContextEdgeIn(BaseModel):
    fromMessageId: str
    toChatId: str
    rank: int


class GraphLayoutPutBody(BaseModel):
    chatPositions: dict[str, Position]
    contextEdges: list[ContextEdgeIn]
