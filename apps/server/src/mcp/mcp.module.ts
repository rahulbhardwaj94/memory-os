import { Module } from '@nestjs/common';
import { MemoryModule } from '../memory/memory.module';

/** Placeholder module — MCP server runs as a separate process via mcp-server.ts. */
@Module({
  imports: [MemoryModule],
})
export class McpModule {}
