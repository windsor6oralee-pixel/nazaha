/**
 * ImportBatch service — full lifecycle for accepted-candidate import batches.
 *
 * Lifecycle (batch):
 *   PENDING → VALIDATING → READY → APPROVED → EXECUTING → COMPLETED | PARTIAL | FAILED
 *   any pre-execution state → CANCELLED
 *   terminal → ARCHIVED (frozen; no further transitions)
 *
 * Lifecycle (item):
 *   PENDING → VALID | INVALID | DUPLICATE
 *   VALID → MATCHED_NEW | MATCHED_EXISTING | CONFLICT   (matching)
 *   MATCHED_* → READY → EXECUTING → DONE | FAILED | SKIPPED
 *
 * Safety contract:
 *   - Every query is organizationId-scoped (tenant isolation).
 *   - Historical EmailLog / Application / Candidate rows are never rewritten
 *     — except the OFFICIAL-SHEET credential write described below.
 *   - Upload never writes candidates/accounts and never mails: the password
 *     column is stored ENCRYPTED (AES-256-GCM) on the item and is only
 *     decrypted at execution, when it becomes the candidate's login password.
 *   - Execution applies the sheet credentials (loginEmail + bcrypt hash as-is)
 *     and ACTIVATES the account immediately — the sheet is the official source
 *     of accepted-candidate accounts. No e-mail is ever sent here.
 *   - Execution claims each item with a CAS + lease so two workers can never
 *     process the same item concurrently.
 *   - The final resultSummary is written ONCE at terminal status and never
 *     recomputed from live Candidate/Application state — and never contains
 *     credentials, hashes or secrets.
 */
import { prisma } from "@/infrastructure/database/client";
import { encrypt, decrypt } from "@/lib/crypto";
import { applySheetCredentials, ensureImportApplication } from "./candidate-provisioning.service";
import type { ImportBatchStatus, ImportItemStatus } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BatchItemInput {
  itemKey: string;
  nationalId?: string | null;
  email?: string | null;
  nameAr: string;
  jobTitle?: string | null;
  department?: string | null;
  acceptanceDate?: Date | null;
  /** كلمة مرور الشيت — تُشفَّر فوراً ولا تُخزَّن نصاً صريحاً. */
  password?: string | null;
}

export interface CreateBatchInput {
  organizationId: string;
  reference: string;
  sourceFileName?: string;
  createdByUserId?: string;
  items: BatchItemInput[];
}

export interface BatchSummary {
  id: string;
  organizationId: string;
  reference: string;
  status: ImportBatchStatus;
  sourceFileName: string | null;
  totalRows: number;
  validRows: number;
  importedCount: number;
  failedCount: number;
  createdByUserId: string | null;
  approvedByUserId: string | null;
  approvedAt: Date | null;
  executedAt: Date | null;
  resultSummary: unknown;
  createdAt: Date;
  updatedAt: Date;
  finishedAt: Date | null;
}

export interface ItemRow {
  id: string;
  batchId: string;
  organizationId: string;
  itemKey: string;
  nationalId: string | null;
  email: string | null;
  nameAr: string;
  jobTitle: string | null;
  department: string | null;
  acceptanceDate: Date | null;
  candidateId: string | null;
  applicationId: string | null;
  status: ImportItemStatus;
  errorMessage: string | null;
  matchedBy: string | null;
  claimToken: string | null;
  claimedAt: Date | null;
  leaseExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * صف العنصر كما يُخزَّن فعلياً — يشمل كلمة المرور المشفّرة.
 * للاستخدام الداخلي فقط (التنفيذ)؛ لا يُعاد أبداً إلى الواجهة:
 * `getImportBatch` / `getImportItemWithAttempts` يزيلان المشفَّر قبل الإرجاع.
 */
export interface SecretItemRow extends ItemRow {
  passwordCiphertext: string | null;
}

export interface BatchDetail extends BatchSummary {
  items: ItemRow[];
  counts: Record<string, number>;
}

export interface BatchResult {
  ok: boolean;
  batch?: BatchSummary;
  error?: string;
}

export class ImportError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "ImportError";
  }
}

