#!/usr/bin/env node
/**
 * memory-os setup wizard
 * Runs once after `git clone`. Gets you from zero to a running server in < 3 minutes.
 *
 * Usage: npm run setup
 */

import { execSync, spawnSync } from 'child_process';
import { createInterface } from 'readline';
import { randomBytes } from 'crypto';
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ─── Colour helpers ───────────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  white: '\x1b[37m',
};
const ok  = (s) => console.log(`${c.green}✓${c.reset} ${s}`);
const info = (s) => console.log(`${c.cyan}→${c.reset} ${s}`);
const warn = (s) => console.log(`${c.yellow}!${c.reset} ${s}`);
const fail = (s) => { console.error(`${c.red}✗${c.reset} ${s}`); process.exit(1); };
const step = (s) => console.log(`\n${c.bold}${s}${c.reset}`);

// ─── Prompt helper ────────────────────────────────────────────────────────────
const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q, def) =>
  new Promise(res => rl.question(`  ${q}${def ? ` ${c.dim}[${def}]${c.reset}` : ''}: `, a => res(a.trim() || def || '')));

// ─── Shell helper ─────────────────────────────────────────────────────────────
function run(cmd, opts = {}) {
  const result = spawnSync(cmd, { shell: true, cwd: ROOT, stdio: opts.silent ? 'pipe' : 'inherit', ...opts });
  if (result.status !== 0 && !opts.ignoreError) {
    fail(`Command failed: ${cmd}`);
  }
  return result;
}

function which(cmd) {
  return spawnSync(`which ${cmd}`, { shell: true, stdio: 'pipe' }).status === 0;
}

// ─── .env patcher ─────────────────────────────────────────────────────────────
function setEnvVar(envPath, key, value) {
  let content = readFileSync(envPath, 'utf8');
  const regex = new RegExp(`^(#\\s*)?${key}=.*$`, 'm');
  const line = `${key}=${value}`;
  if (regex.test(content)) {
    content = content.replace(regex, line);
  } else {
    content += `\n${line}\n`;
  }
  writeFileSync(envPath, content);
}

// ─── Wait for Postgres ────────────────────────────────────────────────────────
async function waitForPostgres(maxSeconds = 30) {
  info('Waiting for Postgres to be ready…');
  for (let i = 0; i < maxSeconds; i++) {
    const r = spawnSync(
      'docker exec memory-os-postgres pg_isready -U memory_os -d memory_os',
      { shell: true, stdio: 'pipe' }
    );
    if (r.status === 0) return;
    await new Promise(r => setTimeout(r, 1000));
  }
  fail('Postgres did not become ready in time. Check: docker logs memory-os-postgres');
}

// ─── Banner ───────────────────────────────────────────────────────────────────
console.log(`
${c.bold}${c.white}  memory-os setup${c.reset}
  ${c.dim}Your AI's memory, owned by you.${c.reset}
`);

// ─── 1. Node version ──────────────────────────────────────────────────────────
step('Checking prerequisites…');
const nodeVersion = parseInt(process.versions.node.split('.')[0], 10);
if (nodeVersion < 20) fail(`Node 20+ required (you have ${process.versions.node}). https://nodejs.org`);
ok(`Node ${process.versions.node}`);

// ─── 2. Docker ────────────────────────────────────────────────────────────────
if (!which('docker')) fail('Docker not found. Install Docker Desktop: https://docker.com/products/docker-desktop');
const dockerRunning = spawnSync('docker info', { shell: true, stdio: 'pipe' }).status === 0;
if (!dockerRunning) fail('Docker is not running. Start Docker Desktop and try again.');
ok('Docker running');

// ─── 3. Pick embedding provider ───────────────────────────────────────────────
step('Embedding provider');
console.log(`
  Which provider do you want for generating memory embeddings?

  ${c.bold}1${c.reset} ollama   ${c.green}Free, runs locally${c.reset} — needs Ollama installed
  ${c.bold}2${c.reset} openai   Paid — needs OPENAI_API_KEY
  ${c.bold}3${c.reset} voyage   200M tokens/month free — needs VOYAGE_API_KEY
  ${c.bold}4${c.reset} cohere   1000 calls/month free — needs COHERE_API_KEY
  ${c.bold}5${c.reset} gemini   Free via Google AI Studio — needs GEMINI_API_KEY
`);

const providerChoice = await ask('Enter number', '1');
const PROVIDERS = { '1': 'ollama', '2': 'openai', '3': 'voyage', '4': 'cohere', '5': 'gemini' };
const provider = PROVIDERS[providerChoice] ?? 'ollama';
info(`Using ${c.bold}${provider}${c.reset}`);

