# memory-os

**Your AI's memory, owned by you.**

A unified, local-first memory vault exposed via the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/). Works with Claude Desktop, Cursor, Cline, Zed, or any MCP-compatible client.

---

## 60-second quickstart

**Prerequisites:** Node 20+, Docker, an OpenAI API key.

```bash
# 1. Clone and install
git clone https://github.com/rahulbhardwaj94/memory-os
cd memory-os
npm install

# 2. Configure
cp .env.example .env
# Edit .env and set OPENAI_API_KEY=sk-...

# 3. Start Postgres with pgvector
docker compose up -d

# 4. Run database migrations
npm run migrate

# 5. Build and start the MCP server
npm run build
npm run mcp:start
```

The server is now listening on stdio, ready for an MCP client.

---

## Claude Desktop setup

Add this to `~/Library/Application Support/Claude/claude_desktop_config.json`
(create the file if it doesn't exist):

```json
{
  "mcpServers": {
    "memory-os": {
      "command": "node",
      "args": ["/absolute/path/to/memory-os/apps/server/dist/mcp/mcp-server.js"],
      "env": {
        "DATABASE_URL": "postgresql://memory_os:memory_os@localhost:5432/memory_os",
        "OPENAI_API_KEY": "sk-your-key-here",
        "EMBEDDING_PROVIDER": "openai"
      }
    }
  }
}
```

Restart Claude Desktop. You should see memory-os tools in the tool picker.

**Quick test:**
1. Say: *"Remember that I prefer NestJS over Express"*
2. Open a new conversation
3. Say: *"What frameworks do I prefer?"*
4. Claude will use the `recall` tool to retrieve your preference.

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
│  Tools: remember · recall · forget · list_namespaces        │
│         create_namespace · get_memory · list_recent         │
│                                                             │
│  NestJS application context (DI, PrismaService)             │
└──────────────────┬──────────────────┬───────────────────────┘
                   │                  │
          ┌────────▼────────┐  ┌──────▼──────────────────┐
          │  MemoryService  │  │    EmbeddingProvider     │
          │                 │  │  (OpenAI text-emb-3-sm)  │
          │  remember()     │  │  Swappable: Voyage,      │
          │  recall()       │  │  Cohere, local models    │
          │  forget()       │  └──────────────────────────┘
          │  relate()       │
          │  traverse()     │
          └────────┬────────┘
                   │ Prisma ORM
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                   Postgres 16 + pgvector                    │
│                                                             │
│  Memory      — content, embedding vector(1536), HNSW index  │
│  Namespace   — hierarchical (personal / work / acme)        │
│  MemoryTag   — cheap btree tag filtering                    │
│  MemoryRelation — directed weighted graph edges             │
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

---

## MCP tools reference

| Tool | Description | Key params |
|---|---|---|
| `remember` | Store a memory | `content`, `namespace?`, `type?`, `tags?` |
| `recall` | Semantic search | `query`, `namespace?`, `type?`, `limit?` |
| `forget` | Soft-delete a memory | `memoryId` |
| `list_namespaces` | List namespaces | `parentId?` |
| `create_namespace` | Create a namespace | `name`, `parentId?` |
| `get_memory` | Fetch by ID | `memoryId` |
| `list_recent` | Recent memories | `namespace?`, `limit?` |

---

## Namespace paths

Namespaces are hierarchical. The `remember` and `recall` tools accept slash-separated paths:

```
personal
work
work/acme
work/acme/sprint-42
side-projects/memory-os
```

`recall` with a parent namespace also searches all descendants by default.

---

## Configuration

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | Postgres connection string |
| `OPENAI_API_KEY` | — | Required for embeddings |
| `EMBEDDING_PROVIDER` | `openai` | Embedding backend (only `openai` in v0.1) |
| `DEFAULT_USER_EMAIL` | `default@memory-os.local` | Email for the auto-created default user |
| `MCP_CLIENT_NAME` | `mcp` | Written into `source.client` on every memory |
| `PORT` | `3000` | HTTP server port (REST API, not MCP) |

---

## Development

```bash
# Run in watch mode (REST server)
npm run start:dev --workspace=apps/server

# Run MCP server with ts-node (no build step)
npm run mcp:dev --workspace=apps/server

# Unit tests
npm run test --workspace=apps/server

# E2E tests (requires running Postgres)
npm run test:e2e --workspace=apps/server

# Typecheck
npm run typecheck
```

---

## Roadmap

- **v0.2 — Working memory in Redis**: ephemeral per-session context that flushes automatically
- **v0.2 — BullMQ embedding queue**: replace `setImmediate` fire-and-forget with a proper job queue; adds retry, dead-letter, visibility
- **v0.3 — More embedding providers**: Voyage AI, Cohere, Ollama (local), Gemini
- **v0.3 — Web UI**: browse, search, and edit your memory vault in a browser
- **v0.4 — Multi-user**: full auth (Clerk / Better Auth), per-user API keys
- **v0.5 — Hosted version**: managed Postgres + embeddings, zero-config setup
- **v1.0 — Federated sync**: optional encrypted sync across devices

---

## Contributing

PRs welcome. Please read `CONTRIBUTING.md` (coming soon). For now:
1. Open an issue describing the change
2. Fork + branch off `main`
3. Keep commits scoped: `feat(memory): …`, `fix(mcp): …`, `docs: …`

---

## License

MIT © 2026 — see `LICENSE`.
