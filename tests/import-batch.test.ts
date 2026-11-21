/**
 * Acceptance tests for the ImportBatch / ImportItem / EmailLog unit.
 *
 * Runs against the LOCAL dev database (test env only). The mail notifier is
 * mocked at the module boundary — no real SMTP/provider is ever touched:
 * `getOrgNotifier` is replaced by an in-memory spy for every import.
 *
 * Covered (17 acceptance cases):
 *   1  upload has zero side effects (no mail, no candidate, no account)
 *   2  validation flags invalid rows + in-batch duplicates → READY
 *   3  matching preview links by nationalId
 *   4  matching preview links by email
 *   5  matching preview marks unknown rows MATCHED_NEW
 *   6  conflicting identifiers → CONFLICT (never a match)
 *   7  approval blocked without preview and while conflicts unresolved
 *   8  approval records actor/time, queues items READY, double-approve rejected
 *   9  execute creates candidates + sheet credentials (activated, no mail)
 *  10  execute applies the sheet to existing candidates (identity untouched)
 *  11  terminal resultSummary frozen once, contains no credentials, no re-run
 *  12  claim/lease CAS: one worker wins, expired lease reclaimable
 *  13  existing-account dispatch: password-free notice, credentials untouched
 *  14  no-account items skipped unless provisioning explicitly opted in
 *  15  crash-window attempt = UNKNOWN: never auto-resent; manual reconcile → retry as attempt 2
 *  16  idempotency: completed attempt not resent; duplicate key rejected by DB
 *  17  tenant scoping server-side + every new route guards with requireHR
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// ── Mail provider is fully mocked: nothing here can send real e-mail. ────────
const mocks = vi.hoisted(() => {
  const send = vi.fn(async (msg: unknown): Promise<void> => { void msg; });
  return { send, notifier: { isTransport: true as const, send } };
});

vi.mock("@/infrastructure/notifications", () => ({
  getOrgNotifier: vi.fn(async () => mocks.notifier),
}));

import { prisma } from "@/infrastructure/database/client";
import {
  createImportBatch,
  validateImportBatch,
  previewImportMatching,
  approveImportBatch,
  executeImportBatch,
  claimImportItem,
  releaseImportItem,
  getImportBatch,
  listImportBatches,
} from "@/infrastructure/services/import-batch.service";
import {
  dispatchBatchInvitations,
  listUnknownAttempts,
  reconcileUnknownAttempt,
} from "@/infrastructure/services/import-invitation.service";
import { verifyCandidateCredentials } from "@/infrastructure/auth/credentials.service";

// ── Fixtures ─────────────────────────────────────────────────────────────────

let orgId: string;
let otherOrgId: string;
let workflowId: string;

// Existing candidate WITH an account (passwordHash set).
let acctCandidateId: string;
// Existing candidate WITHOUT any account fields.
let plainCandidateId: string;
// Conflict pair: A (nationalId) vs B (email) — A is referenced by nationalId only.
let conflictBId: string;
// Extra existing-account candidates (9000000005 / 9000000006) are matched by
// nationalId in the dispatch/isolation tests, so their ids are never read here.

// كلمة مرور القائمة الرسمية لكل صف في الاختبارات — لا تُطبع ولا تُخزَّن نصاً.
const SHEET_PASSWORD = "SheetPass-123456";

let seq = 0;
const ref = () => `T-${Date.now().toString(36)}-${(seq++).toString(36)}`;
const uniqueEmail = (tag: string) => `${tag}-${Date.now().toString(36)}-${seq++}@test.local`.toLowerCase();

async function waitFor(cond: () => Promise<boolean>, ms = 5000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (await cond()) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return cond();
}

async function sendCount(): Promise<number> {
  return mocks.send.mock.calls.length;
}

beforeAll(async () => {
  const now = Date.now();
  const org = await prisma.organization.create({
    data: { nameAr: "منظمة اختبار الاستيراد", slug: `test-import-${now.toString(36)}` },
  });
  orgId = org.id;
  const other = await prisma.organization.create({
    data: { nameAr: "منظمة اختبار معزولة", slug: `test-import-other-${now.toString(36)}` },
  });
  otherOrgId = other.id;

  const wf = await prisma.workflow.create({
    data: { nameAr: "سير عمل الاختبار", isDefault: true, isActive: true, organizationId: orgId },
  });
  workflowId = wf.id;
  void workflowId;

  const base = { organizationId: orgId, jobTitle: "موظف", department: "الإدارة", acceptanceDate: new Date() };

  const acct = await prisma.candidate.create({
    data: {
      ...base, nameAr: "مرشح بحساب", nationalId: "9000000001",
      email: uniqueEmail("acct"), passwordHash: "$2a$12$testhash_testhash_testhash_testhash_testhash_te",
      invitationSent: true, passwordChangedAt: new Date(),
    },
  });
  acctCandidateId = acct.id;

  const plain = await prisma.candidate.create({
    data: { ...base, nameAr: "مرشح بلا حساب", nationalId: "9000000002", email: uniqueEmail("plain") },
  });
  plainCandidateId = plain.id;

  await prisma.candidate.create({
    data: { ...base, nameAr: "مرشح أ", nationalId: "9000000003", email: uniqueEmail("candA") },
  });
  const b = await prisma.candidate.create({
    data: { ...base, nameAr: "مرشح ب", nationalId: "9000000004", email: uniqueEmail("candB") },
  });
  conflictBId = b.id;

  await prisma.candidate.create({
    data: {
      ...base, nameAr: "مرشح بحساب 2", nationalId: "9000000005",
      email: uniqueEmail("acct2"), passwordHash: "$2a$12$testhash_testhash_testhash_testhash_testhash_te",
    },
  });

  await prisma.candidate.create({
    data: {
      ...base, nameAr: "مرشح بحساب 3", nationalId: "9000000006",
      email: uniqueEmail("acct3"), passwordHash: "$2a$12$testhash_testhash_testhash_testhash_testhash_te",
    },
  });
});

afterAll(async () => {
  await prisma.emailLog.deleteMany({ where: { organizationId: orgId } });
  await prisma.importItem.deleteMany({ where: { organizationId: orgId } });
  await prisma.importBatch.deleteMany({ where: { organizationId: orgId } });
  // audit_logs is APPEND-ONLY (DB trigger denies UPDATE/DELETE), and its FKs
  // to applications/candidates are ON DELETE SET NULL — which needs an UPDATE
  // the trigger refuses. So test applications/candidates/workflows/orgs that
  // have audit rows stay in the local dev DB by design; every run uses fresh
  // orgs/emails/references, so no cross-run interference is possible.
  await prisma.$disconnect();
});

beforeEach(() => {
  mocks.send.mockClear();
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function newBatch(
  items: Array<{ itemKey: string; nameAr: string; email?: string; nationalId?: string; password?: string }>,
) {
  const res = await createImportBatch({
    organizationId: orgId,
    reference: ref(),
    sourceFileName: "test.csv",
    createdByUserId: "usr_test",
    // القائمة الرسمية: كل صف يحتاج كلمة مرور — الافتراضي هنا للتبسيط.
    items: items.map((it) => ({ ...it, password: it.password ?? SHEET_PASSWORD })),
  });
  expect(res.ok).toBe(true);
  return res.batch!;
}

// ═════════════════════════════════════════════════════════════════════════════

describe("ImportBatch acceptance (17 cases)", () => {
  // 1 ────────────────────────────────────────────────────────────────────────
  it("1. upload creates the batch with zero side effects: no mail, no candidate, no account", async () => {
    const candBefore = await prisma.candidate.count({ where: { organizationId: orgId } });
    const mailBefore = await prisma.emailLog.count({ where: { organizationId: orgId } });

    const batch = await newBatch([
      { itemKey: "r1", nameAr: "صف أول", email: uniqueEmail("up1"), nationalId: "9100000001" },
      { itemKey: "r2", nameAr: "صف ثانٍ", email: uniqueEmail("up2"), nationalId: "9100000002" },
    ]);

    expect(batch!.status).toBe("PENDING");
    expect(batch!.totalRows).toBe(2);

    const candAfter = await prisma.candidate.count({ where: { organizationId: orgId } });
    const mailAfter = await prisma.emailLog.count({ where: { organizationId: orgId } });
    expect(candAfter).toBe(candBefore);
    expect(mailAfter).toBe(mailBefore);
    expect(await sendCount()).toBe(0);

    const items = await prisma.importItem.findMany({ where: { batchId: batch!.id } });
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.status === "PENDING")).toBe(true);
    expect(items.every((i) => i.candidateId === null)).toBe(true);
    // كلمة المرور مخزّنة مشفَّرة فقط — لا نص صريح في قاعدة البيانات أبداً.
    expect(items.every((i) => i.passwordCiphertext && !i.passwordCiphertext.includes(SHEET_PASSWORD))).toBe(true);
  });

  // 2 ────────────────────────────────────────────────────────────────────────
  it("2. validation flags invalid rows and in-batch duplicates, then marks the batch READY", async () => {
    const goodEmail = uniqueEmail("val-ok");
    const batch = await newBatch([
      { itemKey: "v1", nameAr: "صالح", email: goodEmail },
      { itemKey: "v2", nameAr: "بريد فاسد", email: "not-an-email" },
      { itemKey: "v3", nameAr: "مكرر", email: goodEmail },
      { itemKey: "v4", nameAr: "" , email: uniqueEmail("v4") }, // missing name
      { itemKey: "v5", nameAr: "بلا كلمة مرور", email: uniqueEmail("v5"), password: "" }, // missing password
    ]);

    const result = await validateImportBatch(orgId, batch!.id);
    expect(result.ok).toBe(true);
    expect(result.valid).toBe(1);
    expect(result.invalid).toBe(3);
    expect(result.duplicates).toBe(1);

    const detail = await getImportBatch(orgId, batch!.id);
    expect(detail!.status).toBe("READY");
    const byKey = Object.fromEntries(detail!.items.map((i) => [i.itemKey, i.status]));
    expect(byKey["v1"]).toBe("VALID");
    expect(byKey["v2"]).toBe("INVALID");
    expect(byKey["v3"]).toBe("DUPLICATE");
    expect(byKey["v4"]).toBe("INVALID");
    expect(byKey["v5"]).toBe("INVALID"); // القائمة الرسمية: كلمة المرور شرط
    expect(await sendCount()).toBe(0);
  });

  // 3 ────────────────────────────────────────────────────────────────────────
  it("3. matching preview links by nationalId", async () => {
    const batch = await newBatch([
      { itemKey: "m1", nameAr: "مطابقة هوية", nationalId: "9000000001", email: uniqueEmail("m1") },
    ]);
    await validateImportBatch(orgId, batch!.id);
    const preview = await previewImportMatching(orgId, batch!.id);
    expect(preview.ok).toBe(true);
    expect(preview.matchedExisting).toBe(1);

    const item = await prisma.importItem.findFirstOrThrow({ where: { batchId: batch!.id } });
    expect(item.status).toBe("MATCHED_EXISTING");
    expect(item.matchedBy).toBe("nationalId");
    expect(item.candidateId).toBe(acctCandidateId);
  });

  // 4 ────────────────────────────────────────────────────────────────────────
  it("4. matching preview links by email", async () => {
    const plain = await prisma.candidate.findUniqueOrThrow({ where: { id: plainCandidateId } });
    const batch = await newBatch([
      { itemKey: "m2", nameAr: "مطابقة بريد", nationalId: "9100000099", email: plain.email },
    ]);
    await validateImportBatch(orgId, batch!.id);
    const preview = await previewImportMatching(orgId, batch!.id);
    expect(preview.matchedExisting).toBe(1);

    const item = await prisma.importItem.findFirstOrThrow({ where: { batchId: batch!.id } });
    expect(item.status).toBe("MATCHED_EXISTING");
    expect(item.matchedBy).toBe("email");
    expect(item.candidateId).toBe(plainCandidateId);
  });

  // 5 ────────────────────────────────────────────────────────────────────────
  it("5. matching preview marks rows with no match as MATCHED_NEW", async () => {
    const batch = await newBatch([
      { itemKey: "m3", nameAr: "شخص جديد", nationalId: "9000000777", email: uniqueEmail("new") },
    ]);
    await validateImportBatch(orgId, batch!.id);
    await previewImportMatching(orgId, batch!.id);

    const item = await prisma.importItem.findFirstOrThrow({ where: { batchId: batch!.id } });
    expect(item.status).toBe("MATCHED_NEW");
    expect(item.matchedBy).toBe("none");
    expect(item.candidateId).toBeNull();
  });

  // 6 ────────────────────────────────────────────────────────────────────────
  it("6. conflicting identifiers produce CONFLICT, never a match", async () => {
    const bEmail = await prisma.candidate.findUniqueOrThrow({ where: { id: conflictBId } });
    const batch = await newBatch([
      { itemKey: "c1", nameAr: "تعارض", nationalId: "9000000003", email: bEmail.email },
    ]);
    await validateImportBatch(orgId, batch!.id);
    await previewImportMatching(orgId, batch!.id);

    const item = await prisma.importItem.findFirstOrThrow({ where: { batchId: batch!.id } });
    expect(item.status).toBe("CONFLICT");
    expect(item.matchedBy).toBe("conflict");
    expect(item.candidateId).toBeNull();
    expect(item.errorMessage).toContain("تعارض");
  });

  // 7 ────────────────────────────────────────────────────────────────────────
  it("7. approval is blocked without a preview and while conflicts are unresolved", async () => {
    const bEmail = await prisma.candidate.findUniqueOrThrow({ where: { id: conflictBId } });
    const batch = await newBatch([
      { itemKey: "a1", nameAr: "قبل المعاينة", nationalId: "9000000003", email: bEmail.email },
    ]);
    await validateImportBatch(orgId, batch!.id);

    // No preview yet → approval refused.
    const early = await approveImportBatch(orgId, batch!.id, "usr_test");
    expect(early.ok).toBe(false);
    expect(early.error).toBe("PREVIEW_REQUIRED");

    // Preview creates the conflict → approval still refused.
    await previewImportMatching(orgId, batch!.id);
    const blocked = await approveImportBatch(orgId, batch!.id, "usr_test");
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toBe("UNRESOLVED_CONFLICTS:1");
  });

  // 8 ────────────────────────────────────────────────────────────────────────
  it("8. approval records actor/time, moves matched items to READY, double-approve rejected", async () => {
    const batch = await newBatch([
      { itemKey: "ap1", nameAr: "معتمد جديد", nationalId: "9000000778", email: uniqueEmail("ap1") },
      { itemKey: "ap2", nameAr: "معتمد موجود", nationalId: "9000000001", email: uniqueEmail("ap2") },
    ]);
    await validateImportBatch(orgId, batch!.id);
    await previewImportMatching(orgId, batch!.id);

    const res = await approveImportBatch(orgId, batch!.id, "usr_approver");
    expect(res.ok).toBe(true);
    expect(res.batch!.status).toBe("APPROVED");
    expect(res.batch!.approvedByUserId).toBe("usr_approver");
    expect(res.batch!.approvedAt).not.toBeNull();

    const items = await prisma.importItem.findMany({ where: { batchId: batch!.id } });
    expect(items.every((i) => i.status === "READY")).toBe(true);

    const again = await approveImportBatch(orgId, batch!.id, "usr_approver");
    expect(again.ok).toBe(false);
    expect(again.error).toBe("BAD_STATE:APPROVED");
  });

  // 9 ────────────────────────────────────────────────────────────────────────
  it("9. execute creates candidates with APPROVED applications, sheet credentials activated, no mail", async () => {
    const emailA = uniqueEmail("exec1");
    const emailB = uniqueEmail("exec2");
    const batch = await newBatch([
      { itemKey: "e1", nameAr: "مستورد أول", nationalId: "9200000001", email: emailA },
      { itemKey: "e2", nameAr: "مستورد ثانٍ", nationalId: "9200000002", email: emailB },
    ]);
    await validateImportBatch(orgId, batch!.id);
    await previewImportMatching(orgId, batch!.id);
    await approveImportBatch(orgId, batch!.id, "usr_test");

    const result = await executeImportBatch(orgId, batch!.id, {});
    expect(result.ok).toBe(true);
    expect(result.done).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.batchStatus).toBe("COMPLETED");

    // New candidates exist, each with an APPROVED application + audit row.
    for (const email of [emailA, emailB]) {
      const cand = await prisma.candidate.findFirstOrThrow({ where: { organizationId: orgId, email } });
      // حساب الدخول من القائمة: بريد الشيت + bcrypt + تفعيل فوري.
      expect(cand.loginEmail).toBe(email);
      expect(cand.passwordHash).toBeTruthy();
      expect(cand.accountActivatedAt).not.toBeNull();
      expect(cand.passwordChangedAt).not.toBeNull();
      expect(cand.failedLoginAttempts).toBe(0);
      expect(cand.lockedUntil).toBeNull();

      const apps = await prisma.application.findMany({ where: { candidateId: cand.id } });
      expect(apps).toHaveLength(1);
      expect(apps[0].status).toBe("APPROVED");
      expect(apps[0].approvedAt).not.toBeNull();
      // تهيئة الرحلة: عملية تهيئة واحدة على الأقل للطلب.
      const onboarding = await prisma.onboardingProcess.count({ where: { applicationId: apps[0].id } });
      expect(onboarding).toBe(1);

      // الدخول الفعلي يعمل بكلمة الشيت كما هي — بلا رمز دعوة.
      const principal = await verifyCandidateCredentials(email, SHEET_PASSWORD);
      expect(principal).not.toBeNull();
      expect(principal!.id).toBe(cand.id);
      // وكلمة خاطئة تُرفض.
      expect(await verifyCandidateCredentials(email, "wrong-password")).toBeNull();
    }
    const audits = await prisma.auditLog.count({
      where: { action: "candidate.import_batch", candidate: { organizationId: orgId } },
    });
    expect(audits).toBeGreaterThanOrEqual(2);

    // The import phase NEVER sends mail.
    expect(await sendCount()).toBe(0);
    const mail = await prisma.emailLog.count({ where: { batchId: batch!.id } });
    expect(mail).toBe(0);
  });

  // 10 ───────────────────────────────────────────────────────────────────────
  it("10. execute applies the sheet credentials to existing candidates without rewriting identity rows", async () => {
    const before = await prisma.candidate.findUniqueOrThrow({ where: { id: acctCandidateId } });
    const appsBefore = await prisma.application.count({ where: { candidateId: acctCandidateId } });
    const sheetEmail = uniqueEmail("link");

    const batch = await newBatch([
      { itemKey: "l1", nameAr: "ربط موجود", nationalId: "9000000001", email: sheetEmail },
    ]);
    await validateImportBatch(orgId, batch!.id);
    await previewImportMatching(orgId, batch!.id);
    await approveImportBatch(orgId, batch!.id, "usr_test");
    const result = await executeImportBatch(orgId, batch!.id, {});
    expect(result.done).toBe(1);

    const item = await prisma.importItem.findFirstOrThrow({ where: { batchId: batch!.id } });
    expect(item.status).toBe("DONE");
    expect(item.candidateId).toBe(acctCandidateId);

    const after = await prisma.candidate.findUniqueOrThrow({ where: { id: acctCandidateId } });
    // هوية المرشح لا تُعاد كتابتها — القائمة تُحدّث الحساب فقط.
    expect(after.nameAr).toBe(before.nameAr);
    expect(after.nationalId).toBe(before.nationalId);
    expect(after.email).toBe(before.email);
    expect(after.jobTitle).toBe(before.jobTitle);
    expect(after.department).toBe(before.department);

    // القائمة هي المصدر الرسمي: بريد الشيت + كلمته + تفعيل فوري.
    expect(after.loginEmail).toBe(sheetEmail);
    expect(after.passwordHash).toBeTruthy();
    expect(after.passwordHash).not.toBe(before.passwordHash);
    expect(after.accountActivatedAt).not.toBeNull();
    expect(after.failedLoginAttempts).toBe(0);
    expect(after.lockedUntil).toBeNull();

    const principal = await verifyCandidateCredentials(sheetEmail, SHEET_PASSWORD);
    expect(principal).not.toBeNull();
    expect(principal!.id).toBe(acctCandidateId);

    // طلب توظيف: يُنشأ فقط إن لم يكن للمرشح أي طلب (قرارات الموارد البشرية لا تُعاد كتابتها).
    const appsAfter = await prisma.application.count({ where: { candidateId: acctCandidateId } });
    expect(appsAfter).toBe(appsBefore === 0 ? 1 : appsBefore);
    // ولا يُرسَل أي بريد.
    expect(await sendCount()).toBe(0);
    expect(await prisma.emailLog.count({ where: { batchId: batch!.id } })).toBe(0);
  });

  // 11 ───────────────────────────────────────────────────────────────────────
  it("11. terminal resultSummary is frozen once, holds no credentials, and blocks re-execution", async () => {
    const batch = await newBatch([
      { itemKey: "f1", nameAr: "تجميد", nationalId: "9200000003", email: uniqueEmail("frozen") },
    ]);
    await validateImportBatch(orgId, batch!.id);
    await previewImportMatching(orgId, batch!.id);
    await approveImportBatch(orgId, batch!.id, "usr_test");
    await executeImportBatch(orgId, batch!.id, {});

    const detail = await getImportBatch(orgId, batch!.id);
    expect(detail!.status).toBe("COMPLETED");
    expect(detail!.resultSummary).toBeTruthy();
    const json = JSON.stringify(detail!.resultSummary);
    expect(json).toContain("frozenAt");
    expect(json).not.toMatch(/password|hash|secret|credential/i);

    const frozen = json;
    // Terminal batches are frozen: execution cannot run again…
    const rerun = await executeImportBatch(orgId, batch!.id, {});
    expect(rerun.ok).toBe(false);
    expect(rerun.error).toBe("BAD_STATE:COMPLETED");
    // …and the summary did not change.
    const detail2 = await getImportBatch(orgId, batch!.id);
    expect(JSON.stringify(detail2!.resultSummary)).toBe(frozen);
  });

  // 12 ───────────────────────────────────────────────────────────────────────
  it("12. claim/lease CAS: only one worker wins; an expired lease is reclaimable", async () => {
    const batch = await newBatch([
      { itemKey: "cl1", nameAr: "ادّعاء", nationalId: "9000000779", email: uniqueEmail("claim") },
    ]);
    await validateImportBatch(orgId, batch!.id);
    await previewImportMatching(orgId, batch!.id);
    await approveImportBatch(orgId, batch!.id, "usr_test");

    const first = await claimImportItem(batch!.id);
    expect(first).not.toBeNull();
    expect(first!.status).toBe("EXECUTING");
    expect(first!.claimToken).toBeTruthy();

    // Second worker: nothing left to claim (CAS failed).
    const second = await claimImportItem(batch!.id);
    expect(second).toBeNull();

    // Simulate a crashed worker: lease expires → reclaim allowed.
    await prisma.importItem.update({
      where: { id: first!.id },
      data: { leaseExpiresAt: new Date(Date.now() - 1000) },
    });
    const reclaimed = await claimImportItem(batch!.id);
    expect(reclaimed).not.toBeNull();
    expect(reclaimed!.claimToken).not.toBe(first!.claimToken);

    // A wrong token can never finish or release the item.
    const badFinish = await prisma.importItem.updateMany({
      where: { id: first!.id, claimToken: "wrong-token", status: "EXECUTING" },
      data: { status: "DONE" },
    });
    expect(badFinish.count).toBe(0);

    await releaseImportItem(first!.id, reclaimed!.claimToken!);
    const afterRelease = await prisma.importItem.findUniqueOrThrow({ where: { id: first!.id } });
    expect(afterRelease.status).toBe("READY");
    expect(afterRelease.claimToken).toBeNull();
  });

  // 13 ───────────────────────────────────────────────────────────────────────
  it("13. existing-account dispatch sends the password-free notice and never touches credentials", async () => {
    const batch = await newBatch([
      { itemKey: "n1", nameAr: "إشعار حساب", nationalId: "9000000001", email: uniqueEmail("notice") },
    ]);
    await validateImportBatch(orgId, batch!.id);
    await previewImportMatching(orgId, batch!.id);
    await approveImportBatch(orgId, batch!.id, "usr_test");
    await executeImportBatch(orgId, batch!.id, {});

    // لقطة بعد تنفيذ الاستيراد (الحساب مطبَّق عليه الشيت) — الإشعار لا يمسّه.
    const before = await prisma.candidate.findUniqueOrThrow({ where: { id: acctCandidateId } });

    const res = await dispatchBatchInvitations(orgId, batch!.id, { minGapMs: 0 });
    expect(res.ok).toBe(true);
    expect(res.byOutcome["SENT_NOTICE"]).toBe(1);

    expect(await waitFor(async () => {
      const row = await prisma.emailLog.findFirst({ where: { importItemId: res.results[0].itemId } });
      return row?.status === "SENT";
    })).toBe(true);

    expect(await sendCount()).toBe(1);
    const msg = mocks.send.mock.calls[0][0] as { subject: string; html: string; text?: string };
    expect(msg.subject).toBe("بيانات الدخول إلى حسابك – منصة نزاهة");
    // The HTML link is rewritten to a tracking URL; the plain-text variant
    // keeps the real login page.
    expect(msg.text ?? "").toContain("/auth/candidate");
    // Password-free: the credentials template's password block is absent.
    expect(msg.html).not.toContain("كلمة المرور المؤقتة");
    expect(msg.text ?? "").not.toContain("كلمة المرور المؤقتة");

    // Credential fields are byte-identical after the send.
    const after = await prisma.candidate.findUniqueOrThrow({ where: { id: acctCandidateId } });
    expect(after.passwordHash).toBe(before.passwordHash);
    expect(after.passwordChangedAt?.getTime()).toBe(before.passwordChangedAt?.getTime());
    expect(after.accountActivatedAt?.getTime()).toBe(before.accountActivatedAt?.getTime());
    expect(after.lastLoginAt?.getTime()).toBe(before.lastLoginAt?.getTime());
    expect(after.loginEmail).toBe(before.loginEmail);
  });

  // 14 ───────────────────────────────────────────────────────────────────────
  it("14. no-account candidates are skipped unless provisioning is explicitly opted in", async () => {
    const plain = await prisma.candidate.findUniqueOrThrow({ where: { id: plainCandidateId } });

    const batch = await newBatch([
      { itemKey: "p1", nameAr: "بلا حساب", nationalId: "9100000099", email: plain.email },
    ]);
    await validateImportBatch(orgId, batch!.id);
    await previewImportMatching(orgId, batch!.id);
    await approveImportBatch(orgId, batch!.id, "usr_test");
    await executeImportBatch(orgId, batch!.id, {});

    // محاكاة مرشح بلا حساب (سجلات قديمة سابقة للقائمة): نُفرّغ بيانات الحساب.
    await prisma.candidate.update({
      where: { id: plainCandidateId },
      data: { loginEmail: null, passwordHash: null, accountActivatedAt: null, passwordChangedAt: null },
    });
    const legacy = await prisma.candidate.findUniqueOrThrow({ where: { id: plainCandidateId } });
    expect(legacy.passwordHash).toBeNull();

    // No opt-in → skip: no account, no mail.
    const skipped = await dispatchBatchInvitations(orgId, batch!.id, { minGapMs: 0 });
    expect(skipped.byOutcome["SKIPPED_NO_ACCOUNT"]).toBe(1);
    expect(await sendCount()).toBe(0);
    const mid = await prisma.candidate.findUniqueOrThrow({ where: { id: plainCandidateId } });
    expect(mid.passwordHash).toBeNull();

    // Explicit opt-in → provisioning path runs once.
    const provisioned = await dispatchBatchInvitations(orgId, batch!.id, {
      provisionNewAccounts: true,
      minGapMs: 0,
    });
    expect(provisioned.byOutcome["SENT_PROVISION"]).toBe(1);
    expect(await sendCount()).toBe(1);
    const end = await prisma.candidate.findUniqueOrThrow({ where: { id: plainCandidateId } });
    expect(end.passwordHash).toBeTruthy();
    expect(end.passwordChangedAt).not.toBeNull();
    expect(end.invitationSent).toBe(true);
  });

  // 15 ───────────────────────────────────────────────────────────────────────
  it("15. crash-window attempt stays UNKNOWN: never auto-resent; manual reconcile unlocks attempt 2", async () => {
    const batch = await newBatch([
      { itemKey: "u1", nameAr: "نافذة تعطل", nationalId: "9000000005", email: uniqueEmail("crash") },
    ]);
    await validateImportBatch(orgId, batch!.id);
    await previewImportMatching(orgId, batch!.id);
    await approveImportBatch(orgId, batch!.id, "usr_test");
    await executeImportBatch(orgId, batch!.id, {});

    const item = await prisma.importItem.findFirstOrThrow({ where: { batchId: batch!.id } });

    // Simulate the crash window: sendStartedAt stamped, outcome never recorded.
    await prisma.emailLog.create({
      data: {
        organizationId: orgId,
        importItemId: item.id,
        batchId: batch!.id,
        idempotencyKey: `invite:${item.id}:1`,
        sendStartedAt: new Date(),
        fromAddress: "test@local",
        toAddress: "crash@test.local",
        subject: "دعوة",
        status: "QUEUED",
      },
    });

    // Dispatch must NOT resend.
    const first = await dispatchBatchInvitations(orgId, batch!.id, { minGapMs: 0 });
    expect(first.byOutcome["BLOCKED_UNKNOWN"]).toBe(1);
    expect(await sendCount()).toBe(0);

    // It shows up in the manual reconciliation list.
    const unknown = await listUnknownAttempts(orgId, batch!.id);
    expect(unknown).toHaveLength(1);
    expect(unknown[0].itemKey).toBe("u1");

    // Operator confirms it never left → the row becomes retryable.
    const reconciled = await reconcileUnknownAttempt(orgId, unknown[0].id, "NOT_SENT", "فحص يدوي");
    expect(reconciled).toBe(true);
    expect(await listUnknownAttempts(orgId, batch!.id)).toHaveLength(0);

    // Next dispatch retries as attempt 2 with a NEW idempotency key.
    const second = await dispatchBatchInvitations(orgId, batch!.id, { minGapMs: 0 });
    expect(second.byOutcome["SENT_NOTICE"]).toBe(1);
    expect(await sendCount()).toBe(1);
    const row2 = await prisma.emailLog.findFirst({
      where: { importItemId: item.id, idempotencyKey: `invite:${item.id}:2` },
    });
    expect(row2).not.toBeNull();
  });

  // 16 ───────────────────────────────────────────────────────────────────────
  it("16. idempotency: a completed attempt is never resent and duplicate keys are DB-rejected", async () => {
    const batch = await newBatch([
      { itemKey: "i1", nameAr: "تكرار", nationalId: "9000000006", email: uniqueEmail("idem") },
    ]);
    await validateImportBatch(orgId, batch!.id);
    await previewImportMatching(orgId, batch!.id);
    await approveImportBatch(orgId, batch!.id, "usr_test");
    await executeImportBatch(orgId, batch!.id, {});

    const first = await dispatchBatchInvitations(orgId, batch!.id, { minGapMs: 0 });
    expect(first.byOutcome["SENT_NOTICE"]).toBe(1);
    expect(await waitFor(async () => {
      const row = await prisma.emailLog.findFirst({ where: { batchId: batch!.id } });
      return row?.status === "SENT";
    })).toBe(true);
    expect(await sendCount()).toBe(1);

    // Re-dispatch: already sent → no second mail.
    const again = await dispatchBatchInvitations(orgId, batch!.id, { minGapMs: 0 });
    expect(again.byOutcome["ALREADY_SENT"]).toBe(1);
    expect(await sendCount()).toBe(1);

    // The unique index itself rejects a replayed attempt insert.
    const item = await prisma.importItem.findFirstOrThrow({ where: { batchId: batch!.id } });
    const dup = prisma.emailLog.create({
      data: {
        organizationId: orgId,
        importItemId: item.id,
        idempotencyKey: `invite:${item.id}:1`,
        fromAddress: "test@local",
        toAddress: "dup@test.local",
        subject: "تكرار",
        status: "QUEUED",
      },
    });
    await expect(dup).rejects.toMatchObject({ code: "P2002" });
  });

  // 17 ───────────────────────────────────────────────────────────────────────
  it("17. tenant scoping is enforced server-side and every new route guards with requireHR", async () => {
    const someBatch = await prisma.importBatch.findFirstOrThrow({ where: { organizationId: orgId } });

    // Cross-org reads return nothing — scoping is in the service, not the UI.
    expect(await getImportBatch(otherOrgId, someBatch.id)).toBeNull();
    expect(await listImportBatches(otherOrgId)).toHaveLength(0);
    expect(await listUnknownAttempts(otherOrgId)).toHaveLength(0);

    const unknown = await listUnknownAttempts(orgId);
    if (unknown.length > 0) {
      const foreign = await reconcileUnknownAttempt(otherOrgId, unknown[0].id, "SENT");
      expect(foreign).toBe(false);
    }

    // Every route file under /api/hr/import-batches enforces an HR session…
    const root = join(import.meta.dirname, "..", "src", "app", "api", "hr", "import-batches");
    const routeFiles: string[] = [];
    (function walk(dir: string) {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (name === "route.ts") routeFiles.push(p);
      }
    })(root);
    expect(routeFiles.length).toBeGreaterThanOrEqual(11);

    const unguarded = routeFiles
      .filter((f) => !/requireHR\(/.test(readFileSync(f, "utf8")))
      .map((f) => relative(root, f));
    expect(unguarded).toEqual([]);

    // …and the privileged actions restrict to admin/hr_manager (not officers).
    for (const name of ["approve", "execute", "dispatch", "cancel", "archive"]) {
      const src = readFileSync(join(root, "[id]", name, "route.ts"), "utf8");
      expect(src, `${name} must require admin/hr_manager`).toContain('roles: ["admin", "hr_manager"]');
    }
    const unknownSrc = readFileSync(join(root, "unknown", "route.ts"), "utf8");
    expect(unknownSrc).toContain("requireHR(");
    expect(unknownSrc).toContain('roles: ["admin", "hr_manager"]');
  });
});
