import { Controller, Post, Get, Delete, Body, Param, Query, NotFoundException } from '@nestjs/common';
import { MemoryService } from './memory.service';
import { CurrentUser } from '../auth/current-user.decorator';
import type { User } from '../auth/auth';
import type {
  RecallInput,
  RelateInput,
  TraverseInput,
  CreateNamespaceInput,
} from './dto';

/** REST interface — secondary to MCP. Protected by AuthGuard (session or API key). */
@Controller('memories')
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  @Post()
  remember(
    @Body()
    body: {
      content: string;
      namespaceId: string;
      type?: 'EPISODIC' | 'SEMANTIC' | 'PROCEDURAL';
      tags?: string[];
      metadata?: Record<string, unknown>;
    },
    @CurrentUser() user: User,
  ) {
    return this.memoryService.remember({
      content: body.content,
      namespaceId: body.namespaceId,
      userId: user.id,
      type: body.type,
      tags: body.tags ?? [],
      metadata: body.metadata ?? {},
      source: { client: 'rest-api', sessionId: 'rest', timestamp: new Date().toISOString() },
    });
  }

  @Get()
  list(
    @Query('limit') limitStr: string | undefined,
    @Query('namespaceId') namespaceId: string | undefined,
    @Query('cursor') cursor: string | undefined,
    @CurrentUser() user: User,
  ) {
    return this.memoryService.list({
      userId: user.id,
      namespaceId,
      limit: limitStr ? Number(limitStr) : 20,
      cursor,
    });
  }

  @Get('namespaces')
  listNamespaces(@Query('parentId') parentId: string | undefined, @CurrentUser() user: User) {
    return this.memoryService.listNamespaces(user.id, parentId);
  }

  @Get(':id')
  async getMemory(@Param('id') id: string, @CurrentUser() user: User) {
    const memory = await this.memoryService.getMemory(id, user.id);
    if (!memory) throw new NotFoundException(`Memory ${id} not found`);
    return memory;
  }

  @Delete(':id')
  forget(@Param('id') id: string, @CurrentUser() user: User) {
    return this.memoryService.forget(id, user.id);
  }

  @Post('recall')
  recall(@Body() body: Omit<RecallInput, 'userId'>, @CurrentUser() user: User) {
    return this.memoryService.recall({ ...body, userId: user.id });
  }

  @Post('relate')
  relate(@Body() body: RelateInput) {
    return this.memoryService.relate(body);
  }

  @Post('traverse')
  traverse(@Body() body: Omit<TraverseInput, 'userId'>, @CurrentUser() user: User) {
    return this.memoryService.traverse({ ...body, userId: user.id });
  }

  @Post('namespaces')
  createNamespace(
    @Body() body: Omit<CreateNamespaceInput, 'userId'>,
    @CurrentUser() user: User,
  ) {
    return this.memoryService.createNamespace({ ...body, userId: user.id });
  }

  @Post('namespaces/ephemeral')
  createEphemeralNamespace(
    @Body() body: { name: string; ttl: '1h' | '24h' | '7d' },
    @CurrentUser() user: User,
  ) {
    return this.memoryService.createEphemeralNamespace({ ...body, userId: user.id });
  }

  @Get('packs')
  listPacks() {
    return this.memoryService.listPackCatalog();
  }

  @Post('packs/import')
  importPack(@Body() body: { packId: string; namespaceId: string }, @CurrentUser() user: User) {
    return this.memoryService.importPack(body.packId, body.namespaceId, user.id);
  }

  @Get('graph')
  getGraph(
    @Query('namespaceId') namespaceId: string | undefined,
    @Query('limit') limitStr: string | undefined,
    @CurrentUser() user: User,
  ) {
    return this.memoryService.getGraph(user.id, namespaceId, limitStr ? Number(limitStr) : 200);
  }
}
