# Skripts

أدوات تشغيل المنصة خارج مسار الطلب: تهيئة بيانات الاختبار، وإدارة رموز
الدعوة، وفك قفل الحسابات. كل ما هنا يعمل على قاعدة البيانات مباشرة، فاقرأ
قبل تشغيل أيٍّ منها تأكّد أيّ قاعدة بيانات ستلمس.

> **لا كلمة مرور افتراضية في المستودع.** كل سكربت يطلب كلمة المرور من البيئة
> (`TEST_PASSWORD`) ويرفض العمل بدونها.

---

## `create_test_accounts.ts`

ينشئ (أو يعيد ضبط) حساب دخول واحداً لكل دور، فتُغطّى كل الواجهات بحساب حقيقي:

| الدور | المدخل | الرابط |
|---|---|---|
| مشغّل المنصة | `platform@nazaha.sa` | `/platform/login` |
| مدير نظام الجهة | `admin@mof.gov.sa` | `/auth/login` |
| مدير الموارد البشرية | `salma.rashidi@mof.gov.sa` | `/auth/login` |
| موظف الموارد البشرية | `faisal.mansour@mof.gov.sa` | `/auth/login` |
| مرشّح | برمز دعوة | `/auth/candidate` |

السكربت **idempotent**: تشغيله مرتين لا يغيّر شيئاً سوى كلمات المرور وحالة
القفل (تُصفّر محاولات الدخول الفاشلة ويُرفع الحظر).

### التشغيل

```bash
# قاعدة بيانات محلية (يقرأ .env تلقائياً)
TEST_PASSWORD='<your password>' \
TEST_CANDIDATE_TOKEN='<fresh invitation code>' \
  npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node","esModuleInterop":true,"skipLibCheck":true}' \
  scripts/create_test_accounts.ts
```

### على قاعدة بيانات مستضافة

كتابة حسابات اختبار في قاعدة حيّة قرار يتّخذه الإنسان لا نتيجة تشغيل عادي،
فالسكربت **يرفض** العمل على أي قاعدة ليست محلية ما لم تُضبط صراحةً:

```bash
TEST_PASSWORD='<your password>' \
TEST_CANDIDATE_TOKEN='<fresh invitation code>' \
ALLOW_PRODUCTION_BOOTSTRAP=1 \
NEON_DATABASE_URL='postgresql://…' \
  npx ts-node --transpile-only … scripts/create_test_accounts.ts
```

### المتغيّرات

| المتغيّر | مطلوب؟ | الافتراضي |
|---|---|---|
| `TEST_PASSWORD` | **نعم** | — |
| `TEST_PLATFORM_EMAIL` | لا | `platform@nazaha.sa` |
| `TEST_CANDIDATE_TOKEN` | نعم عند استخدامه | رمز اختبار جديد يُمرّر صراحةً، دون قيمة افتراضية |
| `ALLOW_PRODUCTION_BOOTSTRAP` | لقاعدة مستضافة | — |

> السكربت لا يطبع كلمة المرور نفسها — مخرجاته تذكر فقط أنها مضبوطة من البيئة.

---

## `mint_candidate_token.ts`

يصدِّر **رمز دعوة جديداً** للمرشّح ويطبعه. رموز الدعوة تُستخدم مرّة واحدة،
فكل تشغيل لبوابة المرشّح يحتاج رمزاً جديداً.

```bash
E2E_BASE_URL='http://localhost:3002' \
TEST_PASSWORD='<your password>' \
HR_EMAIL='admin@mof.gov.sa' \
  npx ts-node --transpile-only … scripts/mint_candidate_token.ts
```

يعمل كما يعمل موظف الموارد البشرية في المتصفّح: يسجّل الدخول، ثم يطلب إعادة
إرسال الدعوة، ثم يقرأ الرمز المُدوَّر من ملف المرشّح.

| المتغيّر | مطلوب؟ | الافتراضي |
|---|---|---|
| `TEST_PASSWORD` | **نعم** | — |
| `E2E_BASE_URL` | لا | `http://localhost:3002` |
| `HR_EMAIL` | لا | `admin@mof.gov.sa` |

---

## `unlock_accounts.ts`

يرفع الحظر عن الحسابات بعد خمس محاولات دخول فاشلة (القفل ١٥ دقيقة).

```bash
npm run unlock:accounts
```

---

## `ci/` و `db/`

- `ci/test.sh` — ما يعمل في خطّ التكامل المستمر: تثبيت، ترحيل، فحوص، اختبارات.
- `ci/check-deps.mjs` — يتحقّق من توافق إصدارات الحزم مع بعضها.
- `db/set-app-role-password.sh` — يضبط كلمة مرور دور `nazaha_app` في قاعدة البيانات.

---

## اختبارات المتصفّح (`e2e/`)

خارج هذا المجلّد لكنه يستخدم نفس الإعدادات:

| السكربت | ما يثبته |
|---|---|
| `e2e/roles.spec.ts` | ما يراه كل دور فعلاً، مع لقطة شاشة لكل صفحة |
| `e2e/whatsapp.spec.ts` | زر التواصل عبر واتساب في بوابة المرشّح |
| `e2e/password-reset.spec.ts` | ضبط كلمة المرور من حساب مشغّل المنصة، وأن الجلسة القديمة تُبطل |

```bash
TEST_PASSWORD='<your password>' \
E2E_BASE_URL='https://nazaha-two.vercel.app' \
  npx playwright test e2e/password-reset.spec.ts
```

الإعدادات مشتركة في `e2e/config.ts` — وهي تقرأ `TEST_PASSWORD` من البيئة بلا
قيمة افتراضية، فتنقطع الاختبارات بدل أن تعمل بكلمة مرور منسيّة.
