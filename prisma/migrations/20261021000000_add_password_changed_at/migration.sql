-- كلتا الأعمدة nullable: NULL تعني "لم تُغيَّر كلمة المرور أبداً"،
-- فتبقى كل الجلسات القائمة صالحة. التغيير يضبط التاريخ، فتُبطل الجلسات الأقدم.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP;
ALTER TABLE "platform_admins" ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP;
