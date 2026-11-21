-- القائمة الرسمية للمقبولين: كلمة مرور لكل صف.
--
-- النص مشفّر (AES-256-GCM) لا صريح — يُفكّ عند تنفيذ الدفعة فقط ليُضبط
-- ككلمة دخول المرشح ثم يُمحى من العنصر. لا يظهر في أي استجابة للواجهة.
ALTER TABLE "import_items" ADD COLUMN IF NOT EXISTS "passwordCiphertext" TEXT;
