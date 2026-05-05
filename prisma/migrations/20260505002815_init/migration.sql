-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "MemoryType" AS ENUM ('EPISODIC', 'SEMANTIC', 'PROCEDURAL');

-- CreateEnum
CREATE TYPE "MemoryStatus" AS ENUM ('PENDING_EMBEDDING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Namespace" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Namespace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Memory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "namespaceId" TEXT NOT NULL,
    "type" "MemoryType" NOT NULL,
    "content" TEXT NOT NULL,
    "status" "MemoryStatus" NOT NULL DEFAULT 'PENDING_EMBEDDING',
    "embedding" vector(1536),
    "embeddingError" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "source" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "accessCount" BIGINT NOT NULL DEFAULT 0,
    "lastAccessedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Memory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryRelation" (
    "id" TEXT NOT NULL,
    "fromMemoryId" TEXT NOT NULL,
    "toMemoryId" TEXT NOT NULL,
    "relationType" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoryRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryTag" (
    "memoryId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoryTag_pkey" PRIMARY KEY ("memoryId","tag")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Namespace_userId_idx" ON "Namespace"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Namespace_userId_name_parentId_key" ON "Namespace"("userId", "name", "parentId");

-- CreateIndex
CREATE INDEX "Memory_userId_idx" ON "Memory"("userId");

-- CreateIndex
CREATE INDEX "Memory_namespaceId_idx" ON "Memory"("namespaceId");

-- CreateIndex
CREATE INDEX "Memory_type_idx" ON "Memory"("type");

-- CreateIndex
CREATE INDEX "Memory_status_idx" ON "Memory"("status");

-- CreateIndex
CREATE INDEX "Memory_userId_lastAccessedAt_idx" ON "Memory"("userId", "lastAccessedAt");

-- CreateIndex
CREATE INDEX "Memory_deletedAt_idx" ON "Memory"("deletedAt");

-- CreateIndex
CREATE INDEX "MemoryRelation_fromMemoryId_idx" ON "MemoryRelation"("fromMemoryId");

-- CreateIndex
CREATE INDEX "MemoryRelation_toMemoryId_idx" ON "MemoryRelation"("toMemoryId");

-- CreateIndex
CREATE UNIQUE INDEX "MemoryRelation_fromMemoryId_toMemoryId_relationType_key" ON "MemoryRelation"("fromMemoryId", "toMemoryId", "relationType");

-- CreateIndex
CREATE INDEX "MemoryTag_tag_idx" ON "MemoryTag"("tag");

-- AddForeignKey
ALTER TABLE "Namespace" ADD CONSTRAINT "Namespace_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Namespace" ADD CONSTRAINT "Namespace_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Namespace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memory" ADD CONSTRAINT "Memory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memory" ADD CONSTRAINT "Memory_namespaceId_fkey" FOREIGN KEY ("namespaceId") REFERENCES "Namespace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryRelation" ADD CONSTRAINT "MemoryRelation_fromMemoryId_fkey" FOREIGN KEY ("fromMemoryId") REFERENCES "Memory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryRelation" ADD CONSTRAINT "MemoryRelation_toMemoryId_fkey" FOREIGN KEY ("toMemoryId") REFERENCES "Memory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryTag" ADD CONSTRAINT "MemoryTag_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "Memory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex (HNSW — partial: only active, fully-embedded rows)
-- m=16, ef_construction=64 are pgvector defaults; tune before v1.0.
-- vector_cosine_ops: OpenAI embeddings are unit-normalised, cosine similarity is correct.
CREATE INDEX "memory_embedding_hnsw_idx"
  ON "Memory" USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE embedding IS NOT NULL
    AND "deletedAt" IS NULL
    AND status = 'READY'::"MemoryStatus";
