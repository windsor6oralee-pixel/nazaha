-- ImportBatch / ImportItem — candidate acceptance import & invitation batch (ADDITIVE)

CREATE TYPE "ImportBatchStatus" AS ENUM ('PENDING','VALIDATING','READY','EXECUTING','COMPLETED','FAILED','CANCELLED');
CREATE TYPE "ImportItemStatus" AS ENUM ('PENDING','VALID','INVALID','MATCHED_NEW','MATCHED_EXISTING','DUPLICATE','READY','EXECUTING','DONE','FAILED','SKIPPED');

CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'PENDING',
    "sourceFileName" TEXT,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "import_items" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "nationalId" TEXT,
    "email" TEXT,
    "nameAr" TEXT NOT NULL,
    "jobTitle" TEXT,
    "department" TEXT,
    "acceptanceDate" TIMESTAMP(3),
    "candidateId" TEXT,
    "applicationId" TEXT,
    "status" "ImportItemStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "import_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "import_batches_reference_key" ON "import_batches"("reference");
CREATE UNIQUE INDEX "import_items_batchId_itemKey_key" ON "import_items"("batchId", "itemKey");

CREATE INDEX "import_batches_organizationId_status_idx" ON "import_batches"("organizationId", "status");
CREATE INDEX "import_items_batchId_status_idx" ON "import_items"("batchId", "status");

ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "import_items" ADD CONSTRAINT "import_items_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "import_items" ADD CONSTRAINT "import_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "import_items" ADD CONSTRAINT "import_items_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "import_items" ADD CONSTRAINT "import_items_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "email_logs" ADD COLUMN "batchId" TEXT;
ALTER TABLE "email_logs" ADD COLUMN "importItemId" TEXT;
