#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAG_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${RAG_DIR}"
export PYTHONPATH="${RAG_DIR}/src"
uvicorn rag.api.main:app --host 0.0.0.0 --port 8000 --reload