const BATCH_SUMMARY_SELECT = {
  id: true,
  organizationId: true,
  reference: true,
  status: true,
  sourceFileName: true,
  totalRows: true,
  validRows: true,
  importedCount: true,
  failedCount: true,
  createdByUserId: true,
  approvedByUserId: true,
  approvedAt: true,
  executedAt: true,
  resultSummary: true,
  createdAt: true,
  updatedAt: true,
  finishedAt: true,
} as const;

function toSummary(b: Record<string, unknown>): BatchSummary {
  return { ...(b as object) } as BatchSummary;
}

const ITEM_TERMINAL: ImportItemStatus[] = ["DONE", "FAILED", "SKIPPED", "INVALID", "DUPLICATE", "CONFLICT"];

// ─── Create ───────────────────────────────────────────────────────────────────

/**
 * Creates a batch + its items in one transaction. Duplicate itemKeys inside
 * the payload are collapsed (first wins) and the DB unique index
 * (batchId, itemKey) is the final backstop.
 *
 * Creating a batch performs NO side effects: no candidate rows, no accounts
 * and no e-mail. The password column is stored ENCRYPTED on the item only —
 * it becomes a login password at execution. Upload ≠ import ≠ invitation.
 */
export async function createImportBatch(input: CreateBatchInput): Promise<BatchResult> {
  const existing = await prisma.importBatch.findUnique({ where: { reference: input.reference } });
  if (existing) return { ok: false, error: "BATCH_ALREADY_EXISTS" };

  // Collapse duplicate itemKeys client-side so the report counts stay honest.
  const seen = new Set<string>();
  const uniqueItems: BatchItemInput[] = [];
  for (const it of input.items) {
    const key = it.itemKey.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    uniqueItems.push({ ...it, itemKey: key });
  }
  if (!uniqueItems.length) return { ok: false, error: "EMPTY_BATCH" };

  const batch = await prisma.$transaction(async (tx) => {
    const b = await tx.importBatch.create({
      data: {
        organizationId: input.organizationId,
        reference: input.reference,
        sourceFileName: input.sourceFileName ?? null,
        createdByUserId: input.createdByUserId ?? null,
        status: "PENDING",
        totalRows: uniqueItems.length,
        validRows: 0,
      },
      select: BATCH_SUMMARY_SELECT,
    });
    await tx.importItem.createMany({
      data: uniqueItems.map((it) => ({
        batchId: b.id,
        organizationId: input.organizationId,
        itemKey: it.itemKey,
        nationalId: it.nationalId ?? null,
        email: it.email?.trim().toLowerCase() ?? null,
        nameAr: it.nameAr.trim(),
        jobTitle: it.jobTitle ?? null,
        department: it.department ?? null,
        acceptanceDate: it.acceptanceDate ?? null,
        // نص صريح لا يُخزَّن أبداً — تشفير فوري (AES-256-GCM).
        passwordCiphertext: it.password?.trim() ? encrypt(it.password.trim()) : null,
        status: "PENDING" as ImportItemStatus,
      })),
    });
    return b;
  });

  return { ok: true, batch: toSummary(batch) };
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/** يزيل كلمة المرور المشفّرة قبل إرجاع صف العنصر إلى الواجهة. */
function toPublicItem(it: { passwordCiphertext: string | null }): ItemRow {
  const row = { ...(it as object) } as Record<string, unknown>;
  delete row.passwordCiphertext;
  return row as unknown as ItemRow;
}

export async function getImportBatch(organizationId: string, batchId: string): Promise<BatchDetail | null> {
  const batch = await prisma.importBatch.findFirst({
    where: { id: batchId, organizationId },
    select: BATCH_SUMMARY_SELECT,
  });
  if (!batch) return null;

  const items = await prisma.importItem.findMany({
    where: { batchId },
    orderBy: { createdAt: "asc" },
  });

  const counts: Record<string, number> = {};
  for (const it of items) counts[it.status] = (counts[it.status] ?? 0) + 1;

  return { ...toSummary(batch), items: items.map(toPublicItem), counts };
}

export async function listImportBatches(
  organizationId: string,
  opts?: { status?: ImportBatchStatus; take?: number; skip?: number },
): Promise<BatchSummary[]> {
  const where: { organizationId: string; status?: ImportBatchStatus } = { organizationId };
  if (opts?.status) where.status = opts.status;
  const batches = await prisma.importBatch.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: opts?.take ?? 50,
    skip: opts?.skip ?? 0,
    select: BATCH_SUMMARY_SELECT,
  });
  return batches.map(toSummary);
}

