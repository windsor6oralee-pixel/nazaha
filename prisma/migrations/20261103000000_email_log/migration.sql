-- EmailLog — one row per outbound (and future inbound) e-mail. Lets HR see,
-- per candidate and in the global queue, every mail the platform sent — with
-- subject, recipient, status and provider message id for cross-reference.

CREATE TYPE "EmailStatus"    AS ENUM ('QUEUED','SENT','FAILED','BOUNCED','DELIVERED','UNKNOWN');
CREATE TYPE "EmailDirection" AS ENUM ('OUTBOUND','INBOUND');

CREATE TABLE "email_logs" (
    "id"                TEXT NOT NULL,
    "organizationId"    TEXT NOT NULL,
    "candidateId"       TEXT,
    "applicationId"     TEXT,
    "sentByUserId"      TEXT,
    "fromAddress"       TEXT NOT NULL,
    "toAddress"         TEXT NOT NULL,
    "subject"           TEXT NOT NULL,
    "bodyPreview"       TEXT,
    "bodyFull"          TEXT,
    "providerMessageId" TEXT,
    "provider"          TEXT,
    "status"            "EmailStatus" NOT NULL DEFAULT 'QUEUED',
    "errorMessage"      TEXT,
    "direction"         "EmailDirection" NOT NULL DEFAULT 'OUTBOUND',
    "sentAt"            TIMESTAMP(3),
    "deliveredAt"       TIMESTAMP(3),
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,
    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "email_logs_org_createdAt_idx"      ON "email_logs" ("organizationId", "createdAt");
CREATE INDEX "email_logs_candidate_idx"          ON "email_logs" ("candidateId");
CREATE INDEX "email_logs_provider_msg_id_idx"    ON "email_logs" ("providerMessageId");

ALTER TABLE "email_logs"
    ADD CONSTRAINT "email_logs_org_fk"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
