# Changelog

All notable changes to memory-os are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

## [0.4.0] — 2026-05-06

### Added
- **Multi-user auth** via [Better Auth](https://better-auth.com) — email/password sign-up and sign-in
- **API keys** — named, revocable `mo_*` prefixed keys for MCP clients (SHA-256 hashed at rest)
- `POST /api/auth/api-keys`, `GET /api/auth/api-keys`, `DELETE /api/auth/api-keys/:id` endpoints
- `AuthGuard` — validates Better Auth sessions (cookie or Bearer session token) and custom API keys (`Authorization: Bearer mo_...`)
- `@CurrentUser()` decorator — injects the authenticated user into controllers
- `@Public()` decorator — opts a route out of auth (used on `/health` and Better Auth's own routes)
- `MCP_API_KEY` env var — MCP server now authenticates as the key owner instead of the default user when set
- Web UI login (`/login`) and sign-up (`/signup`) pages
- Web UI Settings page (`/settings`) — create, list, and revoke API keys
- Auth-aware `NavBar` component — shows signed-in email, Settings link, and Sign out; shows Sign in / Sign up when unauthenticated
- Vault and Search pages redirect to `/login` if the session is missing
- Prisma models: `Session`, `Account`, `Verification`, `ApiKey`; extended `User` with `name`, `emailVerified`, `image`, `updatedAt`
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` env vars
- `bearer` plugin enabled — session tokens can be passed as `Authorization: Bearer <token>` by API clients that can't use cookies

### Changed
- All REST endpoints now derive `userId` from the authenticated session — the `userId` query/body param is removed from the public API
- `GET /api/memories`, `POST /api/memories/recall`, `GET /api/memories/:id`, `DELETE /api/memories/:id` no longer accept `userId` in the URL or body
- Web `api.ts` no longer reads `NEXT_PUBLIC_USER_ID`; API calls include `credentials: 'include'` for cookie auth
- MCP server falls back to `DEFAULT_USER_EMAIL` auto-created user when `MCP_API_KEY` is not set (backwards-compatible)
- Removed `NEXT_PUBLIC_USER_ID` from `apps/web/.env.local.example` — replaced with `NEXT_PUBLIC_API_BASE`

### Added
- `relate` and `traverse` MCP tools — expose the memory knowledge graph via MCP
- `minScore` parameter on the MCP `recall` tool (was already available in the REST API)
- `GET /api/memories/:id` REST endpoint (used by the Web UI `getMemory` call)
- Rate limiting on the REST API via `@nestjs/throttler` (120 req / 60 s per IP by default; configurable with `RATE_LIMIT_MAX` and `RATE_LIMIT_TTL_MS`)
- `GET /api/health` health-check endpoint — returns `{ status, version, uptime, timestamp }`, exempt from rate limiting
- OpenAPI / Swagger UI at `/api/docs` (powered by `@nestjs/swagger`)
- Global `ValidationPipe` and CORS configuration in `main.ts`
- `CORS_ORIGIN` env var for production CORS allow-list
- GitHub Actions CI workflow (test + typecheck + lint + build on push/PR)
- GitHub issue templates (bug report, feature request) and PR template
- `SECURITY.md` — vulnerability disclosure policy

### Changed
- `GET /api/memories/namespaces` and `POST /api/memories/recall` moved above `GET /api/memories/:id` in the controller for routing clarity

---

## [0.3.0] — 2026-05-05

### Added
- **Web UI** (`apps/web`) — Next.js 14 dashboard with Vault browser and Semantic Search pages
- **Voyage AI** embedding provider (`EMBEDDING_PROVIDER=voyage`, 512-dim `voyage-3-lite`)
- **Cohere** embedding provider (`EMBEDDING_PROVIDER=cohere`, 1024-dim `embed-english-v3.0`)
- **Gemini** embedding provider (`EMBEDDING_PROVIDER=gemini`, 768-dim)
- Dimension-specific migration SQL files (`prisma/sql/dims_512.sql`, `dims_1024.sql`, `ollama_dimensions.sql`)
- `MCP_CLIENT_NAME` env var — written into `source.client` on every memory
- `apps/web/.env.local.example` with `NEXT_PUBLIC_USER_ID` and `NEXT_PUBLIC_API_BASE`
- `MemoryCard` component with type badge, status dot, score display, and forget button

---

## [0.2.0] — 2026-05-04

### Added
- **pg-boss embedding queue** — asynchronous embedding generation with retry (3 attempts), delay backoff, and dead-letter handling; no Redis required
- **Ollama embedding provider** — fully local, free embeddings via `nomic-embed-text` (768-dim)
- **Working memory** (`WorkingMemoryModule`) — ephemeral per-session context stored in-process with TTL
- **Session MCP tools** — `session_remember`, `session_recall`, `session_clear`
- `SESSION_TTL_SECONDS` env var
- `QueueModule` wrapping `pg-boss` with typed `send` / `work` helpers
- `EmbeddingWorker` — subscribes to the `embedding:generate` queue, calls the configured provider, writes the vector back to Postgres

### Changed
- `MemoryStatus` can now be `PENDING_EMBEDDING | READY | FAILED` (previously only `READY`)
- `remember()` now enqueues an embedding job instead of calling the provider inline

---

## [0.1.0] — 2026-05-03

### Added
- Initial public release
- NestJS monorepo scaffold (`apps/server`, `packages/mcp-client`)
- Prisma schema — `User`, `Namespace`, `Memory`, `MemoryRelation`, `MemoryTag` + pgvector HNSW index (1536-dim OpenAI default)
- `MemoryService` — `remember`, `recall`, `forget`, `list`, `relate`, `traverse`, `getMemory`, `createNamespace`, `listNamespaces`, `purgeExpiredDeletions`
- Hybrid recall scoring: `0.7 × cosine + 0.2 × recency_decay + 0.1 × access_boost`
- Auto type-classification (`EPISODIC / SEMANTIC / PROCEDURAL`) from content heuristics
- Hashtag and PascalCase auto-tagging
- MCP server (`mcp-server.ts`) with `StdioServerTransport` — 7 vault tools: `remember`, `recall`, `forget`, `list_namespaces`, `create_namespace`, `get_memory`, `list_recent`
- REST controller (`MemoryController`) mirroring the service API
- OpenAI `text-embedding-3-small` provider (1536-dim)
- `docker-compose.yml` with `pgvector/pgvector:pg16`
- `.env.example` with all configurable variables
- Vitest unit tests (55 tests across service + providers + working memory)
