-- Alerts sent by HR to specific candidates.
-- priority: NORMAL or HIGH (HIGH = blocking modal on candidate login).
-- acknowledgedAt: set when candidate explicitly presses "فهمت".
CREATE TABLE "candidate_alerts" (
  "id"             TEXT        NOT NULL,
  "organizationId" TEXT        NOT NULL,
  "applicationId"  TEXT        NOT NULL,
  "sentByUserId"   TEXT        NOT NULL,
  "titleAr"        TEXT        NOT NULL,
  "bodyAr"         TEXT        NOT NULL,
  "priority"       TEXT        NOT NULL DEFAULT 'NORMAL',
  "acknowledgedAt" TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "candidate_alerts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "candidate_alerts_applicationId_idx" ON "candidate_alerts"("applicationId");
CREATE INDEX "candidate_alerts_organizationId_idx" ON "candidate_alerts"("organizationId");
CREATE INDEX "candidate_alerts_unacked_idx" ON "candidate_alerts"("applicationId", "acknowledgedAt")
  WHERE "acknowledgedAt" IS NULL;

ALTER TABLE "candidate_alerts"
  ADD CONSTRAINT "candidate_alerts_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "candidate_alerts"
  ADD CONSTRAINT "candidate_alerts_sentByUserId_fkey"
  FOREIGN KEY ("sentByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS: same org-isolation pattern as all other tables
ALTER TABLE "candidate_alerts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "candidate_alerts" FORCE ROW LEVEL SECURITY;
CREATE POLICY "candidate_alerts_org_isolation" ON "candidate_alerts"
  USING ("organizationId" = app_current_org());
