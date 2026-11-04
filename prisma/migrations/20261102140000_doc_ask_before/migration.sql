-- Pre-upload question toggle on a document rule. The candidate card leads with
-- "do you already have this document?" when true; "No" sends them straight to
-- the external-action URL (health-cert issuance portal, etc.).

ALTER TABLE "workflow_step_documents"
    ADD COLUMN "askBeforeUpload" BOOLEAN NOT NULL DEFAULT FALSE;
