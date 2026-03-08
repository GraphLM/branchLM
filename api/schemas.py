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


class ContextPreviewBody(BaseModel):
    prompt: str | None = None
    model: str | None = None


class ContextPreviewMessage(BaseModel):
    messageId: str
    chatId: str
    ordinal: int
    role: Literal["user", "app"]
    text: str
    source: Literal["chat_history", "branch_context"]
    tokenEstimate: int
    reason: Literal["included", "dropped_token_budget", "dropped_message_limit"]


class ContextPreviewSummary(BaseModel):
    enabled: bool
    included: bool
    text: str | None = None


class ContextPreviewCounts(BaseModel):
    included: int
    excluded: int


class ContextPreviewTokens(BaseModel):
    included: int
    excluded: int


class ContextPreviewExternalContext(BaseModel):
    included: bool
    text: str | None = None
    blockedReason: str | None = None
    linkedNodes: int
    usedNodes: int
    pendingNodes: list[str]
    statusErrorNodes: list[str]


class ContextPreviewResponse(BaseModel):
    chatId: str
    model: str
    inputBudgetTokens: int
    promptTokens: int
    maxHistoryMessages: int
    included: list[ContextPreviewMessage]
    excluded: list[ContextPreviewMessage]
    summary: ContextPreviewSummary
    counts: ContextPreviewCounts
    tokens: ContextPreviewTokens
    externalContext: ContextPreviewExternalContext


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
