from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import and_, func, or_, select, text as sql_text

from rag.common.settings import settings
from rag.documents.models import AclBinding, Chunk, Document, DocumentVersion, ParagraphSpan
from rag.retrieval.tokenize import to_fts_text


@dataclass(frozen=True)
class RetrievedChunk:
    doc_id: str
    doc_title: str
    doc_key: str
    version_no: int
    created_at: str
    chunk_id: str
    text: str
    span_ids: list[str]
    score: float


def _acl_filter(principal: str | None):
    if not principal:
        return sql_text("TRUE")
    # allow document if:
    # - no bindings exist for the document, OR
    # - principal is explicitly bound
    return or_(
        ~select(AclBinding.id).where(AclBinding.document_id == Document.id).exists(),
        select(AclBinding.id)
        .where(and_(AclBinding.document_id == Document.id, AclBinding.principal == principal))
        .exists(),
    )


def retrieve(session, question: str, principal: str | None, top_k: int | None = None) -> list[RetrievedChunk]:
    top_k = top_k or settings.retrieval_top_k
    q = to_fts_text(question)
    if not q:
        return []

    ts_query = func.plainto_tsquery("simple", q)
    rank = func.ts_rank_cd(Chunk.tsv, ts_query).label("rank")

    stmt = (
        select(
            Document.id,
            Document.title,
            Document.doc_key,
            DocumentVersion.version_no,
            func.to_char(DocumentVersion.created_at, "YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"").label("created_at"),
            Chunk.id,
            Chunk.text,
            Chunk.span_ids,
            rank,
        )
        .select_from(Chunk)
        .join(DocumentVersion, Chunk.doc_version_id == DocumentVersion.id)
        .join(Document, DocumentVersion.document_id == Document.id)
        .where(Document.current_version_id == DocumentVersion.id)
        .where(_acl_filter(principal))
        .where(Chunk.tsv.op("@@")(ts_query))
        .order_by(rank.desc())
        .limit(top_k)
    )

    rows = session.execute(stmt).all()
    return [
        RetrievedChunk(
            doc_id=r[0],
            doc_title=r[1] or "",
            doc_key=r[2],
            version_no=r[3],
            created_at=r[4],
            chunk_id=r[5],
            text=r[6],
            span_ids=r[7] or [],
            score=float(r[8] or 0.0),
        )
        for r in rows
    ]


def fetch_span_locations(session, span_ids: list[str]) -> dict[str, tuple[int, int]]:
    if not span_ids:
        return {}
    stmt = select(ParagraphSpan.id, ParagraphSpan.page_no, ParagraphSpan.para_no).where(ParagraphSpan.id.in_(span_ids))
    rows = session.execute(stmt).all()
    return {r[0]: (int(r[1]), int(r[2])) for r in rows}