// ─── Validate (PENDING → VALIDATING → READY) ─────────────────────────────────

export interface ValidationResult {
  ok: boolean;
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
  error?: string;
}

/**
 * Validation pass: field-level checks + in-batch duplicate detection.
 * Sets item status VALID / INVALID / DUPLICATE and the batch counters.
 *
 * القائمة الرسمية لكل صف: اسم + بريد + كلمة مرور — البريد أساس الدخول
 * وكلمة المرور شرط لإنشاء الحساب، فغياب أيٍّ منهما يُبطل الصف.
 *
 * Duplicate rule: same normalized email OR same nationalId seen earlier in
 * the batch (first occurrence wins, later ones become DUPLICATE).
 */
export async function validateImportBatch(organizationId: string, batchId: string): Promise<ValidationResult> {
  const batch = await prisma.importBatch.findFirst({ where: { id: batchId, organizationId } });
  if (!batch) return { ok: false, total: 0, valid: 0, invalid: 0, duplicates: 0, error: "NOT_FOUND" };
  if (batch.status !== "PENDING" && batch.status !== "VALIDATING") {
    return { ok: false, total: 0, valid: 0, invalid: 0, duplicates: 0, error: `BAD_STATE:${batch.status}` };
  }

  await prisma.importBatch.update({ where: { id: batchId }, data: { status: "VALIDATING" } });

  const items = await prisma.importItem.findMany({ where: { batchId }, orderBy: { createdAt: "asc" } });
  const seenEmails = new Set<string>();
  const seenNationalIds = new Set<string>();

  let valid = 0, invalid = 0, duplicates = 0;
  for (const it of items) {
    let status: ImportItemStatus = "VALID";
    let errorMessage: string | null = null;

    const email = it.email?.trim().toLowerCase() ?? "";
    const nationalId = it.nationalId?.trim() ?? "";

    if (!it.nameAr.trim()) {
      status = "INVALID";
      errorMessage = "الاسم مطلوب";
    } else if (!email) {
      status = "INVALID";
      errorMessage = "البريد الإلكتروني مطلوب لحساب الدخول";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      status = "INVALID";
      errorMessage = "البريد الإلكتروني غير صالح";
    } else if (!it.passwordCiphertext) {
      status = "INVALID";
      errorMessage = "كلمة المرور مطلوبة";
    } else if (seenEmails.has(email)) {
      status = "DUPLICATE";
      errorMessage = "بريد مكرر داخل الدفعة";
    } else if (nationalId && seenNationalIds.has(nationalId)) {
      status = "DUPLICATE";
      errorMessage = "رقم هوية مكرر داخل الدفعة";
    }

    if (status === "VALID") {
      if (email) seenEmails.add(email);
      if (nationalId) seenNationalIds.add(nationalId);
      valid++;
    } else if (status === "DUPLICATE") duplicates++;
    else invalid++;

    await prisma.importItem.update({
      where: { id: it.id },
      data: { status, errorMessage },
    });
  }

  await prisma.importBatch.update({
    where: { id: batchId },
    data: { validRows: valid, status: "READY" },
  });

  return { ok: true, total: items.length, valid, invalid, duplicates };
}

// ─── Match (preview before approval) ─────────────────────────────────────────

export interface MatchPreview {
  ok: boolean;
  matchedNew: number;
  matchedExisting: number;
  conflicts: number;
  alreadyTerminal: number;
  error?: string;
}

/**
 * Matching pass — runs as the PREVIEW step. Never writes to Candidate.
 *
 * Rules (verified in code, conflicts surfaced for human review):
 *   1. nationalId within this org  → MATCHED_EXISTING (matchedBy="nationalId")
 *   2. else email (lowercased) within this org → MATCHED_EXISTING (matchedBy="email")
 *   3. neither → MATCHED_NEW (a candidate will be created at execution)
 *   4. nationalId points at candidate A but email points at candidate B
 *      → CONFLICT: never auto-run, a human must resolve it.
 */
