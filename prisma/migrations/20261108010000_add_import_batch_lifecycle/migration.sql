-- ImportBatch lifecycle / claim-lease / e-mail idempotency (ADDITIVE only).
-- No column is dropped, no row is rewritten, no historical value is backfilled.

-- 1) New enum values (additive — old values keep their meaning).
ALTER TYPE "ImportBatchStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "ImportBatchStatus" ADD VALUE IF NOT EXISTS 'PARTIAL';
ALTER TYPE "ImportBatchStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';
ALTER TYPE "ImportItemStatus"  ADD VALUE IF NOT EXISTS 'CONFLICT';

-- 2) ImportBatch: actors, timestamps and the frozen final outcome.
ALTER TABLE "import_batches" ADD COLUMN "createdByUserId"   TEXT;
ALTER TABLE "import_batches" ADD COLUMN "approvedByUserId" TEXT;
ALTER TABLE "import_batches" ADD COLUMN "approvedAt"       TIMESTAMP(3);
ALTER TABLE "import_batches" ADD COLUMN "executedAt"       TIMESTAMP(3);
ALTER TABLE "import_batches" ADD COLUMN "resultSummary"    JSONB;

-- 3) ImportItem: match provenance + claim/lease (concurrency guard).
ALTER TABLE "import_items" ADD COLUMN "matchedBy"      TEXT;
ALTER TABLE "import_items" ADD COLUMN "claimToken"     TEXT;
ALTER TABLE "import_items" ADD COLUMN "claimedAt"      TIMESTAMP(3);
ALTER TABLE "import_items" ADD COLUMN "leaseExpiresAt" TIMESTAMP(3);

CREATE INDEX "import_items_claimToken_idx" ON "import_items"("claimToken");

-- 4) EmailLog: idempotency key + crash-window marker + FKs to batch/item.
--    Existing rows keep NULL for every new column: nothing is backfilled.
ALTER TABLE "email_logs" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "email_logs" ADD COLUMN "sendStartedAt"  TIMESTAMP(3);

CREATE UNIQUE INDEX "email_logs_idempotencyKey_key" ON "email_logs"("idempotencyKey");
CREATE INDEX "email_logs_importItemId_idx" ON "email_logs"("importItemId");

--    ON DELETE SET NULL: removing a batch can never remove historical e-mail rows.
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_batchId_fkey"
    FOREIGN KEY ("batchId") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_importItemId_fkey"
    FOREIGN KEY ("importItemId") REFERENCES "import_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
