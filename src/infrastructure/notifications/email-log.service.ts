/**
 * EmailLog — single source of truth for "what did the platform send?"
 *
 * Called by the invitation / directive / review services (and the pool adapter)
 * right after a transport call. Keeps a row per attempt, so operators can audit
 * delivery without digging through SMTP server logs. Candidate linking is best
 * effort: we match by recipient address against the org's candidates — unmatched
 * rows are kept so queue health stays visible even when the audience is HR.
 */
import { prisma } from "../database/client";

export type EmailStatusCode = "QUEUED" | "SENT" | "FAILED" | "BOUNCED" | "DELIVERED" | "UNKNOWN";

export interface LogEmailInput {
  organizationId: string;
  fromAddress: string;
  toAddress: string;
  subject: string;
  bodyHtml?: string | null;
  providerMessageId?: string | null;
  provider?: string | null;
  status: EmailStatusCode;
  errorMessage?: string | null;
  sentByUserId?: string | null;
  candidateId?: string | null;
  applicationId?: string | null;
  /** ADDITIVE (ImportBatch phase): batch / item linkage. null for all legacy rows. */
  batchId?: string | null;
  importItemId?: string | null;
  /** ADDITIVE: stable idempotency key for this logical attempt (unique index). */
  idempotencyKey?: string | null;
}

function preview(html: string | null | undefined): string | null {
  if (!html) return null;
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > 500 ? text.slice(0, 497) + "…" : text;
}

