-- CreateTable
CREATE TABLE "contract_templates" (
    "id" TEXT NOT NULL,
    "type" "ContractType" NOT NULL,
    "nameAr" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contract_templates_organizationId_type_isActive_idx" ON "contract_templates"("organizationId", "type", "isActive");
CREATE UNIQUE INDEX "contract_templates_organizationId_type_version_key" ON "contract_templates"("organizationId", "type", "version");
ALTER TABLE "contract_templates" ADD CONSTRAINT "contract_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: contracts gain frozen content + template link + denormalized tenant.
-- organizationId is backfilled from the owning application before being tightened.
ALTER TABLE "contracts" ADD COLUMN "contentHash" TEXT,
ADD COLUMN "renderedHtml" TEXT,
ADD COLUMN "templateId" TEXT,
ADD COLUMN "organizationId" TEXT;

UPDATE "contracts" c
SET "organizationId" = a."organizationId"
FROM "applications" a
WHERE a."id" = c."applicationId" AND c."organizationId" IS NULL;

ALTER TABLE "contracts" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "contracts" ADD CONSTRAINT "contracts_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "contract_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: each signature records the content hash it attested to
ALTER TABLE "signatures" ADD COLUMN "contentHash" TEXT;
