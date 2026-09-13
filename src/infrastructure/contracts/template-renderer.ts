import { createHash } from "crypto";
import { sanitizeContractHtml } from "./html-sanitizer";

// Every built-in placeholder a template may use. Kept as data so the admin editor
// and the renderer can never disagree about what exists. Tenants extend this set
// with {{custom.<key>}} from their CandidateFieldDefinitions.
export const PLACEHOLDERS = [
  { key: "candidate.nameAr",        labelAr: "اسم المرشح" },
  { key: "candidate.nationalId",    labelAr: "رقم الهوية" },
  { key: "candidate.email",         labelAr: "بريد المرشح" },
  { key: "candidate.jobTitle",      labelAr: "المسمى الوظيفي" },
  { key: "candidate.department",    labelAr: "الإدارة / القسم" },
  { key: "candidate.startDate",     labelAr: "تاريخ المباشرة" },
  { key: "org.nameAr",              labelAr: "اسم الجهة" },
  { key: "org.officialNameAr",      labelAr: "الاسم الرسمي للجهة" },
  { key: "org.signerName",          labelAr: "اسم المعتمد الرسمي" },
  { key: "org.signerTitle",         labelAr: "منصب المعتمد الرسمي" },
  { key: "org.address",             labelAr: "عنوان الجهة" },
  { key: "org.commercialRegNo",     labelAr: "السجل التجاري" },
  { key: "contract.date",           labelAr: "تاريخ العقد" },
  { key: "contract.nameAr",         labelAr: "اسم العقد" },
] as const;

export type PlaceholderKey = (typeof PLACEHOLDERS)[number]["key"];
export type TemplateValues = Record<PlaceholderKey, string> & Record<`custom.${string}`, string>;

export interface PlaceholderInfo { key: string; labelAr: string; group: "candidate" | "org" | "contract" | "custom" }

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z]+\.[a-zA-Z0-9_]+)\s*\}\}/g;
const BUILTIN = new Set<string>(PLACEHOLDERS.map((p) => p.key));
const CUSTOM_PREFIX = "custom.";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isAllowed(key: string, customKeys: ReadonlySet<string>): boolean {
  return BUILTIN.has(key) || (key.startsWith(CUSTOM_PREFIX) && customKeys.has(key.slice(CUSTOM_PREFIX.length)));
}

// Values are always escaped: template authors control structure, data never does.
// Unknown placeholders are left verbatim so a typo is visible rather than silently blank.
export function renderTemplate(bodyHtml: string, values: Record<string, string>, customKeys: Iterable<string> = []): string {
  const custom = new Set(customKeys);
  const rendered = bodyHtml.replace(PLACEHOLDER_RE, (match, key: string) => {
    if (!isAllowed(key, custom)) return match;
    const v = values[key];
    return v ? escapeHtml(v) : "<span class=\"missing\">—</span>";
  });
  // Sanitize the OUTPUT: what gets frozen and hashed is guaranteed inert markup.
  return sanitizeContractHtml(rendered);
}

export function findUnknownPlaceholders(bodyHtml: string, customKeys: Iterable<string> = []): string[] {
  const custom = new Set(customKeys);
  const unknown = new Set<string>();
  for (const m of bodyHtml.matchAll(PLACEHOLDER_RE)) {
    if (!isAllowed(m[1], custom)) unknown.add(m[1]);
  }
  return [...unknown];
}

export function listPlaceholders(customFields: { key: string; labelAr: string }[]): PlaceholderInfo[] {
  const builtin: PlaceholderInfo[] = PLACEHOLDERS.map((p) => ({
    key: p.key, labelAr: p.labelAr, group: p.key.split(".")[0] as PlaceholderInfo["group"],
  }));
  const custom: PlaceholderInfo[] = customFields.map((f) => ({ key: `${CUSTOM_PREFIX}${f.key}`, labelAr: f.labelAr, group: "custom" }));
  return [...builtin, ...custom];
}

export function hashContent(renderedHtml: string): string {
  return createHash("sha256").update(renderedHtml, "utf8").digest("hex");
}

export function formatArabicDate(d: Date): string {
  return d.toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
}
