#!/usr/bin/env node
/**
 * القائمة الرسمية للمقبولين للتوظيف — سكربت الاستيراد الرسمي (DRY-RUN افتراضياً).
 *
 * القائمة (بريد إلكتروني + كلمة مرور لكل صف) هي المصدر الرسمي الوحيد لحسابات
 * المقبولين: لكل صف يُنشأ مرشح بطلب موافق، ثم يُضبط حساب دخوله —
 *   loginEmail = البريد · passwordHash = bcrypt لكلمة الشيت كما هي (بلا فحص سياسة)
 *   accountActivatedAt = الآن — تفعيل فوري
 * — بلا رمز دعوة وبلا إرسال أي بريد. صف موجود بنفس البريد يُحدَّث حسابه
 * (تدوير كلمة المرور) ولا يُكرَّر.
 *
 * Flags:
 *   --file <path>    ملف CSV (الافتراضي: ../scripts/accepted.csv)
 *   --org <ref>      slug أو id للمنظمة (الافتراضي: mof)
 *   --dry-run        وضع المعاينة — هو الافتراضي؛ للتنفيذ الفعلي: --dry-run=false
 *
 * Safety contract:
 *   - المعاينة هي الافتراضي؛ التنفيذ الفعلي يتطلب --dry-run=false صراحةً.
 *   - تنفيذ فعلي على قاعدة إنتاجية يتطلب ALLOW_PRODUCTION_BOOTSTRAP=1.
 *   - لا يُرسَل أي بريد إطلاقاً.
 *   - لا تُطبع أي كلمة مرور — لا نصاً ولا مشفَّرة؛ النتائج عدّادات فقط.
 *   - المعمارية: لا نص صريح لكلمة مرور يُخزَّن — bcrypt فقط.
 */
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import {
  applySheetCredentials,
  ensureImportApplication,
  findAcceptedCandidate,
} from "../src/infrastructure/services/candidate-provisioning.service";

const APP_DIR = resolve(__dirname, "..");

function loadDotEnv() {
  const envPath = resolve(APP_DIR, ".env");
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    if (process.env[key] !== undefined) continue;
    process.env[key] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadDotEnv();

function argValue(name: string): string | undefined {
  const argv = process.argv.slice(2);
  const idx = argv.indexOf(`--${name}`);
  if (idx !== -1 && idx + 1 < argv.length) return argv[idx + 1];
  const prefix = `--${name}=`;
  const hit = argv.find((a) => a.startsWith(prefix));
  if (hit) return hit.slice(prefix.length);
  return undefined;
}

const filePath = argValue("file") ?? resolve(APP_DIR, "../scripts/accepted.csv");
const orgRef = argValue("org") ?? "mof";
// المعاينة هي الافتراضي؛ التنفيذ الفعلي يتطلب --dry-run=false صراحةً.
const dryRun = !process.argv.includes("--dry-run=false");

const prisma = new PrismaClient();

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i += 1; } else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { out.push(cur.trim()); cur = ""; }
    else cur += c;
  }
  out.push(cur.trim());
  return out;
}

const EMAIL_HEADERS = ["email", "e-mail", "mail", "البريد", "البريد الالكتروني", "البريد الإلكتروني", "بريد"];
const PASSWORD_HEADERS = ["password", "pass", "كلمة المرور", "كلمة سر", "كلمةالسر", "كلمه المرور", "باسورد"];
const NAME_HEADERS = ["name", "namear", "الاسم", "اسم", "اسم المرشح"];

function headerIndex(cells: string[], candidates: string[], prefix: string): number {
  return cells.findIndex((c) => candidates.includes(c) || c.startsWith(prefix));
}

interface SheetRow { name: string; email: string; password: string; lineNo: number }

