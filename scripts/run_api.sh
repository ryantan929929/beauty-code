#!/usr/bin/env bash
set -euo pipefail

export PYTHONPATH=./src
uvicorn rag.api.main:app --host 0.0.0.0 --port 8000 --reload
