/**
 * Creates a dev user, a default namespace, and a handful of seed memories
 * so you can immediately test the Vault, Graph, and Packs UI.
 *
 * Usage (server must be running on :3000):
 *   node scripts/seed-dev-user.mjs
 */

const BASE = 'http://localhost:3000/api';
const USER = { name: 'Dev User', email: 'dev@memory-os.local', password: 'password123' };

async function post(path, body, cookie) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, headers: res.headers, data };
}

async function get(path, cookie) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { ...(cookie ? { Cookie: cookie } : {}) },
  });
  return res.json();
}

console.log('🌱  Seeding dev user…\n');

// 1. Sign up (idempotent — fails gracefully if already exists)
const signup = await post('/auth/sign-up/email', USER);
if (signup.status !== 200 && signup.status !== 201) {
  const msg = signup.data?.message ?? signup.data ?? signup.status;
  if (String(msg).toLowerCase().includes('already')) {
    console.log('ℹ️   User already exists — signing in instead.');
  } else {
    console.error('✖  Sign-up failed:', msg);
    process.exit(1);
  }
}

// 2. Sign in to get a session cookie
const signin = await post('/auth/sign-in/email', { email: USER.email, password: USER.password });
if (signin.status !== 200 && signin.status !== 201) {
  console.error('✖  Sign-in failed:', signin.data?.message ?? signin.status);
  process.exit(1);
}

// Extract session cookie from Set-Cookie header
const rawCookie = signin.headers.get('set-cookie') ?? '';
const cookie = rawCookie.split(';')[0]; // grab just name=value
console.log(`✔  Signed in as ${USER.email}`);

// 3. Create a default namespace
const ns = await post('/memories/namespaces', { name: 'general' }, cookie);
const namespaceId = ns.data?.id;
if (!namespaceId) {
  console.error('✖  Could not create namespace:', ns.data);
  process.exit(1);
}
console.log(`✔  Namespace "general" ready (${namespaceId})`);

// 4. Seed memories
const seeds = [
  { content: 'I prefer TypeScript strict mode with no implicit any.', type: 'SEMANTIC', tags: ['typescript', 'preferences'] },
  { content: 'Today I set up memory-os and got the vault, graph, and packs UI working.', type: 'EPISODIC', tags: ['memory-os', 'setup'] },
  { content: 'To deploy to production: run prisma migrate deploy, then npm start.', type: 'PROCEDURAL', tags: ['deployment', 'ops'] },
  { content: 'I always use NestJS for backend APIs because of its strong DI and module system.', type: 'SEMANTIC', tags: ['nestjs', 'backend', 'preferences'] },
  { content: 'pgvector HNSW indexes are partial indexes — only READY rows are indexed for vector search.', type: 'SEMANTIC', tags: ['pgvector', 'postgres', 'architecture'] },
];

for (const seed of seeds) {
  const mem = await post('/memories', { ...seed, namespaceId }, cookie);
  if (mem.data?.id) {
    console.log(`✔  Memory: "${seed.content.slice(0, 55)}…"`);
  } else {
    console.warn(`⚠️   Skipped: ${seed.content.slice(0, 40)}…`, mem.data);
  }
}

console.log(`
✅  Done! Open http://localhost:3001 and sign in with:
    Email:    ${USER.email}
    Password: ${USER.password}
`);
