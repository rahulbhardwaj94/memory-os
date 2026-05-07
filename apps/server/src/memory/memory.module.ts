import { Module } from '@nestjs/common';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { MemoryService } from './memory.service';
import { MemoryController } from './memory.controller';
import { EmbeddingWorker } from './embedding.worker';

@Module({
  imports: [EmbeddingsModule],
  providers: [MemoryService, EmbeddingWorker],
  controllers: [MemoryController],
  exports: [MemoryService],
})
export class MemoryModule {}
