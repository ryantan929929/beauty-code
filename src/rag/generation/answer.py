from __future__ import annotations

from rag.generation.schemas import QueryMode


def empty_structured(mode: QueryMode) -> dict:
    if mode == QueryMode.holdings_change:
        return {
            "fund": None,
            "period": None,
            "top_increases": [],
            "top_decreases": [],
            "notes": None,
        }
    if mode == QueryMode.holdings_snapshot:
        return {
            "fund": None,
            "as_of": None,
            "top_holdings": [],
            "sector_exposure": [],
            "notes": None,
        }
    if mode == QueryMode.fund_compare:
        return {
            "funds": [],
            "comparison": [],
            "notes": None,
        }
    if mode == QueryMode.style_exposure:
        return {
            "fund": None,
            "as_of": None,
            "style": [],
            "notes": None,
        }
    return {}


def evidence_only_answer(question: str, passages: list[str]) -> str:
    if not passages:
        return "未检索到相关内容（可能是权限限制、文档尚未同步或问题过于宽泛）。"
    joined = "\n\n".join(passages[:4]).strip()
    return f"基于检索到的材料，相关内容如下（未调用大模型生成结论）：\n\n{joined}"
