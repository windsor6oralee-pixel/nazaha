-- Click-tracking columns. The tracked-link endpoint stamps firstClickedAt once
-- and bumps clickCount on every subsequent hit. Click is a strong "human saw
-- this" signal — unlike image loads, clicks require an intentional action.

ALTER TABLE "email_logs"
    ADD COLUMN "firstClickedAt" TIMESTAMP(3),
    ADD COLUMN "lastClickedAt"  TIMESTAMP(3),
    ADD COLUMN "clickCount"     INTEGER NOT NULL DEFAULT 0;
