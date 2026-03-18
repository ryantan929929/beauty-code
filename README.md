# beauty-code

## RAG Platform (v0)

当前仓库新增了一个可运行的 RAG v0 骨架：
- 本地 PDF 增量同步与版本管理（`data/inbox` -> `data/blobs`）
- 文档级别 ACL 预留（`acl_bindings` 表）
- 召回默认用 Postgres 全文检索（中文用 `jieba` 分词后写入 FTS）
- 支持“问答 + 结构化输出模式（占位）”并返回页码/段落定位引用

### Quickstart（本地）
1) 启动数据库
   - `docker compose up -d`
2) 安装依赖（建议单独虚拟环境）
   - `python3 -m venv .venv-rag && source .venv-rag/bin/activate`
   - `pip install -r requirements-rag.txt`
   - `cp .env.example .env`
3) 放入 PDF
   - `mkdir -p data/inbox`，把 PDF 放进去（可递归子目录）
4) 运行 API
   - `bash scripts/run_api.sh`
5) 触发同步与查询
   - `curl -X POST http://localhost:8000/sync`
   - `curl -X POST http://localhost:8000/query -H 'Content-Type: application/json' -d '{"question":"这只基金最近一期持仓有什么变化？","mode":"holdings_change"}'`
