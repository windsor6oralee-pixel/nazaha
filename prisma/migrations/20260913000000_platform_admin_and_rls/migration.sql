-- ============================================================
-- 1. PLATFORM ADMINS — separate table, no tenant column.
-- ============================================================
CREATE TABLE "platform_admins" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "platform_admins_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "platform_admins_email_key" ON "platform_admins"("email");

-- ============================================================
-- 2. RUNTIME ROLE — the application connects as nazaha_app,
--    which is NOT a superuser and does NOT bypass RLS.
--    Migrations keep running as the table owner (DIRECT_DATABASE_URL).
--    The password is set out-of-band (scripts/db/set-app-role-password.sh),
--    never in a committed migration.
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nazaha_app') THEN
    CREATE ROLE nazaha_app LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END $$;

-- Database name differs per host (nazaha_db locally, postgres on managed providers).
DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO nazaha_app', current_database());
END $$;
GRANT USAGE ON SCHEMA public TO nazaha_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nazaha_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nazaha_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nazaha_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO nazaha_app;

-- ============================================================
-- 3. TENANT CONTEXT HELPER
--    app.current_org is set per transaction by the application
--    (SET LOCAL semantics via set_config(..., true)).
--    NULL  → no tenant context: trusted service layer / auth lookups, unrestricted.
--    value → every policy below restricts rows to that organization.
-- ============================================================
CREATE OR REPLACE FUNCTION app_current_org() RETURNS text
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT NULLIF(current_setting('app.current_org', true), '')
$$;

-- ============================================================
-- 4. ROW-LEVEL SECURITY
--    FORCE applies the policies to the table owner too; superusers
--    still bypass (hence the dedicated runtime role above).
-- ============================================================

-- organizations: a tenant sees only itself
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organizations" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "organizations"
  USING (app_current_org() IS NULL OR "id" = app_current_org())
  WITH CHECK (app_current_org() IS NULL OR "id" = app_current_org());

-- tables with a direct organizationId column
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users', 'roles', 'candidates', 'applications', 'workflows', 'system_settings',
    'contracts', 'contract_templates', 'candidate_field_definitions'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING (app_current_org() IS NULL OR "organizationId" = app_current_org())
         WITH CHECK (app_current_org() IS NULL OR "organizationId" = app_current_org())', t);
  END LOOP;
END $$;

-- tables reached through a parent row (the parent subquery is itself RLS-filtered)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('documents',               'applicationId',       'applications'),
    ('onboarding_processes',    'applicationId',       'applications'),
    ('preboarding_channels',    'applicationId',       'applications'),
    ('verification_tokens',     'candidateId',         'candidates'),
    ('candidate_field_values',  'candidateId',         'candidates'),
    ('workflow_steps',          'workflowId',          'workflows'),
    ('workflow_step_documents', 'workflowStepId',      'workflow_steps'),
    ('document_reviews',        'documentId',          'documents'),
    ('signatures',              'contractId',          'contracts'),
    ('preboarding_messages',    'channelId',           'preboarding_channels'),
    ('onboarding_steps',        'onboardingProcessId', 'onboarding_processes')
  ) AS v(tbl, fk, parent) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', r.tbl);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %1$I
         USING (app_current_org() IS NULL OR %2$I IN (SELECT "id" FROM %3$I))
         WITH CHECK (app_current_org() IS NULL OR %2$I IN (SELECT "id" FROM %3$I))',
      r.tbl, r.fk, r.parent);
  END LOOP;
END $$;

-- audit_logs / notifications: rows belong to whichever actor they reference
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "audit_logs"
  USING (
    app_current_org() IS NULL
    OR "applicationId" IN (SELECT "id" FROM "applications")
    OR "userId"        IN (SELECT "id" FROM "users")
    OR "candidateId"   IN (SELECT "id" FROM "candidates")
  )
  WITH CHECK (
    app_current_org() IS NULL
    OR "applicationId" IN (SELECT "id" FROM "applications")
    OR "userId"        IN (SELECT "id" FROM "users")
    OR "candidateId"   IN (SELECT "id" FROM "candidates")
  );

ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "notifications"
  USING (
    app_current_org() IS NULL
    OR "userId"      IN (SELECT "id" FROM "users")
    OR "candidateId" IN (SELECT "id" FROM "candidates")
  )
  WITH CHECK (
    app_current_org() IS NULL
    OR "userId"      IN (SELECT "id" FROM "users")
    OR "candidateId" IN (SELECT "id" FROM "candidates")
  );

-- Global tables intentionally without RLS: platform_admins, permissions, role_permissions, _prisma_migrations.
