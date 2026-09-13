-- HR needs to re-read the active invitation code from the candidate profile.
-- Verification still uses tokenHash only; this column holds an AES-256-GCM copy
-- under ENCRYPTION_KEY, so a database dump alone never yields a usable token.
ALTER TABLE "verification_tokens" ADD COLUMN "tokenCiphertext" TEXT;
