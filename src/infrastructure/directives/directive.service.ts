/**
 * HR directive service — the "sticky instruction" HR keeps on the candidate's
 * dashboard. One active directive per application; replacing it overwrites in
 * place so the candidate always sees exactly one message.
 */
import { prisma } from "@/infrastructure/database/client";

export type DirectiveType = "INFO" | "URGENT" | "APPOINTMENT";

export interface DirectiveView {
  id: string;
  type: DirectiveType;
  title: string;
  body: string;
  allowReply: boolean;
  notifyByEmail: boolean;
  candidateReply: string | null;
  candidateReadAt: Date | null;
  candidateRepliedAt: Date | null;
  createdByName: string;
  updatedAt: Date;
}

export interface UpsertDirectiveInput {
  type?: DirectiveType;
  title: string;
  body: string;
  allowReply?: boolean;
  notifyByEmail?: boolean;
}

export async function getDirectiveForApplication(applicationId: string): Promise<DirectiveView | null> {
  const row = await prisma.hRDirective.findUnique({
    where: { applicationId },
    include: { createdBy: { select: { nameAr: true } } },
  });
  if (!row) return null;
  return {
    id: row.id,
    type: row.type as DirectiveType,
    title: row.title,
    body: row.body,
    allowReply: row.allowReply,
    notifyByEmail: row.notifyByEmail,
    candidateReply: row.candidateReply,
    candidateReadAt: row.candidateReadAt,
    candidateRepliedAt: row.candidateRepliedAt,
    createdByName: row.createdBy.nameAr,
    updatedAt: row.updatedAt,
  };
}

export async function upsertDirective(
  applicationId: string,
  userId: string,
  input: UpsertDirectiveInput,
): Promise<DirectiveView> {
  const title = input.title.trim();
  const body  = input.body.trim();
  if (!title) throw new Error("عنوان التوجيه مطلوب");
  if (!body)  throw new Error("نص التوجيه مطلوب");

  // Before overwriting, snapshot the previous directive so HR can audit the
  // sequence of instructions this candidate has received.
  const existing = await prisma.hRDirective.findUnique({ where: { applicationId } });
  if (existing) {
    await prisma.hRDirectiveHistory.create({
      data: {
        applicationId:       existing.applicationId,
        type:                existing.type,
        title:               existing.title,
        body:                existing.body,
        allowReply:          existing.allowReply,
        notifyByEmail:       existing.notifyByEmail,
        candidateReply:      existing.candidateReply,
        candidateReadAt:     existing.candidateReadAt,
        candidateRepliedAt:  existing.candidateRepliedAt,
        createdByUserId:     existing.createdByUserId,
        createdAt:           existing.createdAt,
      },
    });
  }

  await prisma.hRDirective.upsert({
    where:  { applicationId },
    update: {
      title, body,
      type: input.type ?? "INFO",
      allowReply: input.allowReply ?? false,
      notifyByEmail: input.notifyByEmail ?? false,
      // Replacing the content clears the previous read/reply marks — this is a
      // new instruction, HR should see fresh engagement signals for it.
      candidateReadAt: null,
      candidateReply: null,
      candidateRepliedAt: null,
    },
    create: {
      applicationId,
      title, body,
      type: input.type ?? "INFO",
      allowReply: input.allowReply ?? false,
      notifyByEmail: input.notifyByEmail ?? false,
      createdByUserId: userId,
    },
  });

  const view = await getDirectiveForApplication(applicationId);
  if (!view) throw new Error("directive upsert did not persist");

  if (input.notifyByEmail) {
    // Best-effort — any mail failure is swallowed so the HR save still succeeds.
    sendDirectiveEmail(applicationId, view).catch((e) => {
      console.error(`[directive] email send failed for app ${applicationId}:`, e instanceof Error ? e.message : e);
    });
  }
  return view;
}

async function sendDirectiveEmail(applicationId: string, view: DirectiveView): Promise<void> {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      candidate:    { select: { nameAr: true, email: true } },
      organization: { select: { id: true, nameAr: true } },
    },
  });
  if (!app?.candidate.email) return;
  const { getOrgNotifier } = await import("@/infrastructure/notifications");
  const { candidateDirective } = await import("@/infrastructure/notifications/templates/directive");
  const notifier = await getOrgNotifier(app.organization.id);
  if (!notifier.isTransport) return;
  const loginUrl = (process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002").replace(/\/$/, "");
  const { subject, html } = candidateDirective({
    candidateName:    app.candidate.nameAr,
    organizationName: app.organization.nameAr,
    type:             view.type,
    title:            view.title,
    body:             view.body,
    loginUrl,
  });

  const { createPendingLog, markLogStatus, injectEmailTracking } = await import("@/infrastructure/notifications/email-log.service");
  const logId = await createPendingLog({
    organizationId: app.organization.id,
    applicationId,
    fromAddress:    "notifier",
    toAddress:      app.candidate.email,
    subject,
    bodyHtml:       html,
    provider:       "smtp",
  }).catch((e) => { console.error("[directive] pending log failed:", e instanceof Error ? e.message : e); return null; });

  const trackedHtml = logId ? injectEmailTracking(html, logId, loginUrl) : html;
  let sendErr: unknown = null;
  try {
    await notifier.send({ to: app.candidate.email, subject, html: trackedHtml });
  } catch (e) {
    sendErr = e;
  }

  if (logId) {
    markLogStatus(logId, sendErr ? "FAILED" : "SENT", {
      errorMessage: sendErr instanceof Error ? sendErr.message : (sendErr ? String(sendErr) : null),
    }).catch((err) => { console.error("[directive] log status update failed:", err instanceof Error ? err.message : err); });
  }

  if (sendErr) throw sendErr;
}

