import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { EmbeddingsModule } from './embeddings/embeddings.module';
import { MemoryModule } from './memory/memory.module';

@Module({
  imports: [PrismaModule, EmbeddingsModule, MemoryModule],
})
export class AppModule {}