export async function previewImportMatching(organizationId: string, batchId: string): Promise<MatchPreview> {
  const batch = await prisma.importBatch.findFirst({ where: { id: batchId, organizationId } });
  if (!batch) return { ok: false, matchedNew: 0, matchedExisting: 0, conflicts: 0, alreadyTerminal: 0, error: "NOT_FOUND" };
  if (batch.status !== "READY" && batch.status !== "APPROVED") {
    return { ok: false, matchedNew: 0, matchedExisting: 0, conflicts: 0, alreadyTerminal: 0, error: `BAD_STATE:${batch.status}` };
  }

  const items = await prisma.importItem.findMany({
    where: { batchId, status: { in: ["VALID", "MATCHED_NEW", "MATCHED_EXISTING", "CONFLICT"] } },
    orderBy: { createdAt: "asc" },
  });

  let matchedNew = 0, matchedExisting = 0, conflicts = 0, alreadyTerminal = 0;

  for (const it of items) {
    const nationalId = it.nationalId?.trim() ?? "";
    const email = it.email?.trim().toLowerCase() ?? "";

    const byNational = nationalId
      ? await prisma.candidate.findFirst({
          where: { organizationId, nationalId },
          select: { id: true },
        })
      : null;
    const byEmail = email
      ? await prisma.candidate.findFirst({
          where: { organizationId, OR: [{ email }, { loginEmail: email }] },
          select: { id: true },
        })
      : null;

    if (byNational && byEmail && byNational.id !== byEmail.id) {
      // Ambiguous — the two identifiers point at different people.
      await prisma.importItem.update({
        where: { id: it.id },
        data: {
          status: "CONFLICT",
          matchedBy: "conflict",
          errorMessage: `تعارض: رقم الهوية يشير إلى مرشح آخر (${byNational.id}) والبريد إلى (${byEmail.id})`,
        },
      });
      conflicts++;
      continue;
    }

    if (byNational || byEmail) {
      const matched = byNational ?? byEmail!;
      await prisma.importItem.update({
        where: { id: it.id },
        data: {
          status: "MATCHED_EXISTING",
          matchedBy: byNational ? "nationalId" : "email",
          candidateId: matched.id,
          errorMessage: null,
        },
      });
      matchedExisting++;
    } else {
      await prisma.importItem.update({
        where: { id: it.id },
        data: { status: "MATCHED_NEW", matchedBy: "none", candidateId: null, errorMessage: null },
      });
      matchedNew++;
    }
  }

  const terminalCount = await prisma.importItem.count({
    where: { batchId, status: { in: ITEM_TERMINAL } },
  });
  alreadyTerminal = terminalCount;

  return { ok: true, matchedNew, matchedExisting, conflicts, alreadyTerminal };
}

// ─── Approve (READY → APPROVED) ──────────────────────────────────────────────

export async function approveImportBatch(
  organizationId: string,
  batchId: string,
  userId: string,
): Promise<BatchResult> {
  const batch = await prisma.importBatch.findFirst({ where: { id: batchId, organizationId } });
  if (!batch) return { ok: false, error: "NOT_FOUND" };
  if (batch.status !== "READY") return { ok: false, error: `BAD_STATE:${batch.status}` };

  // Approval is only meaningful when no CONFLICT is left unresolved.
  const conflicts = await prisma.importItem.count({ where: { batchId, status: "CONFLICT" } });
  if (conflicts > 0) return { ok: false, error: `UNRESOLVED_CONFLICTS:${conflicts}` };

  // The matching preview must have run: every non-terminal item has to be
  // MATCHED_* already (VALID/PENDING means nobody knows what would happen).
  const unmatched = await prisma.importItem.count({
    where: { batchId, status: { in: ["PENDING", "VALID"] } },
  });
  if (unmatched > 0) return { ok: false, error: "PREVIEW_REQUIRED" };

  // Matched items become READY — the queue the executor claims from.
  const [, updated] = await prisma.$transaction([
    prisma.importItem.updateMany({
      where: { batchId, status: { in: ["MATCHED_NEW", "MATCHED_EXISTING"] } },
      data: { status: "READY" },
    }),
    prisma.importBatch.update({
      where: { id: batchId },
      data: { status: "APPROVED", approvedByUserId: userId, approvedAt: new Date() },
      select: BATCH_SUMMARY_SELECT,
    }),
  ]);
  return { ok: true, batch: toSummary(updated) };
}