export async function deleteDirective(applicationId: string): Promise<void> {
  const existing = await prisma.hRDirective.findUnique({ where: { applicationId } });
  if (existing) {
    await prisma.hRDirectiveHistory.create({
      data: {
        applicationId:       existing.applicationId,
        type:                existing.type,
        title:               existing.title,
        body:                existing.body,
        allowReply:          existing.allowReply,
        notifyByEmail:       existing.notifyByEmail,
        candidateReply:      existing.candidateReply,
        candidateReadAt:     existing.candidateReadAt,
        candidateRepliedAt:  existing.candidateRepliedAt,
        createdByUserId:     existing.createdByUserId,
        createdAt:           existing.createdAt,
      },
    });
    await prisma.hRDirective.delete({ where: { applicationId } });
  }
}

/** Chronological archive — newest first — of this candidate's prior directives. */
export interface DirectiveHistoryEntry {
  id: string;
  type: DirectiveType;
  title: string;
  body: string;
  candidateReply: string | null;
  candidateReadAt: Date | null;
  candidateRepliedAt: Date | null;
  createdAt: Date;
  archivedAt: Date;
  createdByName: string;
}

export async function listDirectiveHistory(applicationId: string, limit = 20): Promise<DirectiveHistoryEntry[]> {
  const rows = await prisma.hRDirectiveHistory.findMany({
    where: { applicationId },
    orderBy: { archivedAt: "desc" },
    take: limit,
  });
  if (!rows.length) return [];
  // Hydrate createdBy names in one query — HRDirectiveHistory doesn't carry
  // the relation back on the model so a lightweight lookup is enough.
  const userIds = Array.from(new Set(rows.map((r) => r.createdByUserId)));
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, nameAr: true } });
  const nameOf = new Map(users.map((u) => [u.id, u.nameAr]));
  return rows.map((r) => ({
    id: r.id,
    type: r.type as DirectiveType,
    title: r.title,
    body: r.body,
    candidateReply: r.candidateReply,
    candidateReadAt: r.candidateReadAt,
    candidateRepliedAt: r.candidateRepliedAt,
    createdAt: r.createdAt,
    archivedAt: r.archivedAt,
    createdByName: nameOf.get(r.createdByUserId) ?? "—",
  }));
}

// ─── Bulk send ──────────────────────────────────────────────────────────────

export interface BulkDirectiveInput {
  candidateIds: string[];           // IDs of candidates in the HR user's org
  type: DirectiveType;
  title: string;                    // may contain {{...}} placeholders
  body:  string;                    // may contain {{...}} placeholders
  allowReply: boolean;
  notifyByEmail: boolean;
  concurrency?: number;             // 1..5, default 2
  minGapMs?:    number;             // 0..10000, default 400
}

export interface BulkDirectiveResult {
  succeeded: number;
  failed: number;
  details: Array<{ candidateId: string; email: string | null; status: "ok" | "error"; error?: string }>;
}

