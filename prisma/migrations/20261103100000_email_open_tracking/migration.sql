-- Open-tracking columns on email_logs. The tracking pixel endpoint flips
-- firstOpenedAt on the first image load and bumps openCount + lastOpenedAt
-- on every subsequent one. Caveat lives in the UI: image blocking means a
-- null openedAt doesn't prove the mail wasn't read.

ALTER TABLE "email_logs"
    ADD COLUMN "firstOpenedAt" TIMESTAMP(3),
    ADD COLUMN "lastOpenedAt"  TIMESTAMP(3),
    ADD COLUMN "openCount"     INTEGER NOT NULL DEFAULT 0;
