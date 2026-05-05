import { Injectable, Inject } from '@nestjs/common';
import { Prisma, MemoryType, MemoryStatus } from '@prisma/client';
import type { Namespace } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EMBEDDING_PROVIDER, EmbeddingProvider } from '../embeddings/embedding-provider.interface';
import type { MemoryWithTags, MemoryRecordWithScore } from './entities/memory.entity';
import {
  RememberInputSchema,
  RecallInputSchema,
  ListInputSchema,
  RelateInputSchema,
  TraverseInputSchema,
  CreateNamespaceInputSchema,
  type RememberInput,
  type RecallInput,
  type ListInput,
  type RelateInput,
  type TraverseInput,
  type CreateNamespaceInput,
} from './dto';

type RawRecallRow = {
  id: string;
  userId: string;
  namespaceId: string;
  type: MemoryType;
  content: string;
  status: MemoryStatus;
  embeddingError: string | null;
  metadata: Prisma.JsonValue;
  source: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
  accessCount: bigint;
  lastAccessedAt: Date | null;
  deletedAt: Date | null;
  cosine_score: number;
};

@Injectable()
export class MemoryService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMBEDDING_PROVIDER)
    private readonly embeddingProvider: EmbeddingProvider,
  ) {}

  /**
   * Store a new memory. Type is auto-classified if not provided.
   * Embedding is generated asynchronously (fire-and-forget); the memory is
   * immediately available with status PENDING_EMBEDDING.
   *
   * @example
   * const mem = await service.remember({
   *   content: "I prefer NestJS over Express",
   *   userId: "usr_abc",
   *   namespaceId: "ns_xyz",
   *   source: { client: "claude-desktop", sessionId: "s1", timestamp: new Date().toISOString() },
   * });
   */
  async remember(input: RememberInput): Promise<MemoryWithTags> {
    const parsed = RememberInputSchema.parse(input);

    const type = parsed.type ?? this.classifyType(parsed.content);
    const autoTags = this.extractTags(parsed.content);
    const allTags = [...new Set([...parsed.tags, ...autoTags])];

    const memory = await this.prisma.memory.create({
      data: {
        userId: parsed.userId,
        namespaceId: parsed.namespaceId,
        type,
        content: parsed.content,
        status: MemoryStatus.PENDING_EMBEDDING,
        metadata: parsed.metadata as Prisma.InputJsonValue,
        source: parsed.source as Prisma.InputJsonValue,
        tags: {
          createMany: {
            data: allTags.map(tag => ({ tag })),
            skipDuplicates: true,
          },
        },
      },
      include: { tags: true },
    });

    // Non-blocking: generate embedding after returning
    setImmediate(() => void this.generateEmbedding(memory.id, parsed.content));

    return memory;
  }

  /**
   * Hybrid search: vector similarity (cosine) + recency decay + access-count boost.
   * Only searches READY memories (embedding generated). Filters by namespace,
   * type, tag, and date range. Updates lastAccessedAt and accessCount on hits.
   *
   * @example
   * const results = await service.recall({
   *   query: "what frameworks do I prefer?",
   *   userId: "usr_abc",
   *   limit: 5,
   * });
   */
  async recall(input: RecallInput): Promise<MemoryRecordWithScore[]> {
    const parsed = RecallInputSchema.parse(input);

    let namespaceIds: string[] | undefined;
    if (parsed.namespaceId) {
      namespaceIds = parsed.includeDescendants
        ? await this.getDescendantNamespaceIds(parsed.namespaceId)
        : [parsed.namespaceId];
    }

    let taggedMemoryIds: string[] | undefined;
    if (parsed.tag) {
      const tagged = await this.prisma.memoryTag.findMany({
        where: { tag: parsed.tag },
        select: { memoryId: true },
      });
      taggedMemoryIds = tagged.map(t => t.memoryId);
      if (taggedMemoryIds.length === 0) return [];
    }

    const queryEmbedding = await this.embeddingProvider.embed(parsed.query);
    // Safe: vectorStr is built from number[] produced by the embedding provider
    const vecLiteral = Prisma.raw(`'[${queryEmbedding.join(',')}]'`);

    const conditions: Prisma.Sql[] = [
      Prisma.sql`m."userId" = ${parsed.userId}`,
      Prisma.sql`m.status = 'READY'::"MemoryStatus"`,
      Prisma.sql`m."deletedAt" IS NULL`,
      Prisma.sql`m.embedding IS NOT NULL`,
    ];

    if (namespaceIds && namespaceIds.length > 0) {
      conditions.push(
        Prisma.sql`m."namespaceId" = ANY(ARRAY[${Prisma.join(namespaceIds.map(id => Prisma.sql`${id}`))}]::text[])`,
      );
    }
    if (parsed.type) {
      conditions.push(Prisma.sql`m.type = ${parsed.type}::"MemoryType"`);
    }
    if (taggedMemoryIds && taggedMemoryIds.length > 0) {
      conditions.push(
        Prisma.sql`m.id = ANY(ARRAY[${Prisma.join(taggedMemoryIds.map(id => Prisma.sql`${id}`))}]::text[])`,
      );
    }
    if (parsed.since) {
      conditions.push(Prisma.sql`m."createdAt" >= ${parsed.since}`);
    }
    if (parsed.until) {
      conditions.push(Prisma.sql`m."createdAt" <= ${parsed.until}`);
    }

    const whereClause = Prisma.join(conditions, ' AND ');
    const topN = Prisma.raw(String(parsed.limit * 2));

    const rows = await this.prisma.$queryRaw<RawRecallRow[]>(Prisma.sql`
      SELECT
        m.id, m."userId", m."namespaceId", m.type, m.content, m.status,
        m."embeddingError", m.metadata, m.source, m."createdAt", m."updatedAt",
        m."accessCount", m."lastAccessedAt", m."deletedAt",
        (1 - (m.embedding <=> ${vecLiteral}::vector))::float8 AS cosine_score
      FROM "Memory" m
      WHERE ${whereClause}
      ORDER BY m.embedding <=> ${vecLiteral}::vector
      LIMIT ${topN}
    `);

    const now = Date.now();
    const ranked = rows
      .map(row => {
        const ageDays = (now - row.createdAt.getTime()) / 86_400_000;
        const recencyBoost = Math.exp(-ageDays / 30);
        const accessBoost = Math.log1p(Number(row.accessCount)) / 10;
        const score = 0.7 * row.cosine_score + 0.2 * recencyBoost + 0.1 * accessBoost;
        return { ...row, score, tags: [] as { memoryId: string; tag: string; createdAt: Date }[] };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, parsed.limit);

    if (ranked.length > 0) {
      const ids = ranked.map(r => r.id);
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE "Memory"
        SET "accessCount" = "accessCount" + 1, "lastAccessedAt" = NOW()
        WHERE id = ANY(ARRAY[${Prisma.join(ids.map(id => Prisma.sql`${id}`))}]::text[])
      `);

      const tags = await this.prisma.memoryTag.findMany({
        where: { memoryId: { in: ids } },
      });
      const tagsByMemory = new Map<string, typeof tags>();
      for (const tag of tags) {
        const existing = tagsByMemory.get(tag.memoryId) ?? [];
        existing.push(tag);
        tagsByMemory.set(tag.memoryId, existing);
      }
      for (const row of ranked) {
        row.tags = tagsByMemory.get(row.id) ?? [];
      }
    }

    return ranked;
  }

  /**
   * Soft-delete a memory by setting deletedAt. Hard deletion runs after 30 days.
   *
   * @example
   * await service.forget("mem_abc123", "usr_xyz");
   */
  async forget(memoryId: string, userId: string): Promise<void> {
    await this.prisma.memory.updateMany({
      where: { id: memoryId, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Paginated list of memories sorted by recency.
   *
   * @example
   * const page = await service.list({ userId: "usr_abc", limit: 20 });
   */
  async list(input: ListInput): Promise<MemoryWithTags[]> {
    const parsed = ListInputSchema.parse(input);

    return this.prisma.memory.findMany({
      where: {
        userId: parsed.userId,
        ...(parsed.namespaceId ? { namespaceId: parsed.namespaceId } : {}),
        deletedAt: null,
        ...(parsed.cursor ? { createdAt: { lt: new Date(parsed.cursor) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: parsed.limit,
      include: { tags: true },
    });
  }

  /**
   * Create a directed weighted edge between two memories in the graph layer.
   *
   * @example
   * await service.relate({
   *   fromMemoryId: "mem_a",
   *   toMemoryId: "mem_b",
   *   relationType: "SUPPORTS",
   *   weight: 0.9,
   * });
   */
  async relate(input: RelateInput): Promise<void> {
    const parsed = RelateInputSchema.parse(input);
    await this.prisma.memoryRelation.create({
      data: {
        fromMemoryId: parsed.fromMemoryId,
        toMemoryId: parsed.toMemoryId,
        relationType: parsed.relationType,
        weight: parsed.weight,
      },
    });
  }

  /**
   * BFS traversal of the memory graph up to maxDepth hops.
   * Returns all reachable non-deleted memories owned by userId.
   *
   * @example
   * const related = await service.traverse({ memoryId: "mem_a", userId: "usr_xyz", maxDepth: 2 });
   */
  async traverse(input: TraverseInput): Promise<MemoryWithTags[]> {
    const parsed = TraverseInputSchema.parse(input);

    const visited = new Set<string>([parsed.memoryId]);
    const queue: Array<{ id: string; depth: number }> = [{ id: parsed.memoryId, depth: 0 }];
    const results: MemoryWithTags[] = [];

    while (queue.length > 0) {
      const item = queue.shift();
      if (!item || item.depth >= parsed.maxDepth) continue;

      const relations = await this.prisma.memoryRelation.findMany({
        where: { OR: [{ fromMemoryId: item.id }, { toMemoryId: item.id }] },
      });

      for (const rel of relations) {
        const neighborId = rel.fromMemoryId === item.id ? rel.toMemoryId : rel.fromMemoryId;
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push({ id: neighborId, depth: item.depth + 1 });

          const memory = await this.prisma.memory.findFirst({
            where: { id: neighborId, userId: parsed.userId, deletedAt: null },
            include: { tags: true },
          });
          if (memory) results.push(memory);
        }
      }
    }

    return results;
  }

  /**
   * Retrieve a single memory by ID, scoped to userId.
   *
   * @example
   * const mem = await service.getMemory("mem_abc", "usr_xyz");
   */
  async getMemory(memoryId: string, userId: string): Promise<MemoryWithTags | null> {
    return this.prisma.memory.findFirst({
      where: { id: memoryId, userId, deletedAt: null },
      include: { tags: true },
    });
  }

  /**
   * Create a namespace, find-then-create to handle the nullable parentId unique quirk.
   *
   * @example
   * const ns = await service.createNamespace({ userId: "usr_abc", name: "work" });
   */
  async createNamespace(input: CreateNamespaceInput): Promise<Namespace> {
    const parsed = CreateNamespaceInputSchema.parse(input);

    // find-then-create avoids the NULL != NULL unique constraint edge case
    const existing = await this.prisma.namespace.findFirst({
      where: { userId: parsed.userId, name: parsed.name, parentId: parsed.parentId ?? null },
    });
    if (existing) return existing;

    return this.prisma.namespace.create({
      data: { userId: parsed.userId, name: parsed.name, parentId: parsed.parentId },
    });
  }

  /**
   * List namespaces for a user, optionally filtered by parentId.
   *
   * @example
   * const roots = await service.listNamespaces("usr_abc");
   */
  async listNamespaces(userId: string, parentId?: string): Promise<Namespace[]> {
    return this.prisma.namespace.findMany({
      where: { userId, parentId: parentId ?? null },
      orderBy: { name: 'asc' },
    });
  }

  /** Hard-delete memories soft-deleted more than 30 days ago. Intended to be called by a cron job. */
  async purgeExpiredDeletions(): Promise<number> {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = await this.prisma.memory.deleteMany({
      where: { deletedAt: { lt: cutoff } },
    });
    return result.count;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private classifyType(content: string): MemoryType {
    const lower = content.toLowerCase();

    if (/\b(i prefer|always|never|i use|my preferred|i like|i don't like|i hate|i love|i always|i never)\b/.test(lower)) {
      return MemoryType.SEMANTIC;
    }
    if (/\b(in order to|to do .+,|first .+then|step \d|when .+check|how to|the process is|the steps are)\b/.test(lower)) {
      return MemoryType.PROCEDURAL;
    }
    if (/\b(today|yesterday|last week|this morning|just finished|worked on|fixed|debugged|discovered|on (monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/.test(lower)) {
      return MemoryType.EPISODIC;
    }

    return MemoryType.EPISODIC;
  }

  private extractTags(content: string): string[] {
    const tags = new Set<string>();

    for (const m of content.matchAll(/#(\w{2,50})/g)) {
      if (m[1]) tags.add(m[1].toLowerCase());
    }

    // PascalCase proper nouns and tech identifiers
    for (const m of content.matchAll(/\b([A-Z][a-z]{2,}(?:[A-Z][a-z]+)*)\b/g)) {
      if (m[1] && m[1].length <= 50) tags.add(m[1].toLowerCase());
    }

    return [...tags].slice(0, 20);
  }

  private async generateEmbedding(memoryId: string, content: string): Promise<void> {
    try {
      const embedding = await this.embeddingProvider.embed(content);
      // Safe: embedding is number[] from our provider — no injection risk
      const vecLiteral = Prisma.raw(`'[${embedding.join(',')}]'`);
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE "Memory"
        SET embedding      = ${vecLiteral}::vector,
            status         = 'READY'::"MemoryStatus",
            "embeddingError" = NULL
        WHERE id = ${memoryId}
      `);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.memory.update({
        where: { id: memoryId },
        data: { status: MemoryStatus.FAILED, embeddingError: message },
      });
    }
  }

  private async getDescendantNamespaceIds(namespaceId: string): Promise<string[]> {
    const ids = [namespaceId];
    const queue = [namespaceId];

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (!currentId) continue;

      const children = await this.prisma.namespace.findMany({
        where: { parentId: currentId },
        select: { id: true },
      });

      for (const child of children) {
        if (!ids.includes(child.id)) {
          ids.push(child.id);
          queue.push(child.id);
        }
      }
    }

    return ids;
  }
}
