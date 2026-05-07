import { z } from 'zod';
import { MemoryType } from '@prisma/client';

// ─── Source ──────────────────────────────────────────────────────────────────

export const SourceSchema = z.object({
  client: z.string().min(1),
  sessionId: z.string().min(1),
  timestamp: z.string().datetime(),
});
export type Source = z.infer<typeof SourceSchema>;

// ─── Remember ────────────────────────────────────────────────────────────────

export const RememberInputSchema = z.object({
  content: z.string().min(1).max(10_000),
  userId: z.string().min(1),
  namespaceId: z.string().min(1),
  type: z.nativeEnum(MemoryType).optional(),
  tags: z.array(z.string().min(1).max(100)).default([]),
  metadata: z.record(z.string(), z.unknown()).default({}),
  source: SourceSchema,
});
export type RememberInput = z.infer<typeof RememberInputSchema>;

// ─── Recall ──────────────────────────────────────────────────────────────────

export const RecallInputSchema = z.object({
  query: z.string().min(1).max(1_000),
  userId: z.string().min(1),
  namespaceId: z.string().min(1).optional(),
  includeDescendants: z.boolean().default(true),
  type: z.nativeEnum(MemoryType).optional(),
  tag: z.string().min(1).optional(),
  since: z.coerce.date().optional(),
  until: z.coerce.date().optional(),
  limit: z.number().int().min(1).max(50).default(10),
  minScore: z.number().min(0).max(1).optional(),
});
export type RecallInput = z.infer<typeof RecallInputSchema>;

// ─── Forget ──────────────────────────────────────────────────────────────────

export const ForgetInputSchema = z.object({
  memoryId: z.string().min(1),
  userId: z.string().min(1),
});
export type ForgetInput = z.infer<typeof ForgetInputSchema>;

// ─── List ────────────────────────────────────────────────────────────────────

export const ListInputSchema = z.object({
  userId: z.string().min(1),
  namespaceId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).optional(),
});
export type ListInput = z.infer<typeof ListInputSchema>;

// ─── Relate ──────────────────────────────────────────────────────────────────

export const RelateInputSchema = z.object({
  fromMemoryId: z.string().min(1),
  toMemoryId: z.string().min(1),
  relationType: z.string().min(1).max(100),
  weight: z.number().min(0).max(1).default(1.0),
});
export type RelateInput = z.infer<typeof RelateInputSchema>;

// ─── Traverse ────────────────────────────────────────────────────────────────

export const TraverseInputSchema = z.object({
  memoryId: z.string().min(1),
  userId: z.string().min(1),
  maxDepth: z.number().int().min(1).max(5).default(2),
});
export type TraverseInput = z.infer<typeof TraverseInputSchema>;

// ─── Namespace ───────────────────────────────────────────────────────────────

export const CreateNamespaceInputSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1).max(200),
  parentId: z.string().min(1).optional(),
});
export type CreateNamespaceInput = z.infer<typeof CreateNamespaceInputSchema>;

// ─── Ephemeral Namespace ──────────────────────────────────────────────────────

export const EphemeralTtlSchema = z.enum(['1h', '24h', '7d']);
export type EphemeralTtl = z.infer<typeof EphemeralTtlSchema>;

export const CreateEphemeralNamespaceInputSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1).max(200),
  ttl: EphemeralTtlSchema,
});
export type CreateEphemeralNamespaceInput = z.infer<typeof CreateEphemeralNamespaceInputSchema>;
