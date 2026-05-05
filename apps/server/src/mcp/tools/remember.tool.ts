import { z } from 'zod/v3';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MemoryType } from '@prisma/client';
import type { MemoryService } from '../../memory/memory.service';

type Context = {
  userId: string;
  sessionId: string;
  clientName: string;
  resolveNamespace: (path: string) => Promise<string>;
};

/**
 * Register the `remember` tool on an McpServer instance.
 *
 * @example
 * registerRememberTool(server, memoryService, ctx);
 */
export function registerRememberTool(
  server: McpServer,
  memoryService: MemoryService,
  ctx: Context,
): void {
  server.registerTool(
    'remember',
    {
      description:
        'Store a new memory in your personal memory vault. ' +
        'The content is embedded in the background; the memory is immediately accessible by ID.',
      inputSchema: {
        content: z.string().min(1).max(10_000).describe('The memory content to store'),
        namespace: z
          .string()
          .optional()
          .describe('Namespace path (e.g. "personal", "work/acme"). Defaults to "default".'),
        type: z
          .enum(['EPISODIC', 'SEMANTIC', 'PROCEDURAL'])
          .optional()
          .describe('Memory type — auto-detected from content if omitted'),
        tags: z.array(z.string()).optional().describe('Additional tags to apply'),
        metadata: z
          .record(z.string(), z.unknown())
          .optional()
          .describe('Arbitrary JSON metadata'),
      },
    },
    async ({ content, namespace = 'default', type, tags = [], metadata = {} }) => {
      try {
        const namespaceId = await ctx.resolveNamespace(namespace);
        const memory = await memoryService.remember({
          content,
          userId: ctx.userId,
          namespaceId,
          type: type as MemoryType | undefined,
          tags,
          metadata,
          source: {
            client: ctx.clientName,
            sessionId: ctx.sessionId,
            timestamp: new Date().toISOString(),
          },
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                id: memory.id,
                type: memory.type,
                status: memory.status,
                tags: memory.tags.map(t => t.tag),
                preview: memory.content.substring(0, 200),
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
}
