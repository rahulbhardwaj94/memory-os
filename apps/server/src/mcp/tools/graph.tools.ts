import { z } from 'zod/v3';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MemoryService } from '../../memory/memory.service';

type Context = {
  userId: string;
};

/**
 * Register the `relate` and `traverse` graph tools on an McpServer instance.
 */
export function registerGraphTools(server: McpServer, memoryService: MemoryService, ctx: Context): void {
  server.registerTool(
    'relate',
    {
      description:
        'Create a directed relationship edge between two memories in the knowledge graph. ' +
        'Useful for linking cause-and-effect, supporting evidence, prerequisites, or any custom relation.',
      inputSchema: {
        fromMemoryId: z.string().min(1).describe('Source memory ID'),
        toMemoryId: z.string().min(1).describe('Target memory ID'),
        relationType: z
          .string()
          .min(1)
          .max(100)
          .describe('Relation label (e.g. "SUPPORTS", "CONTRADICTS", "PREREQUISITE", "CAUSED_BY")'),
        weight: z
          .number()
          .min(0)
          .max(1)
          .optional()
          .describe('Edge weight between 0 and 1 (default 1.0)'),
      },
    },
    async ({ fromMemoryId, toMemoryId, relationType, weight = 1.0 }) => {
      try {
        await memoryService.relate({ fromMemoryId, toMemoryId, relationType, weight });
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ ok: true, from: fromMemoryId, to: toMemoryId, relationType, weight }),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        };
      }
    },
  );

  server.registerTool(
    'traverse',
    {
      description:
        'Walk the memory knowledge graph from a starting memory up to a given depth. ' +
        'Returns all reachable memories connected by any relation edge.',
      inputSchema: {
        memoryId: z.string().min(1).describe('Starting memory ID'),
        maxDepth: z
          .number()
          .int()
          .min(1)
          .max(5)
          .optional()
          .describe('Maximum hops to traverse (default 2, max 5)'),
      },
    },
    async ({ memoryId, maxDepth = 2 }) => {
      try {
        const memories = await memoryService.traverse({ memoryId, userId: ctx.userId, maxDepth });

        if (memories.length === 0) {
          return {
            content: [{ type: 'text' as const, text: 'No related memories found from this starting point.' }],
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
                  tags: m.tags.map((t: { tag: string }) => t.tag),
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
          content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        };
      }
    },
  );
}
