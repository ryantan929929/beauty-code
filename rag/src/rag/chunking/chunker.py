from __future__ import annotations

from dataclasses import dataclass

from rag.common.settings import settings


@dataclass(frozen=True)
class Chunked:
    text: str
    span_ids: list[str]


def make_chunks(span_id_text_pairs: list[tuple[str, str]]) -> list[Chunked]:
    max_chars = max(200, settings.chunk_max_chars)
    overlap_paras = max(0, settings.chunk_overlap_paras)

    chunks: list[Chunked] = []
    current_text_parts: list[str] = []
    current_span_ids: list[str] = []

    for span_id, text in span_id_text_pairs:
        candidate = ("\n\n".join(current_text_parts + [text])).strip()
        if current_text_parts and len(candidate) > max_chars:
            chunks.append(Chunked(text="\n\n".join(current_text_parts).strip(), span_ids=list(current_span_ids)))
            if overlap_paras > 0:
                current_text_parts = current_text_parts[-overlap_paras:]
                current_span_ids = current_span_ids[-overlap_paras:]
            else:
                current_text_parts = []
                current_span_ids = []

        current_text_parts.append(text)
        current_span_ids.append(span_id)

    if current_text_parts:
        chunks.append(Chunked(text="\n\n".join(current_text_parts).strip(), span_ids=list(current_span_ids)))
    return chunks
