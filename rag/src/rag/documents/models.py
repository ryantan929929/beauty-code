from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.schema import Computed


class Base(DeclarativeBase):
    pass


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    source: Mapped[str] = mapped_column(String(64), default="local", index=True)
    doc_key: Mapped[str] = mapped_column(String(512), index=True)  # e.g. relative path in KB
    title: Mapped[str] = mapped_column(String(512), default="")

    current_version_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    versions: Mapped[list["DocumentVersion"]] = relationship(
        back_populates="document", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("source", "doc_key", name="uq_documents_source_dockey"),
    )


class DocumentVersion(Base):
    __tablename__ = "document_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    document_id: Mapped[str] = mapped_column(String(36), ForeignKey("documents.id"), index=True)
    version_no: Mapped[int] = mapped_column(Integer, index=True)

    content_hash: Mapped[str] = mapped_column(String(64), index=True)
    file_mtime: Mapped[int] = mapped_column(BigInteger)
    file_size: Mapped[int] = mapped_column(BigInteger)
    blob_path: Mapped[str] = mapped_column(String(1024))

    status: Mapped[str] = mapped_column(String(32), default="active", index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    document: Mapped["Document"] = relationship(back_populates="versions")
    spans: Mapped[list["ParagraphSpan"]] = relationship(
        back_populates="doc_version", cascade="all, delete-orphan"
    )
    chunks: Mapped[list["Chunk"]] = relationship(
        back_populates="doc_version", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("document_id", "version_no", name="uq_versions_doc_versionno"),
    )


class ParagraphSpan(Base):
    __tablename__ = "paragraph_spans"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    doc_version_id: Mapped[str] = mapped_column(String(36), ForeignKey("document_versions.id"), index=True)

    page_no: Mapped[int] = mapped_column(Integer, index=True)
    para_no: Mapped[int] = mapped_column(Integer, index=True)
    bbox: Mapped[dict] = mapped_column(JSONB, default=dict)
    text: Mapped[str] = mapped_column(Text)

    doc_version: Mapped["DocumentVersion"] = relationship(back_populates="spans")

    __table_args__ = (
        Index("ix_spans_doc_page_para", "doc_version_id", "page_no", "para_no"),
    )


class Chunk(Base):
    __tablename__ = "chunks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    doc_version_id: Mapped[str] = mapped_column(String(36), ForeignKey("document_versions.id"), index=True)
    chunk_no: Mapped[int] = mapped_column(Integer, index=True)

    text: Mapped[str] = mapped_column(Text)
    fts_text: Mapped[str] = mapped_column(Text, default="")
    span_ids: Mapped[list[str]] = mapped_column(JSONB, default=list)  # ordered span ids

    tsv: Mapped[str] = mapped_column(
        TSVECTOR,
        Computed("to_tsvector('simple', coalesce(fts_text,''))", persisted=True),
    )

    doc_version: Mapped["DocumentVersion"] = relationship(back_populates="chunks")

    __table_args__ = (
        Index("ix_chunks_doc_chunkno", "doc_version_id", "chunk_no"),
        Index("ix_chunks_tsv_gin", "tsv", postgresql_using="gin"),
    )


class AclBinding(Base):
    __tablename__ = "acl_bindings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    document_id: Mapped[str] = mapped_column(String(36), ForeignKey("documents.id"), index=True)
    principal: Mapped[str] = mapped_column(String(256), index=True)  # e.g. "user:alice" / "group:overseas"

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("document_id", "principal", name="uq_acl_document_principal"),
    )
