-- Add brute-force lockout columns to user accounts.
-- After MAX_ATTEMPTS (5) wrong passwords the account is locked for 15 minutes.
-- Both columns default to "never attempted / never locked" so the ALTER is safe
-- on an existing, populated table without a data migration step.
ALTER TABLE "users"
  ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lockedUntil"         TIMESTAMP(3);

ALTER TABLE "platform_admins"
  ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lockedUntil"         TIMESTAMP(3);
