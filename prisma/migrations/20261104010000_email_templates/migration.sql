-- EmailTemplate: unified template library for ad-hoc sends.
CREATE TYPE "EmailTemplateKind" AS ENUM ('INVITATION', 'ALERT', 'HEALTH_CERT', 'GENERIC');

CREATE TABLE "email_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" "EmailTemplateKind" NOT NULL DEFAULT 'GENERIC',
    "nameAr" TEXT NOT NULL,
    "subjectAr" TEXT NOT NULL,
    "bodyAr" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "email_templates_organizationId_kind_idx" ON "email_templates"("organizationId", "kind");

ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
