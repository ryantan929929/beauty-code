from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class QueryMode(str, Enum):
    qa = "qa"
    holdings_change = "holdings_change"
    holdings_snapshot = "holdings_snapshot"
    fund_compare = "fund_compare"
    style_exposure = "style_exposure"


class Citation(BaseModel):
    doc_key: str
    title: str
    version_no: int
    page_no: int
    para_no: int


class QueryRequest(BaseModel):
    question: str = Field(..., min_length=1)
    principal: str | None = None
    mode: QueryMode = QueryMode.qa
    top_k: int | None = None


class QueryResponse(BaseModel):
    answer: str
    structured: dict[str, Any] | None = None
    citations: list[Citation] = []
    passages: list[str] = []
    provider: str = "evidence"
