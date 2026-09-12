import type { FieldType } from "@prisma/client";
import { prisma } from "@/infrastructure/database/client";

export const FIELD_TYPES: FieldType[] = ["TEXT", "NUMBER", "DATE", "SELECT", "BOOLEAN"];
export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  TEXT: "نص", NUMBER: "رقم", DATE: "تاريخ", SELECT: "قائمة اختيار", BOOLEAN: "نعم / لا",
};

const KEY_RE = /^[a-z][a-z0-9_]{1,39}$/;
const MAX_TEXT = 500;
const MAX_OPTIONS = 50;

export interface FieldDefinition {
  id: string;
  key: string;
  labelAr: string;
  type: FieldType;
  options: string[];
  isRequired: boolean;
  showToCandidate: boolean;
  order: number;
}

export interface FieldDefinitionInput {
  key: string;
  labelAr: string;
  type: FieldType;
  options?: string[];
  isRequired?: boolean;
  showToCandidate?: boolean;
  order?: number;
}

const defSelect = {
  id: true, key: true, labelAr: true, type: true, options: true,
  isRequired: true, showToCandidate: true, order: true,
} as const;

// ── Definitions ──────────────────────────────────────────────────────────────

export async function listFieldDefinitions(organizationId: string): Promise<FieldDefinition[]> {
  return prisma.candidateFieldDefinition.findMany({
    where: { organizationId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: defSelect,
  });
}

export function validateDefinition(input: Partial<FieldDefinitionInput>, partial = false): string | null {
  if (!partial || input.key !== undefined) {
    if (typeof input.key !== "string" || !KEY_RE.test(input.key))
      return "المفتاح يجب أن يكون بأحرف إنجليزية صغيرة وأرقام و_ فقط، ويبدأ بحرف (مثال: employee_number)";
  }
  if (!partial || input.labelAr !== undefined) {
    if (typeof input.labelAr !== "string" || input.labelAr.trim().length < 2) return "اسم الحقل مطلوب";
  }
  if (!partial || input.type !== undefined) {
    if (!FIELD_TYPES.includes(input.type as FieldType)) return "نوع الحقل غير صالح";
  }
  if (input.type === "SELECT" || (partial && input.options !== undefined)) {
    const opts = input.options ?? [];
    if (!Array.isArray(opts) || opts.some((o) => typeof o !== "string")) return "الخيارات غير صالحة";
    const clean = opts.map((o) => o.trim()).filter(Boolean);
    if (input.type === "SELECT" && clean.length < 2) return "قائمة الاختيار تحتاج خيارين على الأقل";
    if (clean.length > MAX_OPTIONS) return `الحد الأقصى ${MAX_OPTIONS} خياراً`;
    if (new Set(clean).size !== clean.length) return "الخيارات مكررة";
  }
  return null;
}

function normalizeDefinition(input: FieldDefinitionInput) {
  return {
    key: input.key,
    labelAr: input.labelAr.trim(),
    type: input.type,
    options: input.type === "SELECT" ? (input.options ?? []).map((o) => o.trim()).filter(Boolean) : [],
    isRequired: !!input.isRequired,
    showToCandidate: !!input.showToCandidate,
    order: Number.isFinite(input.order) ? Number(input.order) : 0,
  };
}

export async function createFieldDefinition(organizationId: string, input: FieldDefinitionInput): Promise<FieldDefinition> {
  const dup = await prisma.candidateFieldDefinition.findUnique({
    where: { organizationId_key: { organizationId, key: input.key } },
    select: { id: true },
  });
  if (dup) throw new Error("يوجد حقل بنفس المفتاح");

  const last = await prisma.candidateFieldDefinition.findFirst({
    where: { organizationId }, orderBy: { order: "desc" }, select: { order: true },
  });
  const data = normalizeDefinition(input);
  if (input.order === undefined) data.order = (last?.order ?? 0) + 1;

  return prisma.candidateFieldDefinition.create({ data: { ...data, organizationId }, select: defSelect });
}

// Type and key are immutable once created: changing them would silently corrupt stored values.
export async function updateFieldDefinition(
  organizationId: string,
  id: string,
  input: Partial<Pick<FieldDefinitionInput, "labelAr" | "options" | "isRequired" | "showToCandidate" | "order">>
): Promise<FieldDefinition> {
  const existing = await prisma.candidateFieldDefinition.findFirst({ where: { id, organizationId } });
  if (!existing) throw new Error("الحقل غير موجود");

  const data: Record<string, unknown> = {};
  if (input.labelAr !== undefined) data.labelAr = input.labelAr.trim();
  if (input.isRequired !== undefined) data.isRequired = !!input.isRequired;
  if (input.showToCandidate !== undefined) data.showToCandidate = !!input.showToCandidate;
  if (input.order !== undefined) data.order = Number(input.order);
  if (input.options !== undefined && existing.type === "SELECT") {
    data.options = input.options.map((o) => o.trim()).filter(Boolean);
  }

  return prisma.candidateFieldDefinition.update({ where: { id }, data, select: defSelect });
}

export async function deleteFieldDefinition(organizationId: string, id: string): Promise<{ removedValues: number }> {
  const existing = await prisma.candidateFieldDefinition.findFirst({
    where: { id, organizationId },
    select: { id: true, _count: { select: { values: true } } },
  });
  if (!existing) throw new Error("الحقل غير موجود");
  await prisma.candidateFieldDefinition.delete({ where: { id } });
  return { removedValues: existing._count.values };
}

// ── Values ───────────────────────────────────────────────────────────────────

export type ValueMap = Record<string, unknown>;
export type ValidatedValues = { ok: true; values: { definitionId: string; value: string }[] } | { ok: false; error: string };

// Validates raw input against the tenant's definitions and returns canonical strings.
// Missing optional fields are simply omitted; missing required ones are an error.
export function validateValues(defs: FieldDefinition[], input: ValueMap): ValidatedValues {
  const out: { definitionId: string; value: string }[] = [];

  for (const def of defs) {
    const raw = input[def.key];
    const empty = raw === undefined || raw === null || raw === "";

    if (empty) {
      if (def.isRequired && def.type !== "BOOLEAN") return { ok: false, error: `حقل "${def.labelAr}" مطلوب` };
      if (def.type === "BOOLEAN") out.push({ definitionId: def.id, value: "false" });
      continue;
    }

    switch (def.type) {
      case "TEXT": {
        const v = String(raw).trim();
        if (v.length > MAX_TEXT) return { ok: false, error: `"${def.labelAr}" يتجاوز ${MAX_TEXT} حرفاً` };
        out.push({ definitionId: def.id, value: v });
        break;
      }
      case "NUMBER": {
        const n = Number(String(raw).trim());
        if (!Number.isFinite(n)) return { ok: false, error: `"${def.labelAr}" يجب أن يكون رقماً` };
        out.push({ definitionId: def.id, value: String(n) });
        break;
      }
      case "DATE": {
        const s = String(raw).trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) return { ok: false, error: `"${def.labelAr}" تاريخ غير صالح` };
        out.push({ definitionId: def.id, value: s });
        break;
      }
      case "SELECT": {
        const s = String(raw).trim();
        if (!def.options.includes(s)) return { ok: false, error: `"${def.labelAr}" قيمة غير مسموحة` };
        out.push({ definitionId: def.id, value: s });
        break;
      }
      case "BOOLEAN": {
        const b = raw === true || raw === "true" || raw === "1" || raw === 1;
        const f = raw === false || raw === "false" || raw === "0" || raw === 0;
        if (!b && !f) return { ok: false, error: `"${def.labelAr}" يجب أن يكون نعم أو لا` };
        out.push({ definitionId: def.id, value: b ? "true" : "false" });
        break;
      }
    }
  }
  return { ok: true, values: out };
}

