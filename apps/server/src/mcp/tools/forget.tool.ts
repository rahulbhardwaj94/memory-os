import { z } from 'zod/v3';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MemoryService } from '../../memory/memory.service';

type Context = { userId: string };

/**
 * Register the `forget` tool on an McpServer instance.
 *
 * @example
 * registerForgetTool(server, memoryService, ctx);
 */
export function registerForgetTool(
  server: McpServer,
  memoryService: MemoryService,
  ctx: Context,
): void {
  server.registerTool(
    'forget',
    {
      description:
        'Soft-delete a memory by ID. The memory is hidden immediately but hard-deleted after 30 days.',
      inputSchema: {
        memoryId: z.string().min(1).describe('ID of the memory to delete'),
      },
    },
    async ({ memoryId }) => {
      try {
        await memoryService.forget(memoryId, ctx.userId);
        return {
          content: [
            { type: 'text' as const, text: `Memory ${memoryId} soft-deleted successfully.` },
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
