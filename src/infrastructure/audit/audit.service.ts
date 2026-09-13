import type { ActorType, Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/database/client";
import type { TenantPrisma } from "@/infrastructure/tenant/scoped-prisma";

// Append-only write path. Routes call this instead of touching the global client.
export async function recordAudit(entry: {
  actorType: ActorType;
  action: string;
  resource: string;
  resourceId?: string;
  userId?: string;
  candidateId?: string;
  applicationId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  await prisma.auditLog.create({
    data: {
      ...entry,
      metadata: entry.metadata ? (entry.metadata as unknown as Prisma.InputJsonObject) : undefined,
    },
  });
}

// ── Change tracking convention ───────────────────────────────────────────────
// Writers put `metadata.changes = { field: { from, to } }`; the viewer renders it
// as a visual diff. Only fields that actually changed are recorded.

export type FieldChange = { from: unknown; to: unknown };
export type Changes = Record<string, FieldChange>;

export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
  fields: readonly (keyof T & string)[]
): Changes {
  const changes: Changes = {};
  for (const f of fields) {
    if (!(f in after)) continue;
    const a = before[f] ?? null;
    const b = after[f] ?? null;
    if (JSON.stringify(a) !== JSON.stringify(b)) changes[f] = { from: a, to: b };
  }
  return changes;
}

// ── Listing with cursor pagination ───────────────────────────────────────────

export interface AuditFilters {
  action?: string;        // exact action, or a "prefix." to match a family (e.g. "document.")
  actorType?: ActorType;
  userId?: string;
  candidateId?: string;
  resource?: string;
  resourceId?: string;
  from?: Date;
  to?: Date;
}

export interface AuditEntry {
  id: string;
  createdAt: string;
  actorType: ActorType;
  actorName: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  candidateName: string | null;
  applicationId: string | null;
  metadata: unknown;
  ipAddress: string | null;
}

export interface AuditPage {
  entries: AuditEntry[];
  nextCursor: string | null;
}

const PAGE_SIZE = 25;

// Cursor = base64url("<createdAt ISO>|<id>") — the keyset of the last row seen.
export function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`, "utf8").toString("base64url");
}
export function decodeCursor(cursor: string | undefined | null): { createdAt: Date; id: string } | null {
  if (!cursor) return null;
  const [ts, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  const createdAt = new Date(ts ?? "");
  if (!id || Number.isNaN(createdAt.getTime())) return null;
  return { createdAt, id };
}

export async function listAuditLogs(
  db: TenantPrisma,
  filters: AuditFilters,
  cursor?: string | null,
  pageSize = PAGE_SIZE
): Promise<AuditPage> {
  const where: Prisma.AuditLogWhereInput = {};

  if (filters.action) {
    where.action = filters.action.endsWith(".") ? { startsWith: filters.action } : filters.action;
  }
  if (filters.actorType) where.actorType = filters.actorType;
  if (filters.userId) where.userId = filters.userId;
  if (filters.candidateId) where.candidateId = filters.candidateId;
  if (filters.resource) where.resource = filters.resource;
  if (filters.resourceId) where.resourceId = filters.resourceId;
  if (filters.from || filters.to) {
    where.createdAt = { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) };
  }

  // Keyset condition: rows strictly "before" the cursor in (createdAt DESC, id DESC) order.
  const k = decodeCursor(cursor);
  const keyset: Prisma.AuditLogWhereInput | null = k
    ? { OR: [{ createdAt: { lt: k.createdAt } }, { createdAt: k.createdAt, id: { lt: k.id } }] }
    : null;

  const rows = await db.auditLog.findMany({
    where: keyset ? { AND: [where, keyset] } : where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: pageSize + 1,
    select: {
      id: true, createdAt: true, actorType: true, action: true, resource: true, resourceId: true,
      applicationId: true, metadata: true, ipAddress: true,
      user: { select: { nameAr: true } },
      candidate: { select: { nameAr: true } },
    },
  });

  const hasMore = rows.length > pageSize;
  const page = hasMore ? rows.slice(0, pageSize) : rows;
  const last = page[page.length - 1];

  return {
    entries: page.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      actorType: r.actorType,
      actorName: r.actorType === "USER" ? r.user?.nameAr ?? null : r.actorType === "CANDIDATE" ? r.candidate?.nameAr ?? null : "النظام",
      action: r.action,
      resource: r.resource,
      resourceId: r.resourceId,
      candidateName: r.candidate?.nameAr ?? null,
      applicationId: r.applicationId,
      metadata: r.metadata,
      ipAddress: r.ipAddress,
    })),
    nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
  };
}

const ACTOR_TYPES = new Set<ActorType>(["USER", "CANDIDATE", "SYSTEM"]);

export function parseAuditFilters(sp: URLSearchParams): AuditFilters {
  const f: AuditFilters = {};
  const s = (k: string) => sp.get(k)?.trim() || undefined;

  f.action = s("action");
  f.userId = s("userId");
  f.candidateId = s("candidateId");
  f.resource = s("resource");
  f.resourceId = s("resourceId");

  const actor = s("actorType");
  if (actor && ACTOR_TYPES.has(actor as ActorType)) f.actorType = actor as ActorType;

  const from = s("from");
  const to = s("to");
  if (from && !Number.isNaN(Date.parse(from))) f.from = new Date(from);
  if (to && !Number.isNaN(Date.parse(to))) f.to = new Date(`${to}T23:59:59.999Z`);

  return f;
}

export async function getAuditFilterOptions(db: TenantPrisma) {
  const [actions, resources, users] = await Promise.all([
    db.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
    db.auditLog.findMany({ distinct: ["resource"], select: { resource: true }, orderBy: { resource: "asc" } }),
    db.user.findMany({ select: { id: true, nameAr: true }, orderBy: { nameAr: "asc" } }),
  ]);
  return {
    actions: actions.map((a) => a.action),
    resources: resources.map((r) => r.resource),
    users,
  };
}

// Arabic labels for known actions; unknown ones fall back to the raw key.
export const ACTION_LABELS: Record<string, string> = {
  "user.login":                "تسجيل دخول موظف",
  "candidate.login":           "تسجيل دخول مرشح",
  "platform_admin.login":      "تسجيل دخول مشغّل المنصة",
  "candidate.created":         "إنشاء مرشح",
  "application.created":       "إنشاء طلب",
  "application.documents_complete": "اكتمال المستندات المطلوبة",
  "document.uploaded":         "رفع مستند",
  "document.approved":         "اعتماد مستند",
  "document.rejected":         "رفض مستند",
  "contract.created":          "توليد عقد",
  "contract.signed":           "توقيع عقد",
  "organization.provisioned":  "تجهيز جهة",
  "organization.updated":      "تعديل هوية الجهة",
};

export const RESOURCE_LABELS: Record<string, string> = {
  User: "موظف", Candidate: "مرشح", Application: "طلب", Document: "مستند",
  Contract: "عقد", Organization: "جهة", PlatformAdmin: "مشغّل المنصة",
};
