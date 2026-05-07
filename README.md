# memory-os

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node 20+](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-compatible-blue)](https://modelcontextprotocol.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript)](https://www.typescriptlang.org/)

**Your AI's memory, owned by you.**

A unified, local-first memory vault exposed via the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/). Works with Claude Desktop, Cursor, Cline, Zed, or any MCP-compatible client.

---

## Why memory-os?

Most AI memory tools either lock your data into a vendor's cloud or live inside a single client. memory-os runs on your machine, stores everything in your own Postgres, and speaks MCP — so your context follows you between Claude Desktop, Cursor, Cline, and whatever comes next. No vendor lock-in, no syncing through someone else's server, no proprietary format.

---

![demo](./docs/demo.gif)
<!-- TODO: record a 30-second Quicktime capture of Claude Desktop using remember + recall, drop it at docs/demo.gif -->

---

## Quickstart

**Prerequisites:** [Node 20+](https://nodejs.org) · [Docker](https://docker.com/products/docker-desktop)

```bash
git clone https://github.com/rahulbhardwaj94/memory-os
cd memory-os
npm run setup
```

The setup wizard will:
- Ask which embedding provider you want (default: **Ollama — free and fully local**)
- Generate a secure auth secret and write your `.env` automatically
- Start Postgres, run migrations, and build the server

Then start everything with one command:

```bash
npm run dev   # HTTP server :3000 + Web UI :3001
```

Open **http://localhost:3001**, create your account, go to **Settings → API Keys**, and paste the key into your MCP client config (see below).

---

## Embedding providers

Pick one — set `EMBEDDING_PROVIDER` in `.env` and run the matching migration.

| Provider | Cost | Dims | Migration | Extra env vars |
|---|---|---|---|---|
| `openai` | Paid | 1536 | _(none)_ | `OPENAI_API_KEY` |
| `ollama` | **Free, local** | 768 | `npm run migrate:ollama` | — |
| `gemini` | Free tier | 768 | `npm run migrate:gemini` | `GEMINI_API_KEY` |
| `voyage` | 200M tokens/mo free | 512 | `npm run migrate:voyage` | `VOYAGE_API_KEY` |
| `cohere` | 1000 calls/mo free | 1024 | `npm run migrate:cohere` | `COHERE_API_KEY` |

**Fully free setup (Ollama):**
```bash
brew install ollama
ollama serve
ollama pull nomic-embed-text

# In .env:
EMBEDDING_PROVIDER=ollama

npm run migrate && npm run generate && npm run migrate:ollama
```

---

## Claude Desktop setup

After running `npm run setup` and creating your account:

1. Go to **http://localhost:3001/settings** → **API Keys** → create a key named `Claude Desktop`
2. Copy the `mo_...` key — it is shown only once
3. Add this to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "memory-os": {
      "command": "node",
      "args": ["/absolute/path/to/memory-os/apps/server/dist/mcp/mcp-server.js"],
      "env": {
        "DATABASE_URL": "postgresql://memory_os:memory_os@localhost:5432/memory_os",
        "EMBEDDING_PROVIDER": "ollama",
        "MCP_API_KEY": "mo_your_key_here"
      }
    }
  }
}
```

4. Restart Claude Desktop — you'll see memory-os tools in the tool picker.

**Quick test:**
1. Say: *"Remember that I prefer NestJS over Express"*
2. Open a new conversation
3. Say: *"What frameworks do I prefer?"*

---

## Web UI

A browser dashboard to browse, search, and manage your vault.

```bash
# After running npm run start (HTTP server on :3000)
cp apps/web/.env.local.example apps/web/.env.local

npm run web   # → http://localhost:3001
```

Open `http://localhost:3001` and create an account. Your first account becomes your vault owner.

**MCP clients (Claude Desktop, Cursor, Cline):** after signing up, go to **Settings → API Keys**, create a named key, and set it in your MCP config:

```json
{
  "mcpServers": {
    "memory-os": {
      "command": "node",
      "args": ["/absolute/path/to/memory-os/apps/server/dist/mcp/mcp-server.js"],
      "env": {
        "DATABASE_URL": "postgresql://memory_os:memory_os@localhost:5432/memory_os",
        "EMBEDDING_PROVIDER": "ollama",
        "MCP_API_KEY": "mo_your_key_here"
      }
    }
  }
}
```

If `MCP_API_KEY` is omitted, the MCP server falls back to the `DEFAULT_USER_EMAIL` auto-created user (backwards-compatible with v0.1–v0.3 setups).

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     MCP Clients                             │
│          Claude Desktop · Cursor · Cline · Zed              │
└────────────────────────┬────────────────────────────────────┘
                         │ MCP (stdio)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   memory-os MCP server                      │
│                                                             │
│  Vault tools:   remember · recall · forget                  │
│                 list_namespaces · create_namespace          │
│                 get_memory · list_recent                    │
│  Session tools: session_remember · session_recall           │
│                 session_clear                               │
│                                                             │
│  NestJS · QueueModule (pg-boss) · WorkingMemoryModule       │
└──────────┬──────────────────┬───────────────────────────────┘
           │                  │
  ┌────────▼────────┐  ┌──────▼──────────────────────────┐
  │  MemoryService  │  │       EmbeddingProvider          │
  │                 │  │  openai · ollama · voyage        │
  │  remember()     │  │  cohere · gemini                 │
  │  recall()       │  └──────────────────────────────────┘
  │  forget()       │
  │  relate()       │         ┌───────────────────────┐
  │  traverse()     │         │  WorkingMemoryService  │
  └────────┬────────┘         │  in-process Map + TTL  │
           │                  └───────────────────────┘
           │ Prisma ORM
           │              ┌────────────────────────────┐
           │              │  EmbeddingWorker (pg-boss)  │
           │              │  retries · dead-letter      │
           │              └────────────────────────────┘
           ▼
