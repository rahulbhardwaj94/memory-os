-- AlterTable
ALTER TABLE "Namespace" ADD COLUMN "isEphemeral" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Namespace" ADD COLUMN "expiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Namespace_expiresAt_idx" ON "Namespace"("expiresAt");