async function main() {
  const databaseUrl = process.env.DATABASE_URL ?? process.env.NEON_DATABASE_URL;
  if (!databaseUrl) { console.error("❌ DATABASE_URL is not set"); process.exit(1); }

  // حماية الإنتاج: تنفيذ فعلي على قاعدة إنتاجية يحتاج موافقة صريحة.
  const isProdUrl = /^(postgres|postgresql):\/\/.*(neon\.tech|amazonaws\.com|azure|supabase)/i.test(databaseUrl);
  if (!dryRun && (process.env.NODE_ENV === "production" || isProdUrl) && process.env.ALLOW_PRODUCTION_BOOTSTRAP !== "1") {
    console.error("❌ رفض التنفيذ على قاعدة إنتاجية: مرّر ALLOW_PRODUCTION_BOOTSTRAP=1 مع --dry-run=false");
    process.exit(1);
  }

  const org = await prisma.organization.findFirst({
    where: { OR: [{ slug: orgRef }, { id: orgRef }] },
    select: { id: true, nameAr: true, slug: true },
  });
  if (!org) throw new Error(`organization not found: ${orgRef}`);
  console.log(`[sheet] org=${org.slug} (${org.id}) name=${org.nameAr}`);

  if (!existsSync(filePath)) throw new Error(`csv file not found: ${filePath}`);
  const content = readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length < 2) throw new Error("csv has no data rows");

  const headerCells = parseCsvLine(lines[0]).map((c) => c.trim().toLowerCase());
  const emailIdx = headerIndex(headerCells, EMAIL_HEADERS, "email");
  const passwordIdx = headerIndex(headerCells, PASSWORD_HEADERS, "password");
  const nameIdx = headerIndex(headerCells, NAME_HEADERS, "name");
  if (emailIdx === -1) throw new Error("csv must contain an email column");
  if (passwordIdx === -1) throw new Error("csv must contain a password column");
  if (nameIdx === -1) throw new Error("csv must contain a name column");

  const accepted: SheetRow[] = [];
  const invalid: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = parseCsvLine(lines[i]);
    const email = (parts[emailIdx] ?? "").trim().toLowerCase();
    const name = (parts[nameIdx] ?? "").trim();
    // كلمة المرور كما هي تماماً — بلا تنظيف وبلا فحص سياسة.
    const password = parts[passwordIdx] ?? "";
    const lineNo = i + 1;
    if (!email || !email.includes("@")) { invalid.push(`${lineNo}: بريد غير صالح`); continue; }
    if (!name) { invalid.push(`${lineNo}: الاسم مطلوب`); continue; }
    if (!password) { invalid.push(`${lineNo}: كلمة المرور مطلوبة`); continue; }
    accepted.push({ name, email, password, lineNo });
  }

  const seen = new Set<string>();
  const unique: SheetRow[] = [];
  let duplicates = 0;
  for (const r of accepted) {
    if (seen.has(r.email)) { duplicates++; continue; }
    seen.add(r.email);
    unique.push(r);
  }

  console.log(`[sheet] mode=${dryRun ? "DRY-RUN" : "LIVE"} file=${filePath}`);
  console.log(`[sheet] parsed_rows=${accepted.length} valid=${accepted.length - invalid.length} invalid=${invalid.length} unique=${unique.length} duplicates_removed=${duplicates}`);
  for (const msg of invalid) console.log(`[sheet] INVALID ${msg}`);

  const toCreate: SheetRow[] = [];
  const toUpdate: string[] = [];
  for (const r of unique) {
    const existing = await findAcceptedCandidate(org.id, r.email);
    if (existing) toUpdate.push(`${r.email} -> ${existing.id}`);
    else toCreate.push(r);
  }
  console.log(`[sheet] to_create=${toCreate.length} to_update_credentials=${toUpdate.length}`);

  if (dryRun) {
    console.log("[sheet] DRY-RUN: لا يُنفَّذ أي كتابة. مرّر --dry-run=false للتنفيذ الفعلي.");
    return;
  }

  let created = 0, updated = 0, failed = 0;
  const auditCtx = { userId: null, source: "sheet_import" as const };

  for (const r of unique) {
    try {
      const existing = await findAcceptedCandidate(org.id, r.email);
      if (existing) {
        // القائمة هي المصدر الرسمي: الحساب القائم يُجدَّش — تدوير كلمة المرور + تفعيل.
        await prisma.$transaction(async (tx) => {
          const actor = { tx, ...auditCtx };
          await ensureImportApplication(existing.id, org.id, actor);
          await applySheetCredentials(existing.id, r.email, r.password, actor);
        });
        updated++;
        continue;
      }

      const nationalId = "APPROVED-" + randomBytes(6).toString("hex").toUpperCase();
      // ذرّياً: إنشاء المرشح + طلبه + حسابه من الشيت في معاملة واحدة.
      await prisma.$transaction(async (tx) => {
        const candidate = await tx.candidate.create({
          data: {
            nationalId,
            nameAr: r.name,
            email: r.email,
            jobTitle: "موظف",
            department: "عام",
            acceptanceDate: new Date(),
            organizationId: org.id,
            invitationSent: false,
          },
          select: { id: true },
        });
        const actor = { tx, ...auditCtx };
        await ensureImportApplication(candidate.id, org.id, actor);
        await applySheetCredentials(candidate.id, r.email, r.password, actor);
      });
      created++;
    } catch (e) {
      failed++;
      // لا تُطبع كلمة المرور أبداً — رسالة الخطأ فقط.
      console.error(`[sheet] FAILED ${r.email}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(`[sheet] created=${created} credentials_applied=${updated} failed=${failed}`);
  console.log(`[sheet] invalid=${invalid.length} duplicates_removed=${duplicates}`);
  console.log("[sheet] الحسابات مفعّلة وجاهزة للدخول في /auth/candidate — لم يُرسَل أي بريد.");
}

main()
  .catch((e) => { console.error("[sheet] fatal:", e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
