-- Numeric payment amount + currency for a document's external action.
-- The number flows to the destination site as `&amount=` + `&currency=` so
-- the receiving portal shows the exact fee set by HR, no parsing of free text.

ALTER TABLE "workflow_step_documents"
    ADD COLUMN "externalFeeAmount"   INTEGER,
    ADD COLUMN "externalFeeCurrency" TEXT;