/** Fans out a templated directive to many candidates, rendering variables per-candidate. */
export async function bulkUpsertDirective(
  organizationId: string,
  userId: string,
  input: BulkDirectiveInput,
): Promise<BulkDirectiveResult> {
  if (!input.candidateIds.length) return { succeeded: 0, failed: 0, details: [] };
  if (!input.title.trim() || !input.body.trim()) throw new Error("العنوان والنص مطلوبان");

  const { buildContext, renderVariables } = await import("./variables");

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { nameAr: true } });
  const hrName = user?.nameAr ?? "فريق الموارد البشرية";

  const candidates = await prisma.candidate.findMany({
    where: { id: { in: input.candidateIds }, organizationId },
    include: {
      organization: { select: { nameAr: true, nameEn: true } },
      applications: { where: { status: { in: ["APPROVED", "IN_PROGRESS", "PENDING"] } }, select: { id: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const { runPaced } = await import("@/infrastructure/notifications/paced-runner");

  const details: BulkDirectiveResult["details"] = [];
  const toSend = candidates.filter((c) => {
    if (c.applications[0]?.id) return true;
    details.push({ candidateId: c.id, email: c.email, status: "error", error: "no active application" });
    return false;
  });

  // Paced fan-out — keeps a steady drip into the mailbox pool so bursty SMTP
  // rate limits and per-connection caps do not blow up the batch.
  const paced = await runPaced(toSend, async (c) => {
    const appId = c.applications[0]!.id;
    const ctx = buildContext({
      candidate:    { nameAr: c.nameAr, jobTitle: c.jobTitle, department: c.department, email: c.email },
      organization: { nameAr: c.organization.nameAr, nameEn: c.organization.nameEn ?? null },
      hr:           { nameAr: hrName },
    });
    await upsertDirective(appId, userId, {
      type: input.type,
      title: renderVariables(input.title, ctx),
      body:  renderVariables(input.body,  ctx),
      allowReply: input.allowReply,
      notifyByEmail: input.notifyByEmail,
    });
  }, { concurrency: input.concurrency ?? 2, minGapMs: input.minGapMs ?? 400 });

  let succeeded = 0, failed = details.length;
  for (const r of paced) {
    if (r.status === "ok") { succeeded++; details.push({ candidateId: r.item.id, email: r.item.email, status: "ok" }); }
    else                   { failed++;    details.push({ candidateId: r.item.id, email: r.item.email, status: "error", error: r.error }); }
  }
  return { succeeded, failed, details };
}

/** Called from the candidate side when the card is rendered — idempotent. */
export async function markDirectiveRead(applicationId: string): Promise<void> {
  const row = await prisma.hRDirective.findUnique({ where: { applicationId }, select: { candidateReadAt: true } });
  if (!row || row.candidateReadAt) return;
  await prisma.hRDirective.update({
    where: { applicationId },
    data:  { candidateReadAt: new Date() },
  });
}

export async function recordCandidateReply(applicationId: string, reply: string): Promise<DirectiveView> {
  const text = reply.trim();
  if (!text) throw new Error("الرد لا يمكن أن يكون فارغاً");
  if (text.length > 2000) throw new Error("الرد طويل جداً — الحد الأقصى 2000 حرف");

  const row = await prisma.hRDirective.findUnique({
    where: { applicationId },
    select: { allowReply: true },
  });
  if (!row) throw new Error("لا يوجد توجيه نشط");
  if (!row.allowReply) throw new Error("الرد غير مسموح لهذا التوجيه");

  await prisma.hRDirective.update({
    where: { applicationId },
    data:  { candidateReply: text, candidateRepliedAt: new Date() },
  });
  const view = await getDirectiveForApplication(applicationId);
  if (!view) throw new Error("directive missing after reply");
  return view;
}

// ─── Templates ───────────────────────────────────────────────────────────────

export interface DirectiveTemplate {
  id: string;
  title: string;
  body: string;
  type: DirectiveType;
  updatedAt: Date;
}

export async function listDirectiveTemplates(organizationId: string): Promise<DirectiveTemplate[]> {
  const rows = await prisma.hRDirectiveTemplate.findMany({
    where: { organizationId },
    orderBy: { title: "asc" },
    select: { id: true, title: true, body: true, type: true, updatedAt: true },
  });
  return rows;
}

export async function createDirectiveTemplate(organizationId: string, title: string, body: string, type: DirectiveType = "INFO"): Promise<DirectiveTemplate> {
  const t = title.trim(); const b = body.trim();
  if (!t || !b) throw new Error("العنوان والنص مطلوبان");
  const row = await prisma.hRDirectiveTemplate.create({
    data: { organizationId, title: t, body: b, type },
    select: { id: true, title: true, body: true, type: true, updatedAt: true },
  });
  return row;
}

export async function updateDirectiveTemplate(organizationId: string, id: string, title: string, body: string, type?: DirectiveType): Promise<DirectiveTemplate> {
  const t = title.trim(); const b = body.trim();
  if (!t || !b) throw new Error("العنوان والنص مطلوبان");
  const existing = await prisma.hRDirectiveTemplate.findUnique({ where: { id }, select: { organizationId: true } });
  if (!existing || existing.organizationId !== organizationId) throw new Error("القالب غير موجود");
  const row = await prisma.hRDirectiveTemplate.update({
    where: { id },
    data: { title: t, body: b, ...(type ? { type } : {}) },
    select: { id: true, title: true, body: true, type: true, updatedAt: true },
  });
  return row;
}

export async function deleteDirectiveTemplate(organizationId: string, id: string): Promise<void> {
  const existing = await prisma.hRDirectiveTemplate.findUnique({ where: { id }, select: { organizationId: true } });
  if (!existing || existing.organizationId !== organizationId) return;
  await prisma.hRDirectiveTemplate.delete({ where: { id } });
}
