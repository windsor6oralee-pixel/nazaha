-- CreateEnum
CREATE TYPE "FieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'SELECT', 'BOOLEAN');

-- CreateTable
CREATE TABLE "candidate_field_definitions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "labelAr" TEXT NOT NULL,
    "type" "FieldType" NOT NULL,
    "options" TEXT[],
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "showToCandidate" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_field_values" (
    "candidateId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_field_values_pkey" PRIMARY KEY ("candidateId","definitionId")
);

-- CreateIndex
CREATE INDEX "candidate_field_definitions_organizationId_order_idx" ON "candidate_field_definitions"("organizationId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_field_definitions_organizationId_key_key" ON "candidate_field_definitions"("organizationId", "key");

-- AddForeignKey
ALTER TABLE "candidate_field_definitions" ADD CONSTRAINT "candidate_field_definitions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_field_values" ADD CONSTRAINT "candidate_field_values_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_field_values" ADD CONSTRAINT "candidate_field_values_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "candidate_field_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

