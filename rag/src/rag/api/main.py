from __future__ import annotations

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select

from rag.common.logging import setup_logging
from rag.common.db import session_scope
from rag.documents.bootstrap import init_db
from rag.documents.models import AclBinding, Document
from rag.generation.answer import empty_structured, evidence_only_answer
from rag.generation.schemas import Citation, QueryRequest, QueryResponse
from rag.common.ids import new_uuid
from rag.ingestion.local_sync import sync_local_pdfs
from rag.retrieval.retrieve import fetch_span_locations, retrieve


class AclBindRequest(BaseModel):
    doc_key: str = Field(..., min_length=1)
    principal: str = Field(..., min_length=1)


def create_app() -> FastAPI:
    setup_logging()
    init_db()

    app = FastAPI(title="RAG Platform (v0)")

    @app.get("/health")
    def health():
        return {"ok": True}

    @app.post("/sync")
    def sync():
        with session_scope() as session:
            result = sync_local_pdfs(session)
        return result.__dict__

    @app.get("/documents")
    def list_documents(limit: int = 50):
        limit = max(1, min(200, int(limit)))
        with session_scope() as session:
            docs = session.execute(select(Document).order_by(Document.updated_at.desc()).limit(limit)).scalars().all()
        return [
            {
                "doc_key": d.doc_key,
                "title": d.title,
                "source": d.source,
                "current_version_id": d.current_version_id,
            }
            for d in docs
        ]

    @app.post("/acl/bind")
    def acl_bind(req: AclBindRequest):
        with session_scope() as session:
            doc = session.execute(
                select(Document).where(Document.source == "local", Document.doc_key == req.doc_key)
            ).scalar_one_or_none()
            if doc is None:
                raise HTTPException(status_code=404, detail="document not found")
            existing = session.execute(
                select(AclBinding).where(AclBinding.document_id == doc.id, AclBinding.principal == req.principal)
            ).scalar_one_or_none()
            if existing:
                return {"ok": True, "created": False}
            session.add(AclBinding(id=new_uuid(), document_id=doc.id, principal=req.principal))
        return {"ok": True, "created": True}

    @app.post("/query", response_model=QueryResponse)
    def query(req: QueryRequest):
        with session_scope() as session:
            hits = retrieve(session, req.question, req.principal, top_k=req.top_k)
            span_ids: list[str] = []
            for h in hits:
                span_ids.extend(h.span_ids)
            loc = fetch_span_locations(session, list(dict.fromkeys(span_ids)))

        passages = [h.text for h in hits]
        citations: list[Citation] = []
        for h in hits:
            for sid in h.span_ids[:2]:
                if sid not in loc:
                    continue
                page_no, para_no = loc[sid]
                citations.append(
                    Citation(
                        doc_key=h.doc_key,
                        title=h.doc_title or h.doc_key,
                        version_no=h.version_no,
                        page_no=page_no,
                        para_no=para_no,
                    )
                )

        structured = None
        if req.mode != "qa":
            structured = empty_structured(req.mode)

        answer = evidence_only_answer(req.question, passages)
        return QueryResponse(
            answer=answer,
            structured=structured,
            citations=citations,
            passages=passages[: min(6, len(passages))],
            provider="evidence",
        )

    return app


app = create_app()
