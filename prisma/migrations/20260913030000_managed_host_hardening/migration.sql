-- Managed PostgreSQL hosts (Supabase) expose every table in "public" through an
-- HTTP Data API using the built-in roles anon / authenticated / service_role, and
-- grant them ALL privileges on new tables by default. Nazaha never uses that API:
-- the only runtime path is nazaha_app over a direct PostgreSQL connection, and the
-- tenant policies deliberately pass when no tenant context is set. Left as-is, the
-- public anon key would read every tenant's rows. Strip those roles entirely.
-- No-op on hosts where the roles do not exist (local Docker, CI).
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', r);
      EXECUTE format('REVOKE USAGE ON SCHEMA public FROM %I', r);
    END IF;
  END LOOP;
END $$;
