import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryService } from '../src/memory/memory.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { EmbeddingProvider } from '../src/embeddings/embedding-provider.interface';
import { MemoryType, MemoryStatus } from '@prisma/client';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const MOCK_EMBEDDING = new Array(1536).fill(0.01) as number[];

const makeMemory = (overrides: Record<string, unknown> = {}) => ({
  id: 'mem_1',
  userId: 'usr_1',
  namespaceId: 'ns_1',
  type: MemoryType.EPISODIC,
  content: 'test content',
  status: MemoryStatus.PENDING_EMBEDDING,
  embeddingError: null,
  metadata: {},
  source: { client: 'test', sessionId: 's1', timestamp: new Date().toISOString() },
  createdAt: new Date(),
  updatedAt: new Date(),
  accessCount: BigInt(0),
  lastAccessedAt: null,
  deletedAt: null,
  tags: [],
  ...overrides,
});

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('MemoryService', () => {
  let service: MemoryService;
  let prisma: {
    memory: Record<string, ReturnType<typeof vi.fn>>;
    memoryTag: Record<string, ReturnType<typeof vi.fn>>;
    memoryRelation: Record<string, ReturnType<typeof vi.fn>>;
    namespace: Record<string, ReturnType<typeof vi.fn>>;
    $executeRaw: ReturnType<typeof vi.fn>;
    $queryRaw: ReturnType<typeof vi.fn>;
  };
  let embeddingProvider: {
    embed: ReturnType<typeof vi.fn>;
    embedBatch: ReturnType<typeof vi.fn>;
    dimensions: number;
  };

  beforeEach(() => {
    embeddingProvider = {
      embed: vi.fn().mockResolvedValue(MOCK_EMBEDDING),
      embedBatch: vi.fn().mockResolvedValue([MOCK_EMBEDDING]),
      dimensions: 1536,
    };

    prisma = {
      memory: {
        create: vi.fn().mockResolvedValue(makeMemory()),
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue(makeMemory()),
        delete: vi.fn().mockResolvedValue(makeMemory()),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      memoryTag: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      memoryRelation: {
        create: vi.fn().mockResolvedValue({}),
        findMany: vi.fn().mockResolvedValue([]),
      },
      namespace: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: 'ns_1', name: 'default', parentId: null, userId: 'usr_1', createdAt: new Date() }),
      },
      $executeRaw: vi.fn().mockResolvedValue(1),
      $queryRaw: vi.fn().mockResolvedValue([]),
    };

    // Bypass NestJS DI — @Injectable() is a marker; the constructor works as a plain class.
    service = new MemoryService(
      prisma as unknown as PrismaService,
      embeddingProvider as unknown as EmbeddingProvider,
    );
  });

  // ─── remember ──────────────────────────────────────────────────────────────

  describe('remember', () => {
    const baseInput = {
      content: 'I prefer TypeScript over Python',
      userId: 'usr_1',
      namespaceId: 'ns_1',
      source: { client: 'test', sessionId: 's1', timestamp: new Date().toISOString() },
    };

    it('creates a memory with PENDING_EMBEDDING status', async () => {
      await service.remember(baseInput);

      expect(prisma.memory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: MemoryStatus.PENDING_EMBEDDING,
            userId: 'usr_1',
            namespaceId: 'ns_1',
          }),
        }),
      );
    });

    it('auto-classifies "I prefer" content as SEMANTIC', async () => {
      await service.remember(baseInput);

      const call = prisma.memory.create.mock.calls[0] as [{ data: { type: MemoryType } }][];
      expect(call[0]?.data.type).toBe(MemoryType.SEMANTIC);
    });

    it('respects explicit type override', async () => {
      await service.remember({ ...baseInput, type: MemoryType.EPISODIC });

      const call = prisma.memory.create.mock.calls[0] as [{ data: { type: MemoryType } }][];
      expect(call[0]?.data.type).toBe(MemoryType.EPISODIC);
    });

    it('classifies "today I worked on" as EPISODIC', async () => {
      await service.remember({ ...baseInput, content: 'today I worked on the auth bug' });

      const call = prisma.memory.create.mock.calls[0] as [{ data: { type: MemoryType } }][];
      expect(call[0]?.data.type).toBe(MemoryType.EPISODIC);
    });

    it('classifies "in order to deploy, first run" as PROCEDURAL', async () => {
      await service.remember({ ...baseInput, content: 'in order to deploy, first run tests' });

      const call = prisma.memory.create.mock.calls[0] as [{ data: { type: MemoryType } }][];
      expect(call[0]?.data.type).toBe(MemoryType.PROCEDURAL);
    });

    it('returns the created memory with tags', async () => {
      const mem = makeMemory({ tags: [{ memoryId: 'mem_1', tag: 'typescript', createdAt: new Date() }] });
      prisma.memory.create.mockResolvedValue(mem);

      const result = await service.remember(baseInput);
      expect(result.tags).toHaveLength(1);
    });
  });

  // ─── recall ────────────────────────────────────────────────────────────────

  describe('recall', () => {
    const baseInput = { query: 'what frameworks do I prefer', userId: 'usr_1' };

    it('embeds the query before searching', async () => {
      await service.recall(baseInput);
      expect(embeddingProvider.embed).toHaveBeenCalledWith(baseInput.query);
    });

    it('returns empty array when no results', async () => {
      const results = await service.recall(baseInput);
      expect(results).toEqual([]);
    });

    it('re-ranks raw rows by hybrid score', async () => {
      const now = new Date();
      const old = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 days ago

      const rows = [
        { ...makeMemory({ id: 'mem_old', createdAt: old, accessCount: BigInt(0) }), cosine_score: 0.9 },
        { ...makeMemory({ id: 'mem_new', createdAt: now, accessCount: BigInt(100) }), cosine_score: 0.8 },
      ];
      prisma.$queryRaw.mockResolvedValue(rows);

      const results = await service.recall(baseInput);

      // mem_new should rank higher due to recency + access boosts even with lower cosine
      const ids = results.map(r => r.id);
      expect(ids[0]).toBe('mem_new');
    });
  });

  // ─── forget ────────────────────────────────────────────────────────────────

  describe('forget', () => {
    it('soft-deletes by setting deletedAt', async () => {
      await service.forget('mem_1', 'usr_1');

      expect(prisma.memory.updateMany).toHaveBeenCalledWith({
        where: { id: 'mem_1', userId: 'usr_1', deletedAt: null },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      });
    });
  });

  // ─── list ──────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('filters by userId and excludes deleted memories', async () => {
      await service.list({ userId: 'usr_1', limit: 10 });

      expect(prisma.memory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'usr_1', deletedAt: null }),
        }),
      );
    });

    it('orders by createdAt descending', async () => {
      await service.list({ userId: 'usr_1' });

      expect(prisma.memory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });
  });

  // ─── relate ────────────────────────────────────────────────────────────────

  describe('relate', () => {
    it('creates a MemoryRelation edge', async () => {
      await service.relate({
        fromMemoryId: 'mem_a',
        toMemoryId: 'mem_b',
        relationType: 'SUPPORTS',
        weight: 0.8,
      });

      expect(prisma.memoryRelation.create).toHaveBeenCalledWith({
        data: { fromMemoryId: 'mem_a', toMemoryId: 'mem_b', relationType: 'SUPPORTS', weight: 0.8 },
      });
    });
  });

  // ─── traverse ──────────────────────────────────────────────────────────────

  describe('traverse', () => {
    it('returns empty array when no relations exist', async () => {
      prisma.memoryRelation.findMany.mockResolvedValue([]);
      const results = await service.traverse({ memoryId: 'mem_1', userId: 'usr_1' });
      expect(results).toEqual([]);
    });

    it('returns neighbor memories up to maxDepth', async () => {
      const neighbor = makeMemory({ id: 'mem_2' });
      prisma.memoryRelation.findMany
        .mockResolvedValueOnce([{ fromMemoryId: 'mem_1', toMemoryId: 'mem_2', relationType: 'RELATED', weight: 1 }])
        .mockResolvedValue([]);
      prisma.memory.findFirst.mockResolvedValue(neighbor);

      const results = await service.traverse({ memoryId: 'mem_1', userId: 'usr_1', maxDepth: 1 });
      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe('mem_2');
    });
  });

  // ─── createNamespace ───────────────────────────────────────────────────────

  describe('createNamespace', () => {
    it('creates a new namespace when none exists', async () => {
      prisma.namespace.findFirst.mockResolvedValue(null);

      await service.createNamespace({ userId: 'usr_1', name: 'personal' });

      expect(prisma.namespace.create).toHaveBeenCalledWith({
        data: { userId: 'usr_1', name: 'personal', parentId: undefined },
      });
    });

    it('returns existing namespace without creating a duplicate', async () => {
      const existing = { id: 'ns_existing', name: 'personal', parentId: null, userId: 'usr_1', createdAt: new Date() };
      prisma.namespace.findFirst.mockResolvedValue(existing);

      const result = await service.createNamespace({ userId: 'usr_1', name: 'personal' });

      expect(prisma.namespace.create).not.toHaveBeenCalled();
      expect(result.id).toBe('ns_existing');
    });
  });

  // ─── purgeExpiredDeletions ─────────────────────────────────────────────────

  describe('purgeExpiredDeletions', () => {
    it('hard-deletes memories with deletedAt older than 30 days', async () => {
      prisma.memory.deleteMany.mockResolvedValue({ count: 3 });

      const count = await service.purgeExpiredDeletions();

      expect(count).toBe(3);
      expect(prisma.memory.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: expect.objectContaining({ lt: expect.any(Date) }),
          }),
        }),
      );
    });
  });
});