let apiKey = '';
if (provider === 'ollama') {
  if (!which('ollama')) {
    console.log(`
  ${c.yellow}Ollama not found.${c.reset} Install it first:

    macOS:   brew install ollama
    Linux:   curl -fsSL https://ollama.com/install.sh | sh
    Windows: https://ollama.com/download

  Then run:  ollama serve  and  ollama pull nomic-embed-text
  Once done, re-run this setup.
`);
    rl.close();
    process.exit(0);
  }
  // Check if nomic-embed-text is pulled
  const modelCheck = spawnSync('ollama list', { shell: true, stdio: 'pipe' });
  const modelList = modelCheck.stdout?.toString() ?? '';
  if (!modelList.includes('nomic-embed-text')) {
    info('Pulling nomic-embed-text model (this may take a minute)…');
    run('ollama pull nomic-embed-text');
  }
  ok('Ollama + nomic-embed-text ready');
} else {
  const keyName = { openai: 'OPENAI_API_KEY', voyage: 'VOYAGE_API_KEY', cohere: 'COHERE_API_KEY', gemini: 'GEMINI_API_KEY' }[provider];
  apiKey = await ask(`${keyName}`);
  if (!apiKey) fail(`${keyName} is required for ${provider}`);
  ok(`${keyName} set`);
}

// ─── 4. .env ─────────────────────────────────────────────────────────────────
step('Configuring environment…');
const envPath = resolve(ROOT, '.env');
const envExamplePath = resolve(ROOT, '.env.example');

if (!existsSync(envPath)) {
  copyFileSync(envExamplePath, envPath);
  ok('Created .env from .env.example');
} else {
  ok('.env already exists — updating relevant values');
}

const secret = randomBytes(32).toString('hex');
setEnvVar(envPath, 'EMBEDDING_PROVIDER', provider);
setEnvVar(envPath, 'BETTER_AUTH_SECRET', secret);
setEnvVar(envPath, 'BETTER_AUTH_URL', 'http://localhost:3000');
setEnvVar(envPath, 'CORS_ORIGIN', 'http://localhost:3001');

if (provider === 'openai')  setEnvVar(envPath, 'OPENAI_API_KEY', apiKey);
if (provider === 'voyage')  setEnvVar(envPath, 'VOYAGE_API_KEY', apiKey);
if (provider === 'cohere')  setEnvVar(envPath, 'COHERE_API_KEY', apiKey);
if (provider === 'gemini')  setEnvVar(envPath, 'GEMINI_API_KEY', apiKey);

// Web UI env
const webEnvPath = resolve(ROOT, 'apps/web/.env.local');
const webEnvExample = resolve(ROOT, 'apps/web/.env.local.example');
if (!existsSync(webEnvPath)) {
  copyFileSync(webEnvExample, webEnvPath);
  ok('Created apps/web/.env.local');
}

ok('.env configured');

// ─── 5. Postgres ──────────────────────────────────────────────────────────────
step('Starting Postgres…');
run('docker compose up -d');
await waitForPostgres();
ok('Postgres ready');

// ─── 6. Dependencies ──────────────────────────────────────────────────────────
step('Installing dependencies…');
run('npm install --legacy-peer-deps');
ok('Dependencies installed');

// ─── 7. Prisma ────────────────────────────────────────────────────────────────
step('Running database migrations…');
run('npm run generate');
run('npm run migrate:deploy');

// Provider-specific vector dimension migration
const dimMigration = { ollama: 'migrate:ollama', gemini: 'migrate:gemini', voyage: 'migrate:voyage', cohere: 'migrate:cohere' }[provider];
if (dimMigration) {
  run(`npm run ${dimMigration}`);
}
ok('Database ready');

// ─── 8. Build ────────────────────────────────────────────────────────────────
step('Building server…');
run('npm run build --workspace=@memory-os/server');
ok('Server built');

// ─── 9. Done ─────────────────────────────────────────────────────────────────
rl.close();

const cwd = ROOT;
const mcpPath = resolve(cwd, 'apps/server/dist/mcp/mcp-server.js');
const dbUrl = 'postgresql://memory_os:memory_os@localhost:5432/memory_os';

console.log(`
${c.green}${c.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Setup complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}

${c.bold}Start the servers:${c.reset}
  ${c.cyan}npm run dev${c.reset}          ${c.dim}# starts HTTP server + Web UI together${c.reset}

  Or separately:
  ${c.cyan}npm run start${c.reset}        ${c.dim}# HTTP server  → http://localhost:3000${c.reset}
  ${c.cyan}npm run web${c.reset}          ${c.dim}# Web UI       → http://localhost:3001${c.reset}

${c.bold}Then:${c.reset}
  1. Open ${c.cyan}http://localhost:3001${c.reset} and create your account
  2. Go to ${c.cyan}Settings → API Keys${c.reset} and create a key for your MCP client
  3. Add memory-os to Claude Desktop:

${c.dim}     ~/Library/Application Support/Claude/claude_desktop_config.json${c.reset}

     ${c.yellow}{
       "mcpServers": {
         "memory-os": {
           "command": "node",
           "args": ["${mcpPath}"],
           "env": {
             "DATABASE_URL": "${dbUrl}",
             "EMBEDDING_PROVIDER": "${provider}",
             "MCP_API_KEY": "<paste key from Settings>"
           }
         }
       }
     }${c.reset}

${c.dim}For other MCP clients (Cursor, Cline, Zed) see the README.${c.reset}
`);
