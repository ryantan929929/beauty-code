from __future__ import annotations

import re

import jieba


_re_ascii_word = re.compile(r"[A-Za-z0-9_]+")


def zh_tokens(text: str) -> list[str]:
    text = (text or "").strip()
    if not text:
        return []
    tokens = [t.strip() for t in jieba.cut(text, cut_all=False)]
    tokens = [t for t in tokens if t and not t.isspace()]
    ascii_words = _re_ascii_word.findall(text)
    return tokens + ascii_words


def to_fts_text(text: str) -> str:
    return " ".join(zh_tokens(text))
