from __future__ import annotations

import re
from dataclasses import dataclass

import fitz  # PyMuPDF


_re_ws = re.compile(r"[ \t]+")


@dataclass(frozen=True)
class ExtractedSpan:
    page_no: int
    para_no: int
    bbox: dict
    text: str


def _clean_text(text: str) -> str:
    text = text.replace("\u00a0", " ")
    text = _re_ws.sub(" ", text)
    lines = [line.strip() for line in text.splitlines()]
    lines = [line for line in lines if line]
    return "\n".join(lines).strip()


def extract_paragraph_spans(pdf_path: str) -> list[ExtractedSpan]:
    doc = fitz.open(pdf_path)
    spans: list[ExtractedSpan] = []
    try:
        for page_idx in range(len(doc)):
            page = doc[page_idx]
            blocks = page.get_text("blocks")
            para_no = 0
            for b in blocks:
                x0, y0, x1, y1, text, *_rest = b
                cleaned = _clean_text(text)
                if not cleaned:
                    continue
                para_no += 1
                spans.append(
                    ExtractedSpan(
                        page_no=page_idx + 1,
                        para_no=para_no,
                        bbox={"x0": x0, "y0": y0, "x1": x1, "y1": y1},
                        text=cleaned,
                    )
                )
    finally:
        doc.close()
    return spans
