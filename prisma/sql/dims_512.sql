-- 512-dimension migration — for Voyage AI voyage-3-lite
-- Run via: npm run migrate:voyage
-- For fresh installs: run `npm run migrate` first, then this.

ALTER TABLE "Memory" ALTER COLUMN embedding TYPE vector(512) USING NULL::vector(512);

DROP INDEX IF EXISTS "memory_embedding_hnsw_idx";

CREATE INDEX "memory_embedding_hnsw_idx"
  ON "Memory" USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE embedding IS NOT NULL
    AND "deletedAt" IS NULL
    AND status = 'READY'::"MemoryStatus";
