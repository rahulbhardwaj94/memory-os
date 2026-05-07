import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const PREFIX = 'mo_';

function hash(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

@Injectable()
export class ApiKeyService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, name: string): Promise<{ key: string; id: string }> {
    const raw = `${PREFIX}${randomBytes(32).toString('hex')}`;
    const record = await this.prisma.apiKey.create({
      data: {
        userId,
        name,
        key: hash(raw),
        start: raw.slice(0, 8),
        prefix: PREFIX,
        enabled: true,
      },
    });
    // Return the raw key once — never retrievable again
    return { key: raw, id: record.id };
  }

  async list(userId: string) {
    return this.prisma.apiKey.findMany({
      where: { userId, enabled: true },
      select: { id: true, name: true, start: true, createdAt: true, expiresAt: true, enabled: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(id: string, userId: string): Promise<void> {
    await this.prisma.apiKey.updateMany({
      where: { id, userId },
      data: { enabled: false },
    });
  }

  async validate(rawKey: string): Promise<string | null> {
    if (!rawKey.startsWith(PREFIX)) return null;
    const record = await this.prisma.apiKey.findFirst({
      where: { key: hash(rawKey), enabled: true },
      select: { userId: true, expiresAt: true },
    });
    if (!record) return null;
    if (record.expiresAt && record.expiresAt < new Date()) return null;
    return record.userId;
  }
}
