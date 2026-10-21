-- حسابات دخول المرشحين: بريد مميّز + كلمة مرور مشفّرة + عدّاد المحاولات.
--
-- بريد الدخول حقل مستقل عن `email` (بريد التواصل) لأن بريد التواصل قد يتكرّر
-- بين مرشّحين، وبريد الدخول يجب أن يكون فريداً — ولهذا فهرس فريد منفرد.
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "loginEmail" TEXT;
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP(3);
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "accountActivatedAt" TIMESTAMP(3);

-- nullable ⇒ صفوف بلا حساب دخول تتشارك NULL بلا تعارض.
CREATE UNIQUE INDEX IF NOT EXISTS "candidates_loginEmail_key" ON "candidates"("loginEmail");
