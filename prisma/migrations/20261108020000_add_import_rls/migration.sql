-- RLS for the ADDITIVE import tables — same pattern as every direct-org table:
-- no tenant context ⇒ unrestricted (global client keeps working); a tenant
-- context ⇒ only that organization's rows are visible/checkable.
ALTER TABLE "import_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "import_batches" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "import_batches"
  USING (app_current_org() IS NULL OR "organizationId" = app_current_org())
  WITH CHECK (app_current_org() IS NULL OR "organizationId" = app_current_org());

ALTER TABLE "import_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "import_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "import_items"
  USING (app_current_org() IS NULL OR "organizationId" = app_current_org())
  WITH CHECK (app_current_org() IS NULL OR "organizationId" = app_current_org());