┌─────────────────────────────────────────────────────────────┐
│                   Postgres 16 + pgvector                    │
│                                                             │
│  Memory        — content, embedding vector, HNSW index      │
│  Namespace     — hierarchical (personal / work / acme)      │
│  MemoryTag     — btree tag filtering                        │
│  MemoryRelation— directed weighted graph edges              │
└─────────────────────────────────────────────────────────────┘
```

### Memory types

| Type | Example | Auto-detected when |
|---|---|---|
| `SEMANTIC` | "I prefer TypeScript over Python" | Contains "I prefer", "always", "never" |
| `EPISODIC` | "Today I fixed the auth bug" | Contains "today", "yesterday", time words |
| `PROCEDURAL` | "To deploy, first run tests then build" | Contains "in order to", "first…then" |

### Hybrid recall scoring

```
score = 0.7 × cosine_similarity
      + 0.2 × exp(-age_days / 30)   ← recency decay
      + 0.1 × log(accessCount + 1)  ← popularity boost
```

Results below `minScore` (default 0.5 in the Web UI) are filtered out.

---

## MCP tools reference

### Vault tools

| Tool | Description | Key params |
|---|---|---|
| `remember` | Store a memory in the vault | `content`, `namespace?`, `type?`, `tags?` |
| `recall` | Semantic search with hybrid scoring | `query`, `namespace?`, `type?`, `limit?` |
| `forget` | Soft-delete a memory | `memoryId` |
| `list_namespaces` | List namespaces | `parentId?` |
| `create_namespace` | Create a namespace | `name`, `parentId?` |
| `get_memory` | Fetch a memory by ID | `memoryId` |
| `list_recent` | Most recent memories | `namespace?`, `limit?` |
| `relate` | Create a directed edge between two memories | `fromMemoryId`, `toMemoryId`, `relationType`, `weight?` |
| `traverse` | Walk the memory graph from a starting point | `memoryId`, `maxDepth?` |

### Session tools

Ephemeral per-session context — not persisted to the vault, auto-expires when the session ends.

| Tool | Description |
|---|---|
| `session_remember` | Add a note to session working memory |
| `session_recall` | Retrieve all notes for this session |
| `session_clear` | Wipe session working memory |

---

## Namespace paths

Namespaces are hierarchical. Accept slash-separated paths:

```
personal
work
work/acme
work/acme/sprint-42
```

`recall` with a parent namespace searches all descendants by default.

---

## Configuration

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | Postgres connection string |
| `EMBEDDING_PROVIDER` | `openai` | `openai` · `ollama` · `voyage` · `cohere` · `gemini` |
| `OPENAI_API_KEY` | — | Required when provider is `openai` |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `nomic-embed-text` | Ollama embedding model |
| `VOYAGE_API_KEY` | — | Required when provider is `voyage` |
| `VOYAGE_MODEL` | `voyage-3-lite` | Voyage model (512 dims) |
| `COHERE_API_KEY` | — | Required when provider is `cohere` |
| `COHERE_MODEL` | `embed-english-v3.0` | Cohere model (1024 dims) |
| `GEMINI_API_KEY` | — | Required when provider is `gemini` |
| `SESSION_TTL_SECONDS` | `3600` | Session working memory TTL |
| `DEFAULT_USER_EMAIL` | `default@memory-os.local` | Auto-created default user |
| `MCP_CLIENT_NAME` | `mcp` | Written into `source.client` on every memory |
| `PORT` | `3000` | HTTP server port |
| `RATE_LIMIT_MAX` | `120` | Max REST requests per window per IP |
| `RATE_LIMIT_TTL_MS` | `60000` | Rate-limit window in milliseconds |
| `CORS_ORIGIN` | `http://localhost:3001` | Allowed CORS origin(s) in production |

---

## Development

```bash
# HTTP server (watch mode)
npm run start:dev

# MCP server (no build step)
npm run mcp:dev --workspace=@memory-os/server

# Web UI (dev mode)
npm run web

# Tests (55 tests)
cd apps/server && npm test

# Typecheck (server + web)
npx tsc --noEmit -p tsconfig.base.json
cd apps/web && npx tsc --noEmit
```

---

## Roadmap

- **v0.2 ✅ — pg-boss embedding queue**: retry, dead-letter, visibility — no Redis required
- **v0.2 ✅ — Ollama support**: fully free, local embeddings
- **v0.2 ✅ — Working memory**: ephemeral per-session context via `session_*` tools
- **v0.3 ✅ — More embedding providers**: Voyage AI, Cohere, Gemini
- **v0.3 ✅ — Web UI**: browse and search your vault at `http://localhost:3001`
- **v0.3 ✅ — Production hardening**: rate limiting, health check, OpenAPI docs, CORS, ValidationPipe
- **v0.3 ✅ — Graph MCP tools**: `relate` and `traverse` now exposed to MCP clients
- **v0.3 ✅ — CI/CD**: GitHub Actions pipeline (test + typecheck + lint + build)
- **v0.4 ✅ — Multi-user auth**: Better Auth (email/password), named API keys, per-user scoping
- **v0.5 — Hosted option**: managed Postgres + embeddings, zero-config setup
- **v1.0 — Federated sync**: optional encrypted sync across devices

---

## Contributing

PRs welcome. Open an issue first for anything non-trivial. Keep commits scoped: `feat(memory): …`, `fix(mcp): …`, `docs: …`

---

## License

MIT © 2026 — see `LICENSE`.