// ─── Execute (APPROVED → EXECUTING → terminal) ───────────────────────────────

/** Atomically claims ONE item: READY → EXECUTING with a fresh lease.
 *  Also reclaims an EXECUTING row whose lease has EXPIRED (crashed worker).
 *  Exactly one row per call: select a target, then CAS it by id — a worker
 *  that loses the race gets null for that row and moves to the next one. */
export async function claimImportItem(batchId: string, leaseMs = 60_000): Promise<SecretItemRow | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const now = new Date();
    const claimable = {
      batchId,
      OR: [
        { status: "READY" as const },
        { status: "EXECUTING" as const, leaseExpiresAt: { lt: now } },
      ],
    };

    const target = await prisma.importItem.findFirst({
      where: claimable,
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!target) return null;

    const token = `claim_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const leaseExpiresAt = new Date(now.getTime() + leaseMs);

    // CAS: re-assert claimability on this exact row; only one worker wins.
    const res = await prisma.importItem.updateMany({
      where: { id: target.id, ...claimable },
      data: { status: "EXECUTING", claimToken: token, claimedAt: now, leaseExpiresAt },
    });
    if (res.count === 1) {
      const item = await prisma.importItem.findFirst({
        where: { id: target.id, claimToken: token },
      });
      return (item as SecretItemRow) ?? null;
    }
    // Lost the race — the row is now claimed; loop and pick the next one.
  }
  return null;
}

/** Releases a claim without completing (e.g. worker crash recovery). */
export async function releaseImportItem(itemId: string, token: string): Promise<void> {
  await prisma.importItem.updateMany({
    where: { id: itemId, claimToken: token, status: "EXECUTING" },
    data: { status: "READY", claimToken: null, claimedAt: null, leaseExpiresAt: null },
  });
}

/** Marks a claimed item terminal. */
export async function finishImportItem(
  itemId: string,
  token: string,
  outcome: { status: "DONE" | "FAILED" | "SKIPPED"; errorMessage?: string | null; candidateId?: string; applicationId?: string },
): Promise<boolean> {
  const res = await prisma.importItem.updateMany({
    where: { id: itemId, claimToken: token, status: "EXECUTING" },
    data: {
      status: outcome.status,
      errorMessage: outcome.errorMessage ?? null,
      ...(outcome.candidateId ? { candidateId: outcome.candidateId } : {}),
      ...(outcome.applicationId ? { applicationId: outcome.applicationId } : {}),
      claimToken: null,
      claimedAt: null,
      leaseExpiresAt: null,
    },
  });
  return res.count === 1;
}

export interface ExecuteResult {
  ok: boolean;
  processed: number;
  done: number;
  failed: number;
  skipped: number;
  batchStatus: ImportBatchStatus;
  error?: string;
}

/** يفكّ كلمة مرور الشيت المشفّرة للصف — برسالة عربية واضحة عند الغياب/الفشل. */
function sheetPasswordOf(item: SecretItemRow): string {
  if (!item.passwordCiphertext) {
    throw new Error("الصف بلا كلمة مرور من القائمة الرسمية — أعد رفع القائمة بالصيغة الجديدة");
  }
  try {
    return decrypt(item.passwordCiphertext);
  } catch {
    throw new Error("تعذّر فك تشفير كلمة مرور الصف");
  }
}

/**
 * Runs the import for one batch: claims each MATCHED_* item and applies the
 * OFFICIAL ACCEPTED-CANDIDATES SHEET to it:
 *
 *   - MATCHED_NEW      → creates the candidate + APPROVED application +
 *                        onboarding/documents, then writes the sheet
 *                        credentials and ACTIVATES the account.
 *   - MATCHED_EXISTING → applies the sheet credentials to the existing account
 *                        (the sheet is authoritative: it rotates the password
 *                        and activates), creating an application only when the
 *                        candidate has none at all.
 *
 * Account rule: loginEmail = sheet e-mail, passwordHash = bcrypt(sheet password
 * as-is — no strength policy), accountActivatedAt = now. NO e-mail is sent:
 * the sheet itself delivers the credentials.
 */
export async function executeImportBatch(
  organizationId: string,
  batchId: string,
  opts: { createdByUserId?: string; onItem?: (item: ItemRow, status: string) => void } = {},
): Promise<ExecuteResult> {
  const batch = await prisma.importBatch.findFirst({ where: { id: batchId, organizationId } });
  if (!batch) return { ok: false, processed: 0, done: 0, failed: 0, skipped: 0, batchStatus: "FAILED", error: "NOT_FOUND" };
  if (batch.status !== "APPROVED" && batch.status !== "EXECUTING") {
    return { ok: false, processed: 0, done: 0, failed: 0, skipped: 0, batchStatus: batch.status, error: `BAD_STATE:${batch.status}` };
  }

  await prisma.importBatch.update({
    where: { id: batchId },
    data: { status: "EXECUTING", executedAt: batch.executedAt ?? new Date() },
  });

  // Default workflow for newly created applications (one per org).
  const workflow = await prisma.workflow.findFirst({
    where: { organizationId, isDefault: true, isActive: true },
    include: { steps: { orderBy: { order: "asc" }, include: { documentRequirements: true } } },
  });

  let done = 0, failed = 0, skipped = 0, processed = 0;

  for (;;) {
    const item = await claimImportItem(batchId);
    if (!item) break;
    processed++;
    opts.onItem?.(item, "EXECUTING");

    try {
      if (item.status === "EXECUTING" && item.matchedBy === "conflict") {
        await finishImportItem(item.id, item.claimToken!, { status: "SKIPPED", errorMessage: "تعارض غير محلول — يحتاج مراجعة يدوية" });
        skipped++;
        continue;
      }

      if (item.matchedBy === "nationalId" || item.matchedBy === "email") {
        // MATCHED_EXISTING — القائمة الرسمية تُطبَّق على الحساب القائم:
        // بريد الشيت + كلمته كما هي + تفعيل فوري. الطلبات القائمة لا تُمَس.
        if (!item.candidateId) throw new Error("MATCHED_EXISTING بدون candidateId");
        const loginEmail = item.email?.trim().toLowerCase();
        if (!loginEmail) throw new Error("الصف بلا بريد — أساس حساب الدخول");
        const password = sheetPasswordOf(item);
        const actor = { userId: opts.createdByUserId ?? null, source: "import_batch" };

        const ensured = await prisma.$transaction(async (tx) => {
          const app = await ensureImportApplication(item.candidateId!, organizationId, { tx, ...actor });
          await applySheetCredentials(item.candidateId!, loginEmail, password, { tx, ...actor });
          return app;
        });

        const okFinish = await finishImportItem(item.id, item.claimToken!, {
          status: "DONE",
          // يُربط العنصر بالطلب فقط إن أنشأه هذا الاستيراد فعلاً.
          ...(ensured.created && ensured.applicationId ? { applicationId: ensured.applicationId } : {}),
        });
        if (okFinish) done++;
        continue;
      }

      // MATCHED_NEW — إنشاء المرشح + طلب موافقته + تهيئة رحلته، ثم حسابه من الشيت.
      if (!workflow) throw new Error("لا يوجد سير عمل افتراضي للمنظمة");

      const email = item.email?.trim().toLowerCase();
      if (!email) throw new Error("الصف بلا بريد — أساس حساب الدخول");
      const password = sheetPasswordOf(item);
      const nationalId = item.nationalId?.trim() || `IMP-${item.itemKey}`;
      const actor = { userId: opts.createdByUserId ?? null, source: "import_batch" };

      const created = await prisma.$transaction(async (tx) => {
        // Re-check inside the transaction: a concurrent import may have created
        // the same person between preview and execution.
        const existing = await tx.candidate.findFirst({
          where: {
            organizationId,
            ...(nationalId ? { nationalId } : {}),
          },
          select: { id: true },
        });
        if (existing) {
          // أُنشئ تزامناً بين المعاينة والتنفيذ — يُطبَّق عليه الشيت كذلك.
          await ensureImportApplication(existing.id, organizationId, { tx, ...actor });
          await applySheetCredentials(existing.id, email, password, { tx, ...actor });
          return { candidateId: existing.id, applicationId: null as string | null, reused: true };
        }

        const c = await tx.candidate.create({
          data: {
            nameAr: item.nameAr,
            nationalId,
            email,
            jobTitle: item.jobTitle ?? "موظف",
            department: item.department ?? "عام",
            acceptanceDate: item.acceptanceDate ?? new Date(),
            organizationId,
            invitationSent: false,
          },
          select: { id: true },
        });

        const application = await tx.application.create({
          data: {
            candidateId: c.id,
            organizationId,
            workflowId: workflow.id,
            status: "APPROVED",
            approvedAt: new Date(),
          },
          select: { id: true },
        });

        // تهيئة رحلة المرشح: خطوات سير العمل ووثائقه المطلوبة —
        // كما في الاستيراد الرسمي حتى يجد المرشح متطلباته في بوابته.
        await tx.onboardingProcess.create({
          data: {
            applicationId: application.id,
            steps: {
              create: workflow.steps.map((s) => ({ workflowStepId: s.id, status: "PENDING" as const })),
            },
          },
        });
        const allDocs = workflow.steps.flatMap((s) =>
          s.documentRequirements.map((req) => ({
            type: req.documentType,
            nameAr: req.nameAr,
            isRequired: req.isRequired,
            applicationId: application.id,
          })),
        );
        if (allDocs.length > 0) await tx.document.createMany({ data: allDocs });

        // حساب الدخول من الشيت + تفعيل فوري — ذرّياً مع إنشاء المرشح.
        await applySheetCredentials(c.id, email, password, { tx, ...actor });

        await tx.auditLog.create({
          data: {
            actorType: "SYSTEM",
            action: "candidate.import_batch",
            resource: "Candidate",
            resourceId: c.id,
            applicationId: application.id,
            candidateId: c.id,
            userId: opts.createdByUserId ?? null,
            metadata: { batchId, itemKey: item.itemKey, sourceFile: batch.sourceFileName },
          },
        });

        return { candidateId: c.id, applicationId: application.id, reused: false };
      });

      const okFinish = await finishImportItem(item.id, item.claimToken!, {
        status: "DONE",
        candidateId: created.candidateId,
        ...(created.applicationId ? { applicationId: created.applicationId } : {}),
      });
      if (okFinish) done++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await finishImportItem(item.id, item.claimToken!, { status: "FAILED", errorMessage: msg });
      failed++;
      opts.onItem?.(item, "FAILED");
    }
  }

  // Terminal status + FROZEN result summary (written once, never recomputed).
  const terminalStatus: ImportBatchStatus = failed === 0 ? "COMPLETED" : done > 0 ? "PARTIAL" : "FAILED";
  const counts = await prisma.importItem.groupBy({ by: ["status"], where: { batchId }, _count: { _all: true } });
  const statusCounts: Record<string, number> = {};
  for (const c of counts) statusCounts[c.status] = c._count._all;

  await prisma.importBatch.update({
    where: { id: batchId },
    data: {
      status: terminalStatus,
      importedCount: done,
      failedCount: failed,
      finishedAt: new Date(),
      resultSummary: {
        frozenAt: new Date().toISOString(),
        processed,
        done,
        failed,
        skipped,
        itemStatusCounts: statusCounts,
        // Snapshot of identifiers only — no credentials, no hashes, no secrets.
        createdBy: opts.createdByUserId ?? batch.createdByUserId ?? null,
      },
    },
  });

  return { ok: true, processed, done, failed, skipped, batchStatus: terminalStatus };
}

// ─── Cancel / Archive ────────────────────────────────────────────────────────

export async function cancelImportBatch(organizationId: string, batchId: string): Promise<BatchResult> {
  const batch = await prisma.importBatch.findFirst({ where: { id: batchId, organizationId } });
  if (!batch) return { ok: false, error: "NOT_FOUND" };
  if (batch.status !== "PENDING" && batch.status !== "VALIDATING" && batch.status !== "READY" && batch.status !== "APPROVED") {
    return { ok: false, error: `BAD_STATE:${batch.status}` };
  }
  const updated = await prisma.importBatch.update({
    where: { id: batchId },
    data: { status: "CANCELLED", finishedAt: new Date() },
    select: BATCH_SUMMARY_SELECT,
  });
  return { ok: true, batch: toSummary(updated) };
}

export async function archiveImportBatch(organizationId: string, batchId: string): Promise<BatchResult> {
  const batch = await prisma.importBatch.findFirst({ where: { id: batchId, organizationId } });
  if (!batch) return { ok: false, error: "NOT_FOUND" };
  const terminal: ImportBatchStatus[] = ["COMPLETED", "PARTIAL", "FAILED", "CANCELLED"];
  if (!terminal.includes(batch.status)) return { ok: false, error: `BAD_STATE:${batch.status}` };
  const updated = await prisma.importBatch.update({
    where: { id: batchId },
    data: { status: "ARCHIVED" },
    select: BATCH_SUMMARY_SELECT,
  });
  return { ok: true, batch: toSummary(updated) };
}

// ─── Report ──────────────────────────────────────────────────────────────────

export interface BatchAttemptRow {
  id: string;
  importItemId: string | null;
  toAddress: string;
  subject: string;
  status: string;
  errorMessage: string | null;
  idempotencyKey: string | null;
  sendStartedAt: Date | null;
  createdAt: Date;
}

/** Every e-mail attempt for a batch (org-scoped). Used by the report API. */
export async function listBatchEmailAttempts(
  organizationId: string,
  batchId: string,
): Promise<BatchAttemptRow[]> {
  return prisma.emailLog.findMany({
    where: { batchId, organizationId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      importItemId: true,
      toAddress: true,
      subject: true,
      status: true,
      errorMessage: true,
      idempotencyKey: true,
      sendStartedAt: true,
      createdAt: true,
    },
  });
}

/** One item + its full attempt history (both org-scoped). */
export async function getImportItemWithAttempts(
  organizationId: string,
  batchId: string,
  itemId: string,
): Promise<{ item: ItemRow; attempts: BatchAttemptRow[] } | null> {
  const item = await prisma.importItem.findFirst({
    where: { id: itemId, batchId, organizationId },
  });
  if (!item) return null;
  const attempts = prisma.emailLog.findMany({
    where: { importItemId: item.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      importItemId: true,
      toAddress: true,
      subject: true,
      status: true,
      errorMessage: true,
      idempotencyKey: true,
      sendStartedAt: true,
      createdAt: true,
    },
  });
  return { item: toPublicItem(item), attempts: await attempts };
}


export interface BatchReport {
  batch: BatchSummary;
  itemStatusCounts: Record<string, number>;
  /** Frozen snapshot — NOT recomputed from live candidate state. */
  resultSummary: unknown;
  /** Live state, clearly separated from the frozen result. */
  live: {
    candidatesLinked: number;
    applicationsLinked: number;
    emailAttempts: number;
    emailByStatus: Record<string, number>;
  };
}

export async function buildBatchReport(organizationId: string, batchId: string): Promise<BatchReport | null> {
  const detail = await getImportBatch(organizationId, batchId);
  if (!detail) return null;

  const itemStatusCounts: Record<string, number> = {};
  for (const it of detail.items) itemStatusCounts[it.status] = (itemStatusCounts[it.status] ?? 0) + 1;

  const candidatesLinked = detail.items.filter((i) => i.candidateId).length;
  const applicationsLinked = detail.items.filter((i) => i.applicationId).length;

  const emailRows = await prisma.emailLog.findMany({
    where: { batchId },
    select: { status: true },
  });
  const emailByStatus: Record<string, number> = {};
  for (const r of emailRows) emailByStatus[r.status] = (emailByStatus[r.status] ?? 0) + 1;

  const { resultSummary, ...batch } = detail;
  void batch;

  return {
    batch: detail,
    itemStatusCounts,
    resultSummary,
    live: {
      candidatesLinked,
      applicationsLinked,
      emailAttempts: emailRows.length,
      emailByStatus,
    },
  };
}
