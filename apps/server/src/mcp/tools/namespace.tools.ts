import { z } from 'zod/v3';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MemoryService } from '../../memory/memory.service';

type Context = {
  userId: string;
  resolveNamespace: (path: string) => Promise<string>;
};

/**
 * Register namespace and utility tools on an McpServer instance.
 * Registers: list_namespaces, create_namespace, get_memory, list_recent.
 *
 * @example
 * registerNamespaceTools(server, memoryService, ctx);
 */
export function registerNamespaceTools(
  server: McpServer,
  memoryService: MemoryService,
  ctx: Context,
): void {
  server.registerTool(
    'list_namespaces',
    {
      description: 'List all namespaces, or children of a specific namespace.',
      inputSchema: {
        parentId: z
          .string()
          .optional()
          .describe('Return only children of this namespace ID. Omit for root namespaces.'),
      },
    },
    async ({ parentId }) => {
      try {
        const namespaces = await memoryService.listNamespaces(ctx.userId, parentId);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                namespaces.map(n => ({
                  id: n.id,
                  name: n.name,
                  parentId: n.parentId,
                  createdAt: n.createdAt,
                })),
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
        };
      }
    },
  );

  server.registerTool(
    'create_namespace',
    {
      description: 'Create a new namespace for organising memories.',
      inputSchema: {
        name: z.string().min(1).max(200).describe('Namespace name'),
        parentId: z
          .string()
          .optional()
          .describe('Parent namespace ID to create a nested namespace'),
      },
    },
    async ({ name, parentId }) => {
      try {
        const ns = await memoryService.createNamespace({ userId: ctx.userId, name, parentId });
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ id: ns.id, name: ns.name, parentId: ns.parentId }),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
        };
      }
    },
  );

  server.registerTool(
    'create_scratchpad',
    {
      description:
        'Create a temporary scratchpad namespace that auto-deletes after a TTL. ' +
        'Use this when exploring a problem, debugging, or working through a task where the context should not persist permanently. ' +
        'Store memories in the returned namespace ID, then abandon it — the system purges it automatically.',
      inputSchema: {
        name: z.string().min(1).max(200).describe('Scratchpad name, e.g. "debug-auth-flow"'),
        ttl: z
          .enum(['1h', '24h', '7d'])
          .describe('How long before auto-deletion: 1h, 24h, or 7d'),
      },
    },
    async ({ name, ttl }) => {
      try {
        const ns = await memoryService.createEphemeralNamespace({ userId: ctx.userId, name, ttl });
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                id: ns.id,
                name: ns.name,
                isEphemeral: true,
                expiresAt: (ns as { expiresAt?: Date | null }).expiresAt,
                ttl,
              }),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
        };
      }
    },
  );

  server.registerTool(
    'get_memory',
    {
      description: 'Retrieve a specific memory by its ID.',
      inputSchema: {
        memoryId: z.string().min(1).describe('ID of the memory to retrieve'),
      },
    },
    async ({ memoryId }) => {
      try {
        const memory = await memoryService.getMemory(memoryId, ctx.userId);
        if (!memory) {
          return {
            content: [{ type: 'text' as const, text: `Memory ${memoryId} not found.` }],
          };
        }
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  id: memory.id,
                  type: memory.type,
                  status: memory.status,
                  content: memory.content,
                  tags: memory.tags.map(t => t.tag),
                  metadata: memory.metadata,
                  source: memory.source,
                  createdAt: memory.createdAt,
                  // accessCount is bigint — convert to string to avoid serialisation loss
                  accessCount: memory.accessCount.toString(),
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
        };
      }
    },
  );

  server.registerTool(
    'list_recent',
    {
      description: 'List the most recently created memories, newest first.',
      inputSchema: {
        namespace: z
          .string()
          .optional()
          .describe('Limit results to this namespace path (exact, no descendants)'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe('Number of memories to return (default 10)'),
      },
    },
    async ({ namespace, limit = 10 }) => {
      try {
        let namespaceId: string | undefined;
        if (namespace) {
          namespaceId = await ctx.resolveNamespace(namespace);
        }

        const memories = await memoryService.list({
          userId: ctx.userId,
          namespaceId,
          limit,
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                memories.map(m => ({
                  id: m.id,
                  type: m.type,
                  status: m.status,
                  content: m.content.substring(0, 300),
                  tags: m.tags.map(t => t.tag),
                  createdAt: m.createdAt,
                })),
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
        };
      }
    },
  );
}
