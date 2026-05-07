# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| `main` (latest) | Yes |
| Older releases | No — please upgrade |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Send a report to **security@memory-os.dev** (or directly to the maintainer via [GitHub private vulnerability reporting](https://github.com/rahulbhardwaj94/memory-os/security/advisories/new)).

Include:

- A description of the vulnerability and its impact
- Steps to reproduce (a minimal PoC is ideal)
- The version or commit you tested against
- Any suggested mitigations if you have them

You can expect an acknowledgement within **48 hours** and a status update within **7 days**.

## Scope

memory-os is designed to run locally (single-user, behind your own network). The threat model for the default deployment assumes:

- The MCP server is reachable only from localhost
- The Postgres instance is not exposed to the internet
- The REST API is used only by the Web UI on the same machine

If you are running memory-os in a multi-user or internet-facing configuration (e.g., Docker on a VPS), additional hardening is required. Issues that arise specifically from that deployment topology are still in scope.

Out of scope: issues in third-party dependencies that are already publicly disclosed (please report those upstream).

## Security expectations

- All data is stored in **your own Postgres instance** — nothing is sent to any external service except the embedding API you configure (OpenAI / Voyage / Cohere / Gemini).
- Ollama is fully local — no data leaves your machine.
- The REST API has no authentication in v0.1–v0.3. **Do not expose it to the internet without a reverse proxy + auth layer.** v0.4 will add proper auth.
