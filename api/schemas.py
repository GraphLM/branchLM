from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class Position(BaseModel):
    x: float
    y: float


class CreateWorkspaceBody(BaseModel):
    title: str


class PatchWorkspaceBody(BaseModel):
    title: str


class CreateChatBody(BaseModel):
    title: str
    position: Position
    model: str | None = None


class PatchChatBody(BaseModel):
    title: str


class CreateContextNodeBody(BaseModel):
    title: str
    position: Position


class PatchContextNodeBody(BaseModel):
    title: str


class CreateContextNodeTextAssetBody(BaseModel):
    text: str


class CreateMessageBody(BaseModel):
    role: Literal["user", "app"]
    text: str


class GenerateReplyBody(BaseModel):
    text: str
    model: str | None = None


class ContextEdgeIn(BaseModel):
    fromMessageId: str
    toChatId: str
    rank: int


class ContextNodeEdgeIn(BaseModel):
    fromContextNodeId: str
    toChatId: str
    rank: int


class GraphLayoutPutBody(BaseModel):
    chatPositions: dict[str, Position]
    contextEdges: list[ContextEdgeIn]
    contextNodePositions: dict[str, Position] = {}
    contextNodeEdges: list[ContextNodeEdgeIn] = []
