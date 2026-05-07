import { Injectable, Inject, OnApplicationBootstrap } from '@nestjs/common';
import { Prisma, MemoryStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { EMBEDDING_PROVIDER, EmbeddingProvider } from '../embeddings/embedding-provider.interface';

export const EMBEDDING_QUEUE = 'embed-memory';

@Injectable()
export class EmbeddingWorker implements OnApplicationBootstrap {
  constructor(
    private readonly queue: QueueService,
    private readonly prisma: PrismaService,
    @Inject(EMBEDDING_PROVIDER) private readonly embeddingProvider: EmbeddingProvider,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.work<{ memoryId: string; content: string }>(
      EMBEDDING_QUEUE,
      async job => {
        await this.process(job.data.memoryId, job.data.content);
      },
    );
  }

  private async process(memoryId: string, content: string): Promise<void> {
    try {
      const embedding = await this.embeddingProvider.embed(content);
      // Safe: embedding is number[] from our provider — no injection risk
      const vecLiteral = Prisma.raw(`'[${embedding.join(',')}]'`);
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE "Memory"
        SET embedding        = ${vecLiteral}::vector,
            status           = 'READY'::"MemoryStatus",
            "embeddingError" = NULL
        WHERE id = ${memoryId}
      `);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.memory.update({
        where: { id: memoryId },
        data: { status: MemoryStatus.FAILED, embeddingError: message },
      });
      throw err; // rethrow so pg-boss records the failure and retries
    }
  }
}
