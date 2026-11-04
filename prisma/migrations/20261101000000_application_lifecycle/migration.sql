-- دورة حياة الطلب: قبول العرض، سبب آخر قرار، وتواريخ الانتقالات.
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "offerAcceptedAt" TIMESTAMP(3);
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "statusReason" TEXT;
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "statusChangedAt" TIMESTAMP(3);
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "withdrawnAt" TIMESTAMP(3);

-- قوائم العمل في لوحة التحكم تُصفّي دائماً بالجهة ثم بالحالة.
CREATE INDEX IF NOT EXISTS "applications_organizationId_status_idx" ON "applications"("organizationId", "status");

-- طلبات قائمة تخطّت «قبول العرض» عملياً (رفعت مستندات أو تجاوزت حالة PENDING)
-- تُعامل كأنها قبلت العرض، حتى لا تعود خطوتها الأولى «معلّقة» بعد هذا التغيير.
UPDATE "applications" a
SET "offerAcceptedAt" = COALESCE(a."submittedAt", a."updatedAt")
WHERE a."offerAcceptedAt" IS NULL
  AND (
    a."status" <> 'PENDING'
    OR EXISTS (SELECT 1 FROM "documents" d WHERE d."applicationId" = a."id" AND d."status" <> 'NOT_UPLOADED')
  );
