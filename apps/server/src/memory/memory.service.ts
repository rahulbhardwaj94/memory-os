import { Injectable, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma, MemoryType, MemoryStatus } from '@prisma/client';
import type { Namespace } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EMBEDDING_PROVIDER, EmbeddingProvider } from '../embeddings/embedding-provider.interface';
import { QueueService } from '../queue/queue.service';
import { EMBEDDING_QUEUE } from './embedding.worker';
import type { MemoryWithTags, MemoryRecordWithScore } from './entities/memory.entity';
import {
  RememberInputSchema,
  RecallInputSchema,
  ListInputSchema,
  RelateInputSchema,
  TraverseInputSchema,
  CreateNamespaceInputSchema,
  CreateEphemeralNamespaceInputSchema,
  type RememberInput,
  type RecallInput,
  type ListInput,
  type RelateInput,
  type TraverseInput,
  type CreateNamespaceInput,
  type CreateEphemeralNamespaceInput,
} from './dto';

// ─── Pack Catalog ─────────────────────────────────────────────────────────────

type PackMemoryEntry = { content: string; type: MemoryType; tags: string[] };
type MemoryPack = {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  tags: string[];
  memories: PackMemoryEntry[];
};

const PACK_CATALOG: MemoryPack[] = [
  {
    id: 'system-design-patterns',
    name: 'System Design Patterns',
    description: 'Core distributed systems patterns every backend engineer should internalize.',
    version: '1.0.0',
    author: 'memory-os',
    tags: ['architecture', 'distributed-systems', 'backend'],
    memories: [
      { content: 'When designing distributed caches, consistent hashing ensures that only K/N keys are remapped when a node is added or removed (K = keys, N = nodes), minimising cache stampedes.', type: MemoryType.SEMANTIC, tags: ['caching', 'consistent-hashing'] },
      { content: 'CAP theorem: a distributed system can guarantee at most two of Consistency, Availability, and Partition Tolerance simultaneously. Under network partitions, choose between CP (strong consistency, e.g. HBase) or AP (high availability, e.g. Cassandra).', type: MemoryType.SEMANTIC, tags: ['cap-theorem', 'distributed-systems'] },
      { content: 'CQRS separates read and write models. Commands mutate state; queries read from optimised projections. Use when read and write workloads have very different scalability requirements.', type: MemoryType.PROCEDURAL, tags: ['cqrs', 'architecture'] },
      { content: 'Event sourcing stores every state change as an immutable event in an append-only log. Current state is derived by replaying events. Enables full audit trail, temporal queries, and event-driven integration.', type: MemoryType.SEMANTIC, tags: ['event-sourcing', 'architecture'] },
      { content: 'The circuit breaker pattern wraps a remote call in a state machine: Closed (normal), Open (fail fast after threshold), Half-Open (probe with one request). Prevents cascading failures in microservices.', type: MemoryType.PROCEDURAL, tags: ['circuit-breaker', 'resilience'] },
      { content: 'The Saga pattern coordinates distributed transactions via a sequence of local transactions and compensating transactions. Choose orchestration (central coordinator) or choreography (event-driven) based on complexity.', type: MemoryType.PROCEDURAL, tags: ['saga', 'distributed-transactions'] },
      { content: 'Database sharding strategies: range-based (simple, hot-spot risk), hash-based (uniform distribution, hard to range-query), directory-based (flexible, adds lookup overhead).', type: MemoryType.SEMANTIC, tags: ['sharding', 'database', 'scalability'] },
      { content: 'Backpressure is the mechanism by which a downstream service signals it is overwhelmed. Implement with bounded queues and rejection policies (drop, block, or shed load) rather than growing queues unboundedly.', type: MemoryType.SEMANTIC, tags: ['backpressure', 'resilience', 'queues'] },
    ],
  },
  {
    id: 'typescript-best-practices',
    name: 'TypeScript Best Practices',
    description: 'Opinionated TypeScript patterns for safe, maintainable codebases.',
    version: '1.0.0',
    author: 'memory-os',
    tags: ['typescript', 'javascript', 'best-practices'],
    memories: [
      { content: "Use branded/nominal types for domain IDs to prevent mixing up different ID types at compile time. E.g.: `type UserId = string & { readonly _brand: 'UserId' }`. Create with a factory function, never cast raw strings directly.", type: MemoryType.SEMANTIC, tags: ['typescript', 'branded-types', 'type-safety'] },
      { content: 'Prefer `unknown` over `any` for values from external boundaries (API responses, JSON.parse, user input). `unknown` forces explicit narrowing before use; `any` silently disables type checking.', type: MemoryType.SEMANTIC, tags: ['typescript', 'type-safety'] },
      { content: 'Use discriminated unions with a `kind` or `type` literal field for modelling result variants. TypeScript narrows exhaustively in switch/if-else blocks, turning runtime bugs into compile errors.', type: MemoryType.PROCEDURAL, tags: ['typescript', 'discriminated-unions'] },
      { content: 'The `satisfies` operator (TS 4.9+) validates a value against a type without widening it. Use it to get both type-checking and literal inference simultaneously.', type: MemoryType.SEMANTIC, tags: ['typescript', 'satisfies'] },
      { content: 'Never use `as` type assertions as a shortcut for type mismatch. Prefer type guards (`function isUser(x: unknown): x is User`) or Zod parsing at runtime boundaries.', type: MemoryType.SEMANTIC, tags: ['typescript', 'type-guards'] },
      { content: 'Mark function parameters and return types with `readonly` / `Readonly<T>` to prevent accidental mutation. Immutable data structures make functions easier to reason about and test.', type: MemoryType.PROCEDURAL, tags: ['typescript', 'immutability'] },
      { content: 'Use `zod` (or a similar runtime validator) at every system boundary — HTTP endpoints, environment variables, external API responses. TypeScript types are erased at runtime; zod enforces them.', type: MemoryType.PROCEDURAL, tags: ['zod', 'validation', 'typescript'] },
      { content: "Template literal types enable string-level type safety for patterns like HTTP methods or CSS units: `type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'`.", type: MemoryType.SEMANTIC, tags: ['typescript', 'template-literal-types'] },
    ],
  },
  {
    id: 'aws-infrastructure',
    name: 'AWS Infrastructure Guardrails',
    description: 'Operational knowledge for safe, cost-efficient AWS deployments.',
    version: '1.0.0',
    author: 'memory-os',
    tags: ['aws', 'infrastructure', 'cloud', 'devops'],
    memories: [
      { content: 'Always deploy RDS instances in private subnets with no public accessibility. Route application traffic through a VPC with public/private subnet separation. Use security groups as the primary network firewall.', type: MemoryType.PROCEDURAL, tags: ['aws', 'rds', 'vpc', 'security'] },
      { content: 'Enable S3 bucket versioning for any bucket holding user data or deployment artifacts. Combined with lifecycle rules (expire old versions after 30 days), it provides cheap point-in-time recovery.', type: MemoryType.PROCEDURAL, tags: ['aws', 's3', 'backup'] },
      { content: 'Use RDS Proxy between your application and RDS to pool and reuse database connections. Critical for serverless workloads (Lambda) where connection counts can spike and overwhelm Postgres.', type: MemoryType.PROCEDURAL, tags: ['aws', 'rds', 'rds-proxy', 'serverless'] },
      { content: 'IAM least privilege: grant only the specific actions needed on specific resources. Prefer IAM roles for EC2/Lambda over access keys. Never embed AWS credentials in code or environment variables committed to git.', type: MemoryType.PROCEDURAL, tags: ['aws', 'iam', 'security'] },
      { content: 'Use AWS Secrets Manager (not SSM Parameter Store plain text, not .env files) for database passwords and API keys. Rotate secrets automatically. Reference by ARN in ECS task definitions.', type: MemoryType.PROCEDURAL, tags: ['aws', 'secrets-manager', 'security'] },
      { content: 'SQS + Lambda is the standard AWS pattern for decoupled async processing. Set a dead-letter queue (DLQ) on every consumer to catch poison messages. Use FIFO queues when ordering matters.', type: MemoryType.PROCEDURAL, tags: ['aws', 'sqs', 'lambda', 'async'] },
      { content: 'CloudFront should front all static assets (S3) and API endpoints. It reduces latency via edge caching, provides DDoS protection through AWS Shield Standard, and enables WAF rules.', type: MemoryType.PROCEDURAL, tags: ['aws', 'cloudfront', 'cdn'] },
      { content: 'Emit structured JSON logs (not plain strings) from your applications. CloudWatch Log Insights queries are dramatically faster on structured data. Use CloudWatch Alarms for operational monitoring.', type: MemoryType.PROCEDURAL, tags: ['aws', 'cloudwatch', 'observability'] },
    ],
  },
];

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
    private readonly queue: QueueService,
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

    await this.queue.send(EMBEDDING_QUEUE, { memoryId: memory.id, content: parsed.content }, { retryLimit: 3, retryDelay: 10 });

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
      .filter(row => parsed.minScore === undefined || row.score >= parsed.minScore)
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

  // ─── Ephemeral namespaces ────────────────────────────────────────────────────

  async createEphemeralNamespace(input: CreateEphemeralNamespaceInput): Promise<Namespace> {
    const parsed = CreateEphemeralNamespaceInputSchema.parse(input);
    const ttlMs = { '1h': 3_600_000, '24h': 86_400_000, '7d': 604_800_000 }[parsed.ttl];
    const expiresAt = new Date(Date.now() + ttlMs);
    return this.prisma.namespace.create({
      data: { userId: parsed.userId, name: parsed.name, isEphemeral: true, expiresAt },
    });
  }

  @Cron('0 * * * *')
  async purgeExpiredNamespaces(): Promise<void> {
    await this.prisma.namespace.deleteMany({
      where: { isEphemeral: true, expiresAt: { lt: new Date() } },
    });
  }

  // ─── Memory Packs ────────────────────────────────────────────────────────────

  listPackCatalog(): Array<{ id: string; name: string; description: string; author: string; version: string; memoryCount: number; tags: string[] }> {
    return PACK_CATALOG.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      author: p.author,
      version: p.version,
      memoryCount: p.memories.length,
      tags: p.tags,
    }));
  }

  async importPack(packId: string, namespaceId: string, userId: string): Promise<{ imported: number }> {
    const pack = PACK_CATALOG.find(p => p.id === packId);
    if (!pack) throw new Error(`Unknown pack: ${packId}`);

    let imported = 0;
    for (const entry of pack.memories) {
      await this.remember({
        content: entry.content,
        userId,
        namespaceId,
        type: entry.type,
        tags: entry.tags,
        metadata: { packId, packVersion: pack.version },
        source: { client: 'memory-pack', sessionId: packId, timestamp: new Date().toISOString() },
      });
      imported++;
    }
    return { imported };
  }

  // ─── Graph ───────────────────────────────────────────────────────────────────

  async getGraph(
    userId: string,
    namespaceId?: string,
    limit = 200,
  ): Promise<{
    nodes: Array<{ id: string; content: string; type: MemoryType; status: string; tags: string[] }>;
    edges: Array<{ source: string; target: string; relationType: string; weight: number }>;
  }> {
    const memories = await this.prisma.memory.findMany({
      where: { userId, deletedAt: null, ...(namespaceId ? { namespaceId } : {}) },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { tags: true },
    });

    const ids = memories.map(m => m.id);

    const relations = ids.length > 0
      ? await this.prisma.memoryRelation.findMany({
          where: { AND: [{ fromMemoryId: { in: ids } }, { toMemoryId: { in: ids } }] },
        })
      : [];

    return {
      nodes: memories.map(m => ({
        id: m.id,
        content: m.content,
        type: m.type,
        status: m.status,
        tags: m.tags.map(t => t.tag),
      })),
      edges: relations.map(r => ({
        source: r.fromMemoryId,
        target: r.toMemoryId,
        relationType: r.relationType,
        weight: r.weight,
      })),
    };
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
