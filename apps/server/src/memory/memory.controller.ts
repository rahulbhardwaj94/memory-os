import { Controller, Post, Get, Delete, Body, Param, Query } from '@nestjs/common';
import { MemoryService } from './memory.service';
import type {
  RememberInput,
  RecallInput,
  ListInput,
  RelateInput,
  TraverseInput,
  CreateNamespaceInput,
} from './dto';

/**
 * REST interface — secondary to MCP. All endpoints accept JSON body.
 * No auth in v0.1: callers must supply userId in the request body.
 */
@Controller('memories')
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  @Post()
  remember(@Body() body: RememberInput) {
    return this.memoryService.remember(body);
  }

  @Post('recall')
  recall(@Body() body: RecallInput) {
    return this.memoryService.recall(body);
  }

  @Delete(':id')
  forget(@Param('id') id: string, @Query('userId') userId: string) {
    return this.memoryService.forget(id, userId);
  }

  @Get()
  list(@Query() query: ListInput) {
    return this.memoryService.list(query);
  }

  @Post('relate')
  relate(@Body() body: RelateInput) {
    return this.memoryService.relate(body);
  }

  @Post('traverse')
  traverse(@Body() body: TraverseInput) {
    return this.memoryService.traverse(body);
  }

  @Post('namespaces')
  createNamespace(@Body() body: CreateNamespaceInput) {
    return this.memoryService.createNamespace(body);
  }

  @Get('namespaces')
  listNamespaces(@Query('userId') userId: string, @Query('parentId') parentId?: string) {
    return this.memoryService.listNamespaces(userId, parentId);
  }
}
