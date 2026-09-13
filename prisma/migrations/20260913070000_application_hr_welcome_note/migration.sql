-- Optional HR-authored note that appears as a welcome banner on the candidate dashboard.
-- Stored on applications so each application cycle can carry its own message.
ALTER TABLE "applications" ADD COLUMN "hrWelcomeNote" TEXT;
