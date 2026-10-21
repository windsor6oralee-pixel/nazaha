# Skripts

أدوات تشغيل المنصة خارج مسار الطلب: تهيئة بيانات الاختبار، وتجهيز حسابات
دخول المرشحين، وفك قفل الحسابات. كل ما هنا يعمل على قاعدة البيانات مباشرة، فاقرأ
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
| مرشّح | بريد + كلمة مرور | `/auth/candidate` |

السكربت **idempotent**: تشغيله مرتين لا يغيّر شيئاً سوى كلمات المرور وحالة
القفل (تُصفّر محاولات الدخول الفاشلة ويُرفع الحظر).

### التشغيل

```bash
# قاعدة بيانات محلية (يقرأ .env تلقائياً)
TEST_PASSWORD='<your password>' \
TEST_CANDIDATE_EMAIL='ahmed.omari@example.com' \
  npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node","esModuleInterop":true,"skipLibCheck":true}' \
  scripts/create_test_accounts.ts
```

### على قاعدة بيانات مستضافة

كتابة حسابات اختبار في قاعدة حيّة قرار يتّخذه الإنسان لا نتيجة تشغيل عادي،
فالسكربت **يرفض** العمل على أي قاعدة ليست محلية ما لم تُضبط صراحةً:

```bash
TEST_PASSWORD='<your password>' \
TEST_CANDIDATE_EMAIL='ahmed.omari@example.com' \
ALLOW_PRODUCTION_BOOTSTRAP=1 \
NEON_DATABASE_URL='postgresql://…' \
  npx ts-node --transpile-only … scripts/create_test_accounts.ts
```

### المتغيّرات

| المتغيّر | مطلوب؟ | الافتراضي |
|---|---|---|
| `TEST_PASSWORD` | **نعم** | — |
| `TEST_PLATFORM_EMAIL` | لا | `platform@nazaha.sa` |
| `TEST_CANDIDATE_EMAIL` | لا | `ahmed.omari@example.com` |
| `ALLOW_PRODUCTION_BOOTSTRAP` | لقاعدة مستضافة | — |

> السكربت لا يطبع كلمة المرور نفسها — مخرجاته تذكر فقط أنها مضبوطة من البيئة.

---

## `setup_accepted_candidates_auth.ts`

يجهّز حسابات دخول **للمرشحين المقبولين** دفعةً واحدة: بريد دخول مميّز وكلمة
مرور مشفّرة، مع تصفير عدّاد المحاولات الفاشلة ورفع أي حظر.

كل مرشح مقبول (طلب بحالة `PENDING` / `IN_PROGRESS` / `UNDER_REVIEW` / `APPROVED`)
يحصل على حساب دخول دائم. المرشحون الذين لا يصلح بريد دخول لهم — لأن بريد
التواصل مستخدم في حساب آخر — يُتخطّون ويُبلَّغ عنهم في المخرجات.

```bash
# بتمرير كلمة مرور واحدة لكل الحسابات
SETUP_PASSWORD='<your password>' npm run candidate:setup

# بلا كلمة مرور: تُولَّد كلمة مرور عشوائية لكل مرشح وتُطبع مرة واحدة
npm run candidate:setup

# بلا كتابة — معاينة فقط
npm run candidate:setup -- --dry-run
```

| المتغيّر | مطلوب؟ | الافتراضي |
|---|---|---|
| `SETUP_PASSWORD` | لا | كلمة مرور عشوائية لكل مرشح، تُطبع مرة واحدة |
| `ALLOW_PRODUCTION_BOOTSTRAP` | لقاعدة مستضافة | — |
| `BOOTSTRAP_DATABASE_URL` | لا | `NEON_DATABASE_URL` |

---

## `set_candidate_password.ts`

يضبط حساب مرشح واحد (أو ينشئه): بريد الدخول، كلمة المرور المشفّرة، وصفّر
عدّاد المحاولات.

```bash
CANDIDATE_EMAIL='ahmed.omari@example.com' \
SETUP_PASSWORD='<your password>' \
  npm run candidate:password
```

بلا `SETUP_PASSWORD` تُولَّد كلمة مرور عشوائية وتُطبع مرة واحدة.

| المتغيّر | مطلوب؟ | الافتراضي |
|---|---|---|
| `CANDIDATE_EMAIL` | **نعم** | — |
| `SETUP_PASSWORD` | لا | كلمة مرور عشوائية، تُطبع مرة واحدة |
| `ALLOW_PRODUCTION_BOOTSTRAP` | لقاعدة مستضافة | — |

> داخل المنصة، نفس المهمة متاحة من `/platform/accounts` ← **حسابات المرشحين**
> (زر «ضبط كلمة المرور» أو «إنشاء حساب») — فتُسجَّل العملية في سجل التدقيق.

---

## `unlock_accounts.ts`

يرفع الحظر عن الحسابات بعد خمس محاولات دخول فاشلة (القفل ١٥ دقيقة) —
موظفو الجهات ومشغّلو المنصة **والمرشحون** (لأن المرشح صار له حساب).

```bash
npm run unlock:accounts
```

> السكربت لا يلمس كلمات المرور ولا الصلاحيات — عدّادات المحاولات فقط.

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
