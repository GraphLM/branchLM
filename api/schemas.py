from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class Position(BaseModel):
    x: float
    y: float


class CreateChatBody(BaseModel):
    title: str
    position: Position


class PatchChatBody(BaseModel):
    title: str


class CreateMessageBody(BaseModel):
    role: Literal["user", "app"]
    text: str


class GenerateReplyBody(BaseModel):
    text: str


class ContextEdgeIn(BaseModel):
    """Input model for context edge."""

    fromMessageId: str
    toChatId: str
    rank: int


class GraphLayoutPutBody(BaseModel):
    """Input model for graph layout put."""

    chatPositions: dict[str, Position]
    contextEdges: list[ContextEdgeIn]
