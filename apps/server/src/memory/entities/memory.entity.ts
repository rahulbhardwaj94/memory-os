import type { Prisma } from '@prisma/client';

/** Memory record with its tags, as returned by MemoryService CRUD operations. */
export type MemoryWithTags = Prisma.MemoryGetPayload<{ include: { tags: true } }>;

/** MemoryWithTags enriched with a hybrid similarity+recency+access score from recall(). */
export type MemoryRecordWithScore = MemoryWithTags & { score: number };
