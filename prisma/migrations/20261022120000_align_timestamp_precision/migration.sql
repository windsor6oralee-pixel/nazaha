-- توحيد دقّة الأعمدة الزمنية مع مخطط Prisma.
--
-- `DateTime` في Prisma = `timestamp(3)`، لكن ثلاثة أعمدة أُضيفت بـ `TIMESTAMP`
-- (أي precision 6) فبقي مخطط قاعدة البيانات منقوصاً عن المخطط البرمجي،
-- وبفحص الانحراف (schema ↔ migrations) في خطّ التكامل المستمر.
--
-- لا فرق عملياً: الفرق بين precision 6 و 3 أقل من جزء من الثانية.
ALTER TABLE "candidates"      ALTER COLUMN "invitationSentAt"  SET DATA TYPE TIMESTAMP(3);
ALTER TABLE "users"           ALTER COLUMN "passwordChangedAt" SET DATA TYPE TIMESTAMP(3);
ALTER TABLE "platform_admins" ALTER COLUMN "passwordChangedAt" SET DATA TYPE TIMESTAMP(3);
