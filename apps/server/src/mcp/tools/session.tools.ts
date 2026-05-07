import { z } from 'zod/v3';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { WorkingMemoryService } from '../../working-memory/working-memory.service';

type Context = { sessionId: string };

export function registerSessionTools(
  server: McpServer,
  workingMemory: WorkingMemoryService,
  ctx: Context,
): void {
  server.registerTool(
    'session_remember',
    {
      description:
        'Add a note to your ephemeral session memory. ' +
        'Session memory is fast and private to this conversation — it is not persisted to the vault ' +
        'and disappears when the session expires. Use it to hold working context, scratch-pad notes, ' +
        'or intermediate results during a task.',
      inputSchema: {
        content: z.string().min(1).max(5_000).describe('The content to add to session memory'),
      },
    },
    ({ content }) => {
      workingMemory.remember(ctx.sessionId, content);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ ok: true, sessionId: ctx.sessionId }) }],
      };
    },
  );

  server.registerTool(
    'session_recall',
    {
      description:
        'Retrieve everything stored in ephemeral session memory for this conversation. ' +
        'Returns entries in the order they were added.',
      inputSchema: {},
    },
    () => {
      const entries = workingMemory.recall(ctx.sessionId);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ sessionId: ctx.sessionId, entries }) }],
      };
    },
  );

  server.registerTool(
    'session_clear',
    {
      description: 'Wipe all ephemeral session memory for this conversation.',
      inputSchema: {},
    },
    () => {
      workingMemory.clear(ctx.sessionId);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ ok: true, cleared: true }) }],
      };
    },
  );
}
