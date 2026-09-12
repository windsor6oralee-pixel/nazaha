-- Cursor pagination on (createdAt DESC, id DESC): deep pages stay O(log n) instead of OFFSET scans.
CREATE INDEX "audit_logs_createdAt_id_idx" ON "audit_logs"("createdAt" DESC, "id" DESC);

-- Append-only enforcement.
-- 1) The runtime role simply has no UPDATE/DELETE privilege on the table.
REVOKE UPDATE, DELETE ON "audit_logs" FROM nazaha_app;

-- 2) Even the table owner (migrations, superuser sessions) is refused by a trigger.
CREATE OR REPLACE FUNCTION audit_logs_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only: % is not allowed', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END $$;

DROP TRIGGER IF EXISTS audit_logs_immutable_trg ON "audit_logs";
CREATE TRIGGER audit_logs_immutable_trg
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable();