export interface CandidateFieldView extends FieldDefinition {
  value: string | null;
  display: string;
}

export function formatValue(def: Pick<FieldDefinition, "type">, value: string | null): string {
  if (value === null || value === "") return "—";
  switch (def.type) {
    case "BOOLEAN": return value === "true" ? "نعم" : "لا";
    case "DATE": {
      const d = new Date(value + "T00:00:00Z");
      return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
    }
    case "NUMBER": return Number(value).toLocaleString("ar-SA");
    default: return value;
  }
}

export async function getCandidateFields(
  organizationId: string,
  candidateId: string,
  opts?: { candidateVisibleOnly?: boolean }
): Promise<CandidateFieldView[]> {
  const [defs, values] = await Promise.all([
    listFieldDefinitions(organizationId),
    prisma.candidateFieldValue.findMany({ where: { candidateId }, select: { definitionId: true, value: true } }),
  ]);
  const byDef = new Map(values.map((v) => [v.definitionId, v.value]));
  return defs
    .filter((d) => !opts?.candidateVisibleOnly || d.showToCandidate)
    .map((d) => {
      const value = byDef.get(d.id) ?? null;
      return { ...d, value, display: formatValue(d, value) };
    });
}

// Template variables: {{custom.<key>}} → formatted value.
export async function getCandidateTemplateValues(organizationId: string, candidateId: string): Promise<Record<string, string>> {
  const fields = await getCandidateFields(organizationId, candidateId);
  const out: Record<string, string> = {};
  for (const f of fields) out[`custom.${f.key}`] = f.value === null ? "" : f.display;
  return out;
}
