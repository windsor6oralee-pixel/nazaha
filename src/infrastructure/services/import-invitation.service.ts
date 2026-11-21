/**
 * Import invitation dispatch — sends the invitation/notice e-mails for an
 * import batch AFTER execution, as a SEPARATE phase from the import itself.
 *
 * Hard rules enforced here (verified by tests):
 *   - Upload / validate / preview / approve / execute NEVER send e-mail.
 *   - An item whose candidate already has an account goes through
 *     notifyExistingAccount() ONLY — sendInvitation() would rotate the
 *     password, which is forbidden for existing accounts.
 *   - An item whose candidate has NO account is only provisioned when the
 *     caller explicitly opts in (provisionNewAccounts). Otherwise it is
 *     reported as SKIPPED_NO_ACCOUNT.
 *   - Every attempt carries idempotencyKey "invite:<itemId>:<n>" — the unique
 *     index rejects a double insert of the same attempt.
 *   - UNKNOWN is never auto-resent:
 *       * attempt row with sendStartedAt set but no recorded outcome
 *         (crash window)          → BLOCKED_UNKNOWN
 *       * attempt row status UNKNOWN → BLOCKED_UNKNOWN
 *     Both go to listUnknownAttempts() for MANUAL reconciliation.
 *   - FAILED (explicit transport error recorded) and QUEUED-before-transport
 *     (sendStartedAt null ⇒ provably unsent) MAY be retried — each retry is a
 *     NEW attempt number.
 *   - A per-item claim (claimToken CAS on the terminal DONE row) prevents two
 *     concurrent dispatchers from sending the same item twice.
 *   - No password, hash or secret is written to EmailLog / AuditLog / results.
 */
import { prisma } from "@/infrastructure/database/client";
import { runPaced } from "@/infrastructure/notifications/paced-runner";
import {
  accountExists,
  notifyExistingAccount,
  sendInvitation,
  InvitationError,
} from "./invitation.service";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DispatchOutcome =
  | "SENT_NOTICE"        // existing account → password-free notice
  | "SENT_PROVISION"     // no account + explicit opt-in → credentials e-mail
  | "ALREADY_SENT"       // a previous attempt reached SENT/DELIVERED
  | "BLOCKED_UNKNOWN"    // crash window / UNKNOWN → manual reconciliation
  | "BLOCKED_BOUNCED"    // earlier attempt bounced → no auto-resend
  | "SKIPPED_NO_ACCOUNT" // no account and provisioning not opted in
  | "NO_CANDIDATE"       // item has no linked candidate
  | "FAILED";            // attempt recorded FAILED (retryable next run)

export interface DispatchItemResult {
  itemId: string;
  itemKey: string;
  candidateId: string | null;
  outcome: DispatchOutcome;
  attempt: number;
  error?: string;
}

export interface DispatchResult {
  ok: boolean;
  batchId: string;
  processed: number;
  byOutcome: Record<string, number>;
  unknown: DispatchItemResult[];
  results: DispatchItemResult[];
  error?: string;
}

// ─── Attempt history helpers ─────────────────────────────────────────────────

interface AttemptRow {
  id: string;
  status: string;
  sendStartedAt: Date | null;
  idempotencyKey: string | null;
  createdAt: Date;
}

/**
 * Classifies the LATEST attempt for an item:
 *   SENT      → already delivered/accepted; skip
 *   BOUNCED   → bounced; never auto-resend
 *   UNKNOWN   → crash window (sendStartedAt set, outcome unrecorded) or an
 *               explicit UNKNOWN row → manual reconciliation, never auto-resent
 *   RETRY     → provably unsent (no attempt, or FAILED, or QUEUED with
 *               sendStartedAt null) → a new attempt may be made
 */
function classifyLatest(rows: AttemptRow[]): { state: "SENT" | "BOUNCED" | "UNKNOWN" | "RETRY"; attempt: number } {
  if (!rows.length) return { state: "RETRY", attempt: 0 };
  const latest = rows[0];
  const attempt = rows.reduce((max, r) => {
    const m = r.idempotencyKey?.match(/:(\d+)$/);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);

  if (latest.status === "SENT" || latest.status === "DELIVERED") return { state: "SENT", attempt };
  if (latest.status === "BOUNCED") return { state: "BOUNCED", attempt };
  if (latest.status === "UNKNOWN") return { state: "UNKNOWN", attempt };
  if (latest.status === "QUEUED" && latest.sendStartedAt) return { state: "UNKNOWN", attempt };
  return { state: "RETRY", attempt };
}

async function attemptsForItem(importItemId: string): Promise<AttemptRow[]> {
  return prisma.emailLog.findMany({
    where: { importItemId },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, sendStartedAt: true, idempotencyKey: true, createdAt: true },
  });
}

// ─── Claim helpers (dispatch uses the same claim/lease CAS as execution) ────