/** Resolves candidate+application by lowercased recipient within this org. */
async function matchCandidate(organizationId: string, toAddress: string): Promise<{ candidateId: string; applicationId: string | null } | null> {
  const email = toAddress.trim().toLowerCase();
  if (!email) return null;
  const c = await prisma.candidate.findFirst({
    where: { organizationId, OR: [{ email }, { loginEmail: email }] },
    select: {
      id: true,
      applications: { select: { id: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!c) return null;
  return { candidateId: c.id, applicationId: c.applications[0]?.id ?? null };
}

/**
 * Creates a PENDING log row BEFORE the mail is sent. Returns the id so the
 * caller can inject a tracking pixel (`/api/emails/track/<id>/open.gif`) into
 * the HTML, then flip the row to SENT/FAILED via markLogStatus() afterwards.
 */
export async function createPendingLog(input: Omit<LogEmailInput, "status"> & { status?: EmailStatusCode }): Promise<string> {
  let candidateId   = input.candidateId   ?? null;
  let applicationId = input.applicationId ?? null;
  if (!candidateId) {
    const match = await matchCandidate(input.organizationId, input.toAddress).catch(() => null);
    if (match) { candidateId = match.candidateId; applicationId = match.applicationId; }
  }
  const row = await prisma.emailLog.create({
    data: {
      organizationId:    input.organizationId,
      candidateId,
      applicationId,
      batchId:           input.batchId ?? null,
      importItemId:      input.importItemId ?? null,
      idempotencyKey:    input.idempotencyKey ?? null,
      sentByUserId:      input.sentByUserId ?? null,
      fromAddress:       input.fromAddress,
      toAddress:         input.toAddress.trim().toLowerCase(),
      subject:           input.subject,
      bodyPreview:       preview(input.bodyHtml),
      bodyFull:          input.bodyHtml ?? null,
      provider:          input.provider ?? null,
      status:            input.status ?? "QUEUED",
    },
    select: { id: true },
  });
  return row.id;
}

/**
 * ADDITIVE: stamps the crash-window marker immediately BEFORE the message is
 * handed to the transport. Once set, an interrupted run can no longer claim
 * "the mail was never sent" — the row becomes UNKNOWN until reconciled.
 * No-op for legacy rows that have no idempotency key.
 */
export async function markSendStarted(id: string): Promise<void> {
  await prisma.emailLog.updateMany({
    where: { id, sendStartedAt: null },
    data: { sendStartedAt: new Date() },
  });
}

export async function markLogStatus(id: string, status: EmailStatusCode, extra: {
  providerMessageId?: string | null;
  errorMessage?: string | null;
} = {}): Promise<void> {
  const now = new Date();
  await prisma.emailLog.update({
    where: { id },
    data: {
      status,
      providerMessageId: extra.providerMessageId ?? undefined,
      errorMessage:      extra.errorMessage      ?? undefined,
      sentAt:            status === "SENT" || status === "DELIVERED" ? now : undefined,
      deliveredAt:       status === "DELIVERED" ? now : undefined,
    },
  });
}

/** Tracking-pixel hit — idempotent on firstOpenedAt, cumulative on openCount. */
export async function recordOpen(id: string): Promise<void> {
  const now = new Date();
  // Prisma can't express "set if null" in one call — read-then-update is fine
  // under the single-row write load this endpoint sees.
  const existing = await prisma.emailLog.findUnique({ where: { id }, select: { firstOpenedAt: true, status: true } });
  if (!existing) return;
  await prisma.emailLog.update({
    where: { id },
    data: {
      firstOpenedAt: existing.firstOpenedAt ?? now,
      lastOpenedAt:  now,
      openCount:     { increment: 1 },
      // First open is also our proxy for delivery — the mail reached a client that
      // loaded images. Don't downgrade a BOUNCED/FAILED row, only promote QUEUED/SENT.
      status: existing.status === "QUEUED" || existing.status === "SENT" ? "DELIVERED" : undefined,
      deliveredAt: existing.firstOpenedAt ? undefined : now,
    },
  });
}

/** Injects a 1×1 tracking pixel referencing the given log id right before </body>. */
export function injectTrackingPixel(html: string, id: string, baseUrl: string): string {
  const url = `${baseUrl.replace(/\/$/, "")}/api/emails/track/${id}/open.gif`;
  const pixel = `<img src="${url}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;border:0;" />`;
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${pixel}</body>`);
  }
  return html + pixel;
}

/**
 * Rewrites every `<a href="...">` pointing to our own baseUrl so clicks go
 * through a tracked redirect first. Only our own domain is rewritten — external
 * links (unsubscribe, help) stay intact.
 */
export function rewriteTrackedLinks(html: string, id: string, baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  // Match ONLY absolute hrefs that start with our base URL. Avoid rewriting
  // relative links, mailto:, tel:, or external domains.
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(<a\\b[^>]*\\shref=")(${escaped}[^"]*)(")`, "gi");
  return html.replace(re, (_m, pre, orig, post) => {
    const tracked = `${base}/api/emails/track/${id}/click?to=${encodeURIComponent(orig)}`;
    return `${pre}${tracked}${post}`;
  });
}

/** Convenience — both open pixel + tracked links in one call. */
export function injectEmailTracking(html: string, id: string, baseUrl: string): string {
  return injectTrackingPixel(rewriteTrackedLinks(html, id, baseUrl), id, baseUrl);
}

/** Click endpoint — stamps firstClickedAt once, cumulative on clickCount. */
export async function recordClick(id: string): Promise<void> {
  const now = new Date();
  const existing = await prisma.emailLog.findUnique({ where: { id }, select: { firstClickedAt: true, firstOpenedAt: true, status: true } });
  if (!existing) return;
  await prisma.emailLog.update({
    where: { id },
    data: {
      firstClickedAt: existing.firstClickedAt ?? now,
      lastClickedAt:  now,
      clickCount:     { increment: 1 },
      // A click proves delivery too — promote QUEUED/SENT rows.
      status: existing.status === "QUEUED" || existing.status === "SENT" ? "DELIVERED" : undefined,
      deliveredAt: existing.firstOpenedAt || existing.firstClickedAt ? undefined : now,
      // Also mark opened — a click implies the mail was rendered.
      firstOpenedAt: existing.firstOpenedAt ?? now,
      lastOpenedAt:  now,
    },
  });
}

export async function logEmail(input: LogEmailInput): Promise<void> {
  // Candidate linkage is best-effort — never block a log write on a failed lookup.
  let candidateId   = input.candidateId   ?? null;
  let applicationId = input.applicationId ?? null;
  if (!candidateId) {
    const match = await matchCandidate(input.organizationId, input.toAddress).catch(() => null);
    if (match) { candidateId = match.candidateId; applicationId = match.applicationId; }
  }

  const now = new Date();
  await prisma.emailLog.create({
    data: {
      organizationId:    input.organizationId,
      candidateId,
      applicationId,
      sentByUserId:      input.sentByUserId ?? null,
      fromAddress:       input.fromAddress,
      toAddress:         input.toAddress.trim().toLowerCase(),
      subject:           input.subject,
      bodyPreview:       preview(input.bodyHtml),
      bodyFull:          input.bodyHtml ?? null,
      providerMessageId: input.providerMessageId ?? null,
      provider:          input.provider ?? null,
      status:            input.status,
      errorMessage:      input.errorMessage ?? null,
      sentAt:            input.status === "SENT" || input.status === "DELIVERED" ? now : null,
      deliveredAt:       input.status === "DELIVERED" ? now : null,
    },
  });
}

export interface EmailLogRow {
  id: string;
  subject: string;
  fromAddress: string;
  toAddress: string;
  status: EmailStatusCode;
  provider: string | null;
  providerMessageId: string | null;
  errorMessage: string | null;
  bodyPreview: string | null;
  sentAt: Date | null;
  firstOpenedAt: Date | null;
  openCount: number;
  firstClickedAt: Date | null;
  clickCount: number;
  createdAt: Date;
}

export async function listEmailsForCandidate(candidateId: string, limit = 50): Promise<EmailLogRow[]> {
  const rows = await prisma.emailLog.findMany({
    where: { candidateId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true, subject: true, fromAddress: true, toAddress: true,
      status: true, provider: true, providerMessageId: true,
      errorMessage: true, bodyPreview: true, sentAt: true, createdAt: true,
      firstOpenedAt: true, openCount: true, firstClickedAt: true, clickCount: true,
    },
  });
  return rows as EmailLogRow[];
}

export interface EmailLogListFilter {
  search?: string;        // searches subject + toAddress
  status?: EmailStatusCode;
  from?: Date;
  to?: Date;
  limit?: number;
  cursor?: string;
}

export async function listEmailsForOrg(organizationId: string, filter: EmailLogListFilter = {}): Promise<{ rows: EmailLogRow[]; nextCursor: string | null }> {
  const where: Record<string, unknown> = { organizationId };
  if (filter.status) where.status = filter.status;
  if (filter.from || filter.to) where.createdAt = { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lte: filter.to } : {}) };
  if (filter.search) {
    where.OR = [
      { subject:     { contains: filter.search, mode: "insensitive" } },
      { toAddress:   { contains: filter.search, mode: "insensitive" } },
      { fromAddress: { contains: filter.search, mode: "insensitive" } },
    ];
  }
  const limit = Math.min(filter.limit ?? 25, 100);
  const rows = await prisma.emailLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    select: {
      id: true, subject: true, fromAddress: true, toAddress: true,
      status: true, provider: true, providerMessageId: true,
      errorMessage: true, bodyPreview: true, sentAt: true, createdAt: true,
      firstOpenedAt: true, openCount: true, firstClickedAt: true, clickCount: true,
    },
  });
  const hasMore = rows.length > limit;
  const trimmed = hasMore ? rows.slice(0, limit) : rows;
  return { rows: trimmed as EmailLogRow[], nextCursor: hasMore ? trimmed[trimmed.length - 1].id : null };
}

export async function getEmailSummaryForOrg(organizationId: string): Promise<Record<EmailStatusCode, number> & { total: number }> {
  const grouped = await prisma.emailLog.groupBy({
    by: ["status"],
    where: { organizationId },
    _count: { _all: true },
  });
  const out: Record<EmailStatusCode, number> & { total: number } = {
    QUEUED: 0, SENT: 0, FAILED: 0, BOUNCED: 0, DELIVERED: 0, UNKNOWN: 0, total: 0,
  };
  for (const g of grouped) {
    out[g.status as EmailStatusCode] = g._count._all;
    out.total += g._count._all;
  }
  return out;
}
