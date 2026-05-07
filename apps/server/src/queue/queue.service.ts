import { Injectable, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import PgBoss from 'pg-boss';
import { env } from '../config/env';

@Injectable()
export class QueueService implements OnApplicationBootstrap, OnApplicationShutdown {
  readonly boss = new PgBoss(env.DATABASE_URL);

  async onApplicationBootstrap(): Promise<void> {
    await this.boss.start();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.boss.stop({ graceful: true, timeout: 5000 });
  }

  async send<T extends object>(queue: string, data: T, options?: PgBoss.SendOptions): Promise<string | null> {
    return this.boss.send(queue, data as object, options ?? {});
  }

  async work<T extends object>(queue: string, handler: PgBoss.WorkHandler<T, void>): Promise<string> {
    return this.boss.work(queue, handler);
  }
}
