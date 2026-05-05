/**
 * MCP end-to-end test.
 * Spawns the MCP server as a child process and validates each tool via the
 * MCP client SDK over stdio. Requires a running Postgres (docker compose up -d).
 *
 * Run with: npm run test:e2e --workspace=apps/server
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'child_process';
import * as path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const SERVER_DIR = path.join(__dirname, '..');
const TS_NODE = path.join(SERVER_DIR, '../../node_modules/.bin/ts-node');

function buildClient(child: ChildProcess) {
  const transport = new StdioClientTransport({
    command: TS_NODE,
    args: ['-r', 'tsconfig-paths/register', 'src/mcp/mcp-server.ts'],
    env: {
      ...process.env,
      DATABASE_URL: process.env['DATABASE_URL'] ?? 'postgresql://memory_os:memory_os@localhost:5432/memory_os',
      OPENAI_API_KEY: process.env['OPENAI_API_KEY'] ?? 'sk-test-not-used-in-e2e',
      EMBEDDING_PROVIDER: 'openai',
      DEFAULT_USER_EMAIL: `e2e-test-${Date.now()}@memory-os.local`,
    },
  });
  void child; // suppress unused warning — child is managed by transport
  return { transport };
}

describe('MCP server e2e', () => {
  let client: Client;
  let child: ChildProcess;

  beforeAll(async () => {
    child = spawn('echo', ['placeholder'], { shell: false });

    const transport = new StdioClientTransport({
      command: TS_NODE,
      args: [
        '--project', path.join(SERVER_DIR, 'tsconfig.json'),
        '-r', 'tsconfig-paths/register',
        path.join(SERVER_DIR, 'src/mcp/mcp-server.ts'),
      ],
      env: {
        ...process.env,
        DATABASE_URL: process.env['DATABASE_URL'] ?? 'postgresql://memory_os:memory_os@localhost:5432/memory_os',
        OPENAI_API_KEY: process.env['OPENAI_API_KEY'] ?? 'sk-placeholder',
        EMBEDDING_PROVIDER: 'openai',
        DEFAULT_USER_EMAIL: `e2e-test-${Date.now()}@memory-os.local`,
        NODE_ENV: 'test',
      },
    });

    client = new Client({ name: 'e2e-test-client', version: '0.1.0' });
    await client.connect(transport);
  }, 30_000);

  afterAll(async () => {
    await client.close().catch(() => undefined);
  });

  it('lists all 7 tools', async () => {
    const { tools } = await client.listTools();
    const names = tools.map(t => t.name);

    expect(names).toContain('remember');
    expect(names).toContain('recall');
    expect(names).toContain('forget');
    expect(names).toContain('list_namespaces');
    expect(names).toContain('create_namespace');
    expect(names).toContain('get_memory');
    expect(names).toContain('list_recent');
    expect(names).toHaveLength(7);
  });

  it('create_namespace: creates a root namespace', async () => {
    const result = await client.callTool({ name: 'create_namespace', arguments: { name: 'e2e-test' } });
    expect(result.isError).toBeFalsy();

    const content = result.content as Array<{ type: string; text: string }>;
    const text = content[0]?.text ?? '';
    const ns = JSON.parse(text) as { id: string; name: string };

    expect(ns.id).toBeTruthy();
    expect(ns.name).toBe('e2e-test');
  });

  it('remember: stores a memory and returns PENDING_EMBEDDING status', async () => {
    const result = await client.callTool({
      name: 'remember',
      arguments: {
        content: 'E2E test: I prefer NestJS over Express',
        namespace: 'e2e-test',
      },
    });
    expect(result.isError).toBeFalsy();

    const content = result.content as Array<{ type: string; text: string }>;
    const text = content[0]?.text ?? '';
    const mem = JSON.parse(text) as { id: string; status: string; type: string };

    expect(mem.id).toBeTruthy();
    expect(mem.status).toBe('PENDING_EMBEDDING');
    expect(mem.type).toBe('SEMANTIC');
  });

  it('list_recent: returns the memory just stored', async () => {
    const result = await client.callTool({
      name: 'list_recent',
      arguments: { limit: 5 },
    });
    expect(result.isError).toBeFalsy();

    const content = result.content as Array<{ type: string; text: string }>;
    const text = content[0]?.text ?? '';
    const memories = JSON.parse(text) as Array<{ content: string }>;

    const found = memories.some(m => m.content.includes('E2E test'));
    expect(found).toBe(true);
  });

  it('get_memory: retrieves a stored memory by ID', async () => {
    // Store first
    const storeResult = await client.callTool({
      name: 'remember',
      arguments: { content: 'E2E get_memory test', namespace: 'e2e-test' },
    });
    const storeText = (storeResult.content as Array<{ text: string }>)[0]?.text ?? '';
    const { id } = JSON.parse(storeText) as { id: string };

    // Retrieve
    const getResult = await client.callTool({ name: 'get_memory', arguments: { memoryId: id } });
    expect(getResult.isError).toBeFalsy();

    const getText = (getResult.content as Array<{ text: string }>)[0]?.text ?? '';
    const mem = JSON.parse(getText) as { id: string; content: string };
    expect(mem.id).toBe(id);
    expect(mem.content).toBe('E2E get_memory test');
  });

  it('forget: soft-deletes a memory', async () => {
    const storeResult = await client.callTool({
      name: 'remember',
      arguments: { content: 'E2E forget test', namespace: 'e2e-test' },
    });
    const storeText = (storeResult.content as Array<{ text: string }>)[0]?.text ?? '';
    const { id } = JSON.parse(storeText) as { id: string };

    const forgetResult = await client.callTool({ name: 'forget', arguments: { memoryId: id } });
    expect(forgetResult.isError).toBeFalsy();

    // Confirm it's gone from get_memory
    const getResult = await client.callTool({ name: 'get_memory', arguments: { memoryId: id } });
    const getText = (getResult.content as Array<{ text: string }>)[0]?.text ?? '';
    expect(getText).toContain('not found');
  });

  it('list_namespaces: returns created namespaces', async () => {
    const result = await client.callTool({ name: 'list_namespaces', arguments: {} });
    expect(result.isError).toBeFalsy();

    const text = (result.content as Array<{ text: string }>)[0]?.text ?? '';
    const namespaces = JSON.parse(text) as Array<{ name: string }>;
    const found = namespaces.some(n => n.name === 'e2e-test');
    expect(found).toBe(true);
  });
});
