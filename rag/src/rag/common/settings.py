from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_env: str = "dev"
    app_name: str = "rag-platform"

    database_url: str = "postgresql+psycopg2://rag:rag@localhost:5432/rag"

    local_kb_root: str = "./data/inbox"
    blob_root: str = "./data/blobs"

    chunk_max_chars: int = 1200
    chunk_overlap_paras: int = 2

    retrieval_top_k: int = 6

    llm_provider: str | None = None
    openai_api_key: str | None = None
    openai_model: str | None = None


settings = Settings()
