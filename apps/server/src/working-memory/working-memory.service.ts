import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

export type WorkingMemoryEntry = { content: string; addedAt: string };
type SessionBucket = { entries: WorkingMemoryEntry[]; expiresAt: number };

@Injectable()
export class WorkingMemoryService {
  private readonly sessions = new Map<string, SessionBucket>();
  private readonly ttlMs = parseInt(process.env['SESSION_TTL_SECONDS'] ?? '3600', 10) * 1000;

  remember(sessionId: string, content: string): void {
    const existing = this.sessions.get(sessionId);
    const entries = existing?.entries ?? [];
    entries.push({ content, addedAt: new Date().toISOString() });
    this.sessions.set(sessionId, { entries, expiresAt: Date.now() + this.ttlMs });
  }

  recall(sessionId: string): WorkingMemoryEntry[] {
    const bucket = this.sessions.get(sessionId);
    if (!bucket || Date.now() > bucket.expiresAt) {
      this.sessions.delete(sessionId);
      return [];
    }
    bucket.expiresAt = Date.now() + this.ttlMs;
    return [...bucket.entries];
  }

  clear(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  @Cron('*/5 * * * *')
  purgeExpired(): void {
    const now = Date.now();
    for (const [id, bucket] of this.sessions) {
      if (now > bucket.expiresAt) this.sessions.delete(id);
    }
  }
}
