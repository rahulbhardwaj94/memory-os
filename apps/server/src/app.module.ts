import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { EmbeddingsModule } from './embeddings/embeddings.module';
import { MemoryModule } from './memory/memory.module';
import { QueueModule } from './queue/queue.module';
import { WorkingMemoryModule } from './working-memory/working-memory.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './auth/auth.guard';
import { env } from './config/env';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: env.RATE_LIMIT_TTL_MS, limit: env.RATE_LIMIT_MAX }]),
    PrismaModule,
    EmbeddingsModule,
    QueueModule,
    MemoryModule,
    WorkingMemoryModule,
    HealthModule,
    AuthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
