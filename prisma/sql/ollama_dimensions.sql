-- Ollama vector dimension migration (768 dims for nomic-embed-text)
-- Run via: npm run migrate:ollama
-- Only needed when switching from the default OpenAI schema (1536 dims) to Ollama.
-- For fresh installs with Ollama: run `npm run migrate` first, then this.

ALTER TABLE "Memory" ALTER COLUMN embedding TYPE vector(768) USING NULL::vector(768);

DROP INDEX IF EXISTS "memory_embedding_hnsw_idx";

CREATE INDEX "memory_embedding_hnsw_idx"
  ON "Memory" USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE embedding IS NOT NULL
    AND "deletedAt" IS NULL
    AND status = 'READY'::"MemoryStatus";
