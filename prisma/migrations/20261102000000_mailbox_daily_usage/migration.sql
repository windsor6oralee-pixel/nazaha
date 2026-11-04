-- MailboxDailyUsage: per-mailbox send counter bucketed by UTC date.
-- Drives the daily-cap enforcement in MailboxPoolAdapter so the system
-- can round-robin across InboxKit mailboxes without burning any one
-- Gmail quota in a single batch.

CREATE TABLE "mailbox_daily_usage" (
    "id"             TEXT        NOT NULL,
    "organizationId" TEXT        NOT NULL,
    "mailboxEmail"   TEXT        NOT NULL,
    "date"           DATE        NOT NULL,
    "sentCount"      INTEGER     NOT NULL DEFAULT 0,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "mailbox_daily_usage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mailbox_daily_usage_org_mailbox_date_key"
    ON "mailbox_daily_usage" ("organizationId", "mailboxEmail", "date");

CREATE INDEX "mailbox_daily_usage_org_date_idx"
    ON "mailbox_daily_usage" ("organizationId", "date");

ALTER TABLE "mailbox_daily_usage"
    ADD CONSTRAINT "mailbox_daily_usage_org_fk"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
