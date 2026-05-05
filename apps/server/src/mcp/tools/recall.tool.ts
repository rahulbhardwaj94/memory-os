import { z } from 'zod/v3';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MemoryType } from '@prisma/client';
import type { MemoryService } from '../../memory/memory.service';

type Context = {
  userId: string;
  resolveNamespace: (path: string) => Promise<string>;
};

/**
 * Register the `recall` tool on an McpServer instance.
 *
 * @example
 * registerRecallTool(server, memoryService, ctx);
 */
export function registerRecallTool(
  server: McpServer,
  memoryService: MemoryService,
  ctx: Context,
): void {
  server.registerTool(
    'recall',
    {
      description:
        'Search your memory vault with a natural language query. ' +
        'Results are ranked by semantic similarity, recency, and access frequency.',
      inputSchema: {
        query: z.string().min(1).max(1_000).describe('Natural language search query'),
        namespace: z
          .string()
          .optional()
          .describe('Limit search to this namespace path (and descendants)'),
        type: z
          .enum(['EPISODIC', 'SEMANTIC', 'PROCEDURAL'])
          .optional()
          .describe('Filter by memory type'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe('Maximum number of results (default 10)'),
      },
    },
    async ({ query, namespace, type, limit = 10 }) => {
      try {
        let namespaceId: string | undefined;
        if (namespace) {
          namespaceId = await ctx.resolveNamespace(namespace);
        }

        const memories = await memoryService.recall({
          query,
          userId: ctx.userId,
          namespaceId,
          type: type as MemoryType | undefined,
          limit,
          includeDescendants: true,
        });

        if (memories.length === 0) {
          return {
            content: [{ type: 'text' as const, text: 'No memories found matching your query.' }],
          };
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                memories.map(m => ({
                  id: m.id,
                  type: m.type,
                  content: m.content,
                  score: Math.round(m.score * 1000) / 1000,
                  tags: m.tags.map((t: { tag: string }) => t.tag),
                  namespace: m.namespaceId,
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
