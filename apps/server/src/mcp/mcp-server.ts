/**
 * Standalone MCP server entry point.
 * Start with: npm run mcp:start (compiled) or npm run mcp:dev (ts-node)
 *
 * stdout is reserved for the MCP protocol wire format.
 * All application logs go to stderr.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { randomUUID } from 'crypto';
import { AppModule } from '../app.module';
import { MemoryService } from '../memory/memory.service';
import { PrismaService } from '../prisma/prisma.service';
import { env } from '../config/env';
import { registerRememberTool } from './tools/remember.tool';
import { registerRecallTool } from './tools/recall.tool';
import { registerForgetTool } from './tools/forget.tool';
import { registerNamespaceTools } from './tools/namespace.tools';
import { registerSessionTools } from './tools/session.tools';
import { registerGraphTools } from './tools/graph.tools';
import { WorkingMemoryService } from '../working-memory/working-memory.service';

const log = (msg: string): void => {
  process.stderr.write(`[memory-os] ${msg}\n`);
};

async function main(): Promise<void> {
  // Initialise NestJS DI context without starting an HTTP server
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  const memoryService = app.get(MemoryService);
  const workingMemory = app.get(WorkingMemoryService);
  const prisma = app.get(PrismaService);

  let userId: string;

  if (env.MCP_API_KEY) {
    // Validate the API key and resolve the owning user
    const keyRecord = await prisma.apiKey.findUnique({
      where: { key: env.MCP_API_KEY },
      include: { user: true },
    });
    if (!keyRecord || !keyRecord.enabled) {
      log('Fatal: MCP_API_KEY is invalid or disabled. Generate one in the Web UI → Settings → API Keys.');
      process.exit(1);
    }
    userId = keyRecord.userId;
    log(`Ready — user: ${keyRecord.user.email} [API key: ${keyRecord.name ?? keyRecord.id}]`);
  } else {
    // Backwards-compatible default: auto-create a single local user
    const defaultUser = await prisma.user.upsert({
      where: { email: env.DEFAULT_USER_EMAIL },
      create: { email: env.DEFAULT_USER_EMAIL, name: 'Default User', emailVerified: false },
      update: {},
    });
    userId = defaultUser.id;
    log(`Ready — user: ${defaultUser.id} (${env.DEFAULT_USER_EMAIL}) [default user]`);
  }

  const SESSION_ID = randomUUID();

  /**
   * Resolve a namespace path like "work/acme" to a Namespace.id.
   * Creates missing path segments on-the-fly.
   */
  const resolveNamespace = async (path: string): Promise<string> => {
    const parts = (path || 'default').split('/').filter(p => p.length > 0);
    if (parts.length === 0) return resolveNamespace('default');

    let parentId: string | undefined;
    let nsId = '';

    for (const part of parts) {
      const existing = await prisma.namespace.findFirst({
        where: { userId, name: part, parentId: parentId ?? null },
      });

      if (existing) {
        nsId = existing.id;
        parentId = existing.id;
      } else {
        const created = await prisma.namespace.create({
          data: { userId, name: part, parentId },
        });
        nsId = created.id;
        parentId = created.id;
      }
    }

    return nsId;
  };

  const ctx = {
    userId,
    sessionId: SESSION_ID,
    clientName: env.MCP_CLIENT_NAME,
    resolveNamespace,
  };

  const server = new McpServer({ name: 'memory-os', version: '0.1.0' });

  registerRememberTool(server, memoryService, ctx);
  registerRecallTool(server, memoryService, ctx);
  registerForgetTool(server, memoryService, ctx);
  registerNamespaceTools(server, memoryService, ctx);
  registerSessionTools(server, workingMemory, ctx);
  registerGraphTools(server, memoryService, { userId: ctx.userId });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  log('MCP server connected on stdio. Waiting for client.');

  const shutdown = async (): Promise<void> => {
    log('Shutting down…');
    await server.close();
    await app.close();
  };

  process.on('SIGTERM', () => void shutdown().then(() => process.exit(0)));
  process.on('SIGINT', () => void shutdown().then(() => process.exit(0)));
}

main().catch(err => {
  process.stderr.write(
    `[memory-os] Fatal: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
  );
  process.exit(1);
});