async function claimForDispatch(itemId: string, leaseMs = 120_000): Promise<string | null> {
  const token = `disp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const now = new Date();
  const res = await prisma.importItem.updateMany({
    where: {
      id: itemId,
      status: "DONE",
      claimToken: null,
      OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: now } }],
    },
    data: { claimToken: token, claimedAt: now, leaseExpiresAt: new Date(now.getTime() + leaseMs) },
  });
  return res.count === 1 ? token : null;
}

async function releaseClaim(itemId: string, token: string): Promise<void> {
  await prisma.importItem.updateMany({
    where: { id: itemId, claimToken: token },
    data: { claimToken: null, claimedAt: null, leaseExpiresAt: null },
  });
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

export interface DispatchOptions {
  /** Explicit opt-in: create+mail credentials for candidates with NO account. */
  provisionNewAccounts?: boolean;
  loginUrl?: string;
  sentByUserId?: string;
  concurrency?: number;
  minGapMs?: number;
}

interface DispatchableItem {
  id: string;
  itemKey: string;
  candidateId: string | null;
}

/**
 * Sends invitations/notices for every executable item of a batch.
 *
 * Gating: the batch must be in a terminal execution state (COMPLETED / PARTIAL
 * / ARCHIVED) — the import data plane must be finished before any mail moves.
 * Items not yet DONE (or without a linked candidate) are reported, not touched.
 */
export async function dispatchBatchInvitations(
  organizationId: string,
  batchId: string,
  opts: DispatchOptions = {},
): Promise<DispatchResult> {
  const batch = await prisma.importBatch.findFirst({
    where: { id: batchId, organizationId },
    select: { id: true, status: true },
  });
  if (!batch) {
    return { ok: false, batchId, processed: 0, byOutcome: {}, unknown: [], results: [], error: "NOT_FOUND" };
  }
  const terminal = ["COMPLETED", "PARTIAL", "ARCHIVED"];
  if (!terminal.includes(batch.status)) {
    return {
      ok: false, batchId, processed: 0, byOutcome: {}, unknown: [], results: [],
      error: `BAD_STATE:${batch.status}`,
    };
  }

  const items = await prisma.importItem.findMany({
    where: { batchId, status: "DONE" },
    orderBy: { createdAt: "asc" },
    select: { id: true, itemKey: true, candidateId: true },
  });

  const results: DispatchItemResult[] = [];

  async function dispatchOne(item: DispatchableItem): Promise<DispatchItemResult> {
    if (!item.candidateId) {
      return { itemId: item.id, itemKey: item.itemKey, candidateId: null, outcome: "NO_CANDIDATE", attempt: 0 };
    }

    // Mutual exclusion: only one dispatcher may work an item at a time.
    const claim = await claimForDispatch(item.id);
    if (!claim) {
      return {
        itemId: item.id, itemKey: item.itemKey, candidateId: item.candidateId,
        outcome: "FAILED", attempt: 0, error: "CLAIMED_BY_ANOTHER_WORKER",
      };
    }

    try {
      const attempts = await attemptsForItem(item.id);
      const cls = classifyLatest(attempts);

      if (cls.state === "SENT") {
        return { itemId: item.id, itemKey: item.itemKey, candidateId: item.candidateId, outcome: "ALREADY_SENT", attempt: cls.attempt };
      }
      if (cls.state === "BOUNCED") {
        return { itemId: item.id, itemKey: item.itemKey, candidateId: item.candidateId, outcome: "BLOCKED_BOUNCED", attempt: cls.attempt };
      }
      if (cls.state === "UNKNOWN") {
        return { itemId: item.id, itemKey: item.itemKey, candidateId: item.candidateId, outcome: "BLOCKED_UNKNOWN", attempt: cls.attempt };
      }

      const attempt = cls.attempt + 1;
      const idempotencyKey = `invite:${item.id}:${attempt}`;

      const candidate = await prisma.candidate.findUnique({
        where: { id: item.candidateId },
        select: {
          id: true,
          passwordHash: true,
          accountActivatedAt: true,
          passwordChangedAt: true,
          lastLoginAt: true,
        },
      });
      if (!candidate) {
        return { itemId: item.id, itemKey: item.itemKey, candidateId: item.candidateId, outcome: "NO_CANDIDATE", attempt };
      }

      const hasAccount = accountExists(candidate);

      if (hasAccount) {
        // EXISTING account → notice path only. sendInvitation() is forbidden
        // here: it rotates the password on every call.
        try {
          await notifyExistingAccount(item.candidateId, {
            loginUrl: opts.loginUrl,
            batchId,
            importItemId: item.id,
            idempotencyKey,
            sentByUserId: opts.sentByUserId,
          });
          return { itemId: item.id, itemKey: item.itemKey, candidateId: item.candidateId, outcome: "SENT_NOTICE", attempt };
        } catch (e) {
          const msg = e instanceof InvitationError ? `${e.code}: ${e.message}` : e instanceof Error ? e.message : String(e);
          return { itemId: item.id, itemKey: item.itemKey, candidateId: item.candidateId, outcome: "FAILED", attempt, error: msg };
        }
      }

      // NO account yet.
      if (!opts.provisionNewAccounts) {
        return { itemId: item.id, itemKey: item.itemKey, candidateId: item.candidateId, outcome: "SKIPPED_NO_ACCOUNT", attempt };
      }

      try {
        await sendInvitation(item.candidateId, {
          loginUrl: opts.loginUrl,
          batchId,
          importItemId: item.id,
          idempotencyKey,
          sentByUserId: opts.sentByUserId,
        });
        return { itemId: item.id, itemKey: item.itemKey, candidateId: item.candidateId, outcome: "SENT_PROVISION", attempt };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { itemId: item.id, itemKey: item.itemKey, candidateId: item.candidateId, outcome: "FAILED", attempt, error: msg };
      }
    } finally {
      await releaseClaim(item.id, claim);
    }
  }

  // runPaced returns the INPUT items, not the worker's return value — collect
  // outcomes inside the worker (pacing still comes from runPaced).
  await runPaced(
    items,
    async (item): Promise<void> => {
      results.push(await dispatchOne(item));
    },
    { concurrency: opts.concurrency ?? 2, minGapMs: opts.minGapMs ?? 350 },
  );

  const byOutcome: Record<string, number> = {};
  for (const r of results) byOutcome[r.outcome] = (byOutcome[r.outcome] ?? 0) + 1;

  const unknown = results.filter((r) => r.outcome === "BLOCKED_UNKNOWN");

  return { ok: true, batchId, processed: results.length, byOutcome, unknown, results };
}

// ─── Manual reconciliation of UNKNOWN attempts ───────────────────────────────

export interface UnknownAttemptRow {
  id: string;
  batchId: string | null;
  importItemId: string | null;
  itemKey: string | null;
  toAddress: string;
  subject: string;
  status: string;
  sendStartedAt: Date | null;
  createdAt: Date;
}

/**
 * Every attempt whose outcome is uncertain — crash window (sendStartedAt set,
 * no recorded outcome) or an explicit UNKNOWN row. These are NEVER resent
 * automatically; an operator reconciles each one manually.
 */
export async function listUnknownAttempts(
  organizationId: string,
  batchId?: string,
): Promise<UnknownAttemptRow[]> {
  const rows = await prisma.emailLog.findMany({
    where: {
      organizationId,
      ...(batchId ? { batchId } : {}),
      OR: [
        { status: "UNKNOWN" },
        { status: "QUEUED", sendStartedAt: { not: null } },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      batchId: true,
      importItemId: true,
      toAddress: true,
      subject: true,
      status: true,
      sendStartedAt: true,
      createdAt: true,
      importItem: { select: { itemKey: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    batchId: r.batchId,
    importItemId: r.importItemId,
    itemKey: r.importItem?.itemKey ?? null,
    toAddress: r.toAddress,
    subject: r.subject,
    status: r.status,
    sendStartedAt: r.sendStartedAt,
    createdAt: r.createdAt,
  }));
}

/**
 * Operator resolution of one UNKNOWN attempt:
 *   - "SENT"      → the operator confirmed the mail went out (e.g. checked the
 *                   provider console) → recorded as SENT; no resend happens.
 *   - "NOT_SENT"  → confirmed it never left → row becomes FAILED with an
 *                   explicit reconciliation note, which unlocks a NEW attempt
 *                   on the next dispatch run (new idempotency key).
 *
 * Returns false when the row is not in an UNKNOWN state (nothing to do).
 */
export async function reconcileUnknownAttempt(
  organizationId: string,
  emailLogId: string,
  resolution: "SENT" | "NOT_SENT",
  note?: string,
): Promise<boolean> {
  const row = await prisma.emailLog.findFirst({
    where: {
      id: emailLogId,
      organizationId,
      OR: [
        { status: "UNKNOWN" },
        { status: "QUEUED", sendStartedAt: { not: null } },
      ],
    },
    select: { id: true },
  });
  if (!row) return false;

  if (resolution === "SENT") {
    await prisma.emailLog.updateMany({
      where: { id: emailLogId, status: { in: ["UNKNOWN", "QUEUED"] } },
      data: { status: "SENT" },
    });
  } else {
    await prisma.emailLog.updateMany({
      where: { id: emailLogId, status: { in: ["UNKNOWN", "QUEUED"] } },
      data: { status: "FAILED", errorMessage: `reconciled: not sent${note ? ` — ${note}` : ""}` },
    });
  }
  return true;
}
