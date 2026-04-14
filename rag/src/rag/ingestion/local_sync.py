from __future__ import annotations

import hashlib
import os
import shutil
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy import select

from rag.chunking.chunker import make_chunks
from rag.common.ids import new_uuid
from rag.common.settings import settings
from rag.documents.models import Chunk, Document, DocumentVersion, ParagraphSpan
from rag.parsing.pdf_extract import extract_paragraph_spans
from rag.retrieval.tokenize import to_fts_text


@dataclass(frozen=True)
class SyncResult:
    scanned: int
    created_documents: int
    new_versions: int
    skipped: int


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _iter_pdfs(root: Path):
    for p in root.rglob("*.pdf"):
        if p.is_file():
            yield p


def sync_local_pdfs(session) -> SyncResult:
    kb_root = Path(settings.local_kb_root).resolve()
    blob_root = Path(settings.blob_root).resolve()
    kb_root.mkdir(parents=True, exist_ok=True)
    blob_root.mkdir(parents=True, exist_ok=True)

    scanned = created_documents = new_versions = skipped = 0

    for pdf_path in _iter_pdfs(kb_root):
        scanned += 1
        rel_key = str(pdf_path.relative_to(kb_root)).replace("\\", "/")
        stat = pdf_path.stat()
        file_mtime = int(stat.st_mtime)
        file_size = int(stat.st_size)

        doc = session.execute(
            select(Document).where(Document.source == "local", Document.doc_key == rel_key)
        ).scalar_one_or_none()
        if doc is None:
            doc = Document(id=new_uuid(), source="local", doc_key=rel_key, title=pdf_path.stem)
            session.add(doc)
            session.flush()
            created_documents += 1

        latest = None
        if doc.current_version_id:
            latest = session.execute(
                select(DocumentVersion).where(DocumentVersion.id == doc.current_version_id)
            ).scalar_one_or_none()

        if latest and latest.file_mtime == file_mtime and latest.file_size == file_size:
            skipped += 1
            continue

        content_hash = _sha256_file(pdf_path)
        if latest and latest.content_hash == content_hash:
            latest.file_mtime = file_mtime
            latest.file_size = file_size
            skipped += 1
            continue

        version_no = (latest.version_no + 1) if latest else 1
        version_id = new_uuid()

        blob_dir = blob_root / doc.id
        blob_dir.mkdir(parents=True, exist_ok=True)
        blob_path = blob_dir / f"{version_no}_{content_hash}.pdf"
        shutil.copy2(str(pdf_path), str(blob_path))

        doc_version = DocumentVersion(
            id=version_id,
            document_id=doc.id,
            version_no=version_no,
            content_hash=content_hash,
            file_mtime=file_mtime,
            file_size=file_size,
            blob_path=str(blob_path),
            status="active",
        )
        session.add(doc_version)
        session.flush()

        # Mark old as superseded
        if latest:
            latest.status = "superseded"

        # Parse spans
        extracted = extract_paragraph_spans(str(blob_path))
        span_id_text_pairs: list[tuple[str, str]] = []
        for ex in extracted:
            span_id = new_uuid()
            span = ParagraphSpan(
                id=span_id,
                doc_version_id=doc_version.id,
                page_no=ex.page_no,
                para_no=ex.para_no,
                bbox=ex.bbox,
                text=ex.text,
            )
            session.add(span)
            span_id_text_pairs.append((span_id, ex.text))

        # Chunk + FTS text
        chunks = make_chunks(span_id_text_pairs)
        for i, c in enumerate(chunks, start=1):
            session.add(
                Chunk(
                    id=new_uuid(),
                    doc_version_id=doc_version.id,
                    chunk_no=i,
                    text=c.text,
                    fts_text=to_fts_text(c.text),
                    span_ids=c.span_ids,
                )
            )

        doc.current_version_id = doc_version.id
        new_versions += 1

    return SyncResult(scanned=scanned, created_documents=created_documents, new_versions=new_versions, skipped=skipped)
