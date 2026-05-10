# memory-os — technical demo
# Regenerate: vhs docs/demo.tape
# Prerequisite: brew install vhs  (no running server needed — output is pre-written)

Output docs/demo.gif
Output docs/demo.mp4

Set Shell "bash"
Set FontSize 15
Set Width 1100
Set Height 560
Set Theme "Dracula"
Set Padding 24
Set Margin 12
Set MarginFill "#1e1f29"
Set BorderRadius 8

Set TypingSpeed 40ms
Set PlaybackSpeed 1.0

# ── Setup ─────────────────────────────────────────────────────────────────────
Hide
Type `export PS1="\033[1;36mmemory-os\033[0m \033[1;32m›\033[0m "` Enter
Type "clear" Enter
Show

# ── Banner ────────────────────────────────────────────────────────────────────
Type `echo "  memory-os  ·  local-first AI memory via MCP"` Enter
Sleep 300ms
Type `echo "  Postgres + pgvector  ·  5 embedding providers  ·  MIT"` Enter
Sleep 1200ms

# ── 1. Server health ─────────────────────────────────────────────────────────
Type `echo ""` Enter
Type `echo "# 1. server health"` Enter
Sleep 500ms
Type `echo '{ "status": "ok", "version": "0.5.0", "uptime": 142 }'` Enter
Sleep 1800ms

# ── 2. Store a memory ────────────────────────────────────────────────────────
Type `echo ""` Enter
Type `echo "# 2. store a memory  (auto-classified · embedded async)"` Enter
Sleep 500ms
Type `echo '{ "id": "cmozg580", "type": "SEMANTIC", "status": "READY", "tags": ["typescript","react"] }'` Enter
Sleep 1800ms

# ── 3. Recall by meaning ─────────────────────────────────────────────────────
Type `echo ""` Enter
Type `echo "# 3. recall  ·  query: what frameworks do I like to code in?"` Enter
Sleep 500ms
Type `echo '[{ "score": 0.934, "content": "I prefer strict TypeScript and functional React — no class components" }]'` Enter
Sleep 2500ms

# ── Closing ──────────────────────────────────────────────────────────────────
Type `echo ""` Enter
Type `echo "  stored once · retrieved by meaning, not keywords"` Enter
Sleep 300ms
Type `echo "  same vault: Claude Desktop, Cursor, Cline — all in sync"` Enter
Sleep 300ms
Type `echo "  your data · your Postgres · nothing leaves your machine"` Enter
Sleep 3500ms
