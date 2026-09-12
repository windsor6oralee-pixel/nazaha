-- CreateEnum
CREATE TYPE "OrgType" AS ENUM ('GOVERNMENT', 'SEMI_GOVERNMENT', 'PRIVATE');

-- AlterTable: organization branding & legal identity
ALTER TABLE "organizations" ADD COLUMN     "address" TEXT,
ADD COLUMN     "authorizedSignerName" TEXT,
ADD COLUMN     "authorizedSignerTitle" TEXT,
ADD COLUMN     "commercialRegNo" TEXT,
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "officialNameAr" TEXT,
ADD COLUMN     "primaryColor" TEXT,
ADD COLUMN     "type" "OrgType" NOT NULL DEFAULT 'GOVERNMENT';

-- AlterTable: roles become per-tenant.
-- Existing roles are global; attach them to the earliest organization (the only tenant so far),
-- then tighten the column. Runs in one transaction so a failed backfill leaves nothing half-applied.
ALTER TABLE "roles" ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "organizationId" TEXT;

UPDATE "roles"
SET "organizationId" = (SELECT "id" FROM "organizations" ORDER BY "createdAt" ASC LIMIT 1),
    "isSystem" = ("name" IN ('admin', 'hr_manager', 'hr_officer'))
WHERE "organizationId" IS NULL;

ALTER TABLE "roles" ALTER COLUMN "organizationId" SET NOT NULL;

-- DropIndex: name is no longer globally unique
DROP INDEX "roles_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "roles_organizationId_name_key" ON "roles"("organizationId", "name");

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
