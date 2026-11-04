-- Optional "external action" fields on a workflow document rule. When set the
-- candidate's document card shows a CTA button that opens externalActionUrl
-- (with their e-mail appended) and the fee they need to pay. Used primarily
-- for the health-certificate flow but generic enough for any paid document.

ALTER TABLE "workflow_step_documents"
    ADD COLUMN "externalActionUrl"   TEXT,
    ADD COLUMN "externalActionLabel" TEXT,
    ADD COLUMN "externalFeeLabel"    TEXT;
