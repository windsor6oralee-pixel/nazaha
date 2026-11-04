/**
 * Variable substitution for HR directive templates.
 *
 * Templates are stored with `{{group.key}}` placeholders and resolved at apply
 * time against a per-application context — so the same template reads naturally
 * for every candidate it's used on. The resolver is forgiving: an unknown
 * placeholder is left in place (not blanked), so operators can spot typos.
 */

export interface DirectiveContext {
  candidate: {
    firstName: string;
    fullName: string;
    jobTitle: string;
    department: string;
    email: string;
  };
  organization: {
    nameAr: string;
    nameEn?: string | null;
  };
  hr: {
    nameAr: string;
  };
  date: {
    today: string;      // dd/mm/yyyy
    todayAr: string;    // عربي: ٢ نوفمبر ٢٠٢٦
  };
}

export interface VariableSpec {
  key: string;          // "candidate.firstName"
  labelAr: string;      // "الاسم الأول للمرشح"
}

/** List shown as suggestion chips in the admin template editor. */
export const AVAILABLE_VARIABLES: VariableSpec[] = [
  { key: "candidate.firstName",   labelAr: "الاسم الأول" },
  { key: "candidate.fullName",    labelAr: "الاسم الكامل" },
  { key: "candidate.jobTitle",    labelAr: "المسمى الوظيفي" },
  { key: "candidate.department",  labelAr: "القسم" },
  { key: "candidate.email",       labelAr: "البريد الإلكتروني" },
  { key: "organization.nameAr",   labelAr: "اسم الجهة" },
  { key: "hr.nameAr",             labelAr: "اسم موظف HR" },
  { key: "date.today",            labelAr: "تاريخ اليوم (رقمي)" },
  { key: "date.todayAr",          labelAr: "تاريخ اليوم (عربي)" },
];

export function buildContext(input: {
  candidate: { nameAr: string; jobTitle: string; department: string; email: string };
  organization: { nameAr: string; nameEn: string | null };
  hr:  { nameAr: string };
}): DirectiveContext {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const parts = input.candidate.nameAr.trim().split(/\s+/);
  return {
    candidate: {
      firstName:  parts[0] ?? input.candidate.nameAr,
      fullName:   input.candidate.nameAr,
      jobTitle:   input.candidate.jobTitle,
      department: input.candidate.department,
      email:      input.candidate.email,
    },
    organization: {
      nameAr: input.organization.nameAr,
      nameEn: input.organization.nameEn,
    },
    hr: { nameAr: input.hr.nameAr },
    date: {
      today:   `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`,
      todayAr: now.toLocaleDateString("ar-SA-u-nu-latn", { year: "numeric", month: "long", day: "numeric" }),
    },
  };
}

/** Pulls a value by dotted path from the context — undefined leaves the token in place. */
function readPath(ctx: DirectiveContext, path: string): string | undefined {
  const parts = path.split(".");
  // Record<string, unknown> traversal keeps type-safety at the leaf lookup.
  let cur: unknown = ctx;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return typeof cur === "string" || typeof cur === "number" ? String(cur) : undefined;
}

const TOKEN_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

export function renderVariables(text: string, ctx: DirectiveContext): string {
  if (!text) return text;
  return text.replace(TOKEN_RE, (match, path: string) => {
    const v = readPath(ctx, path);
    return v ?? match;  // unknown placeholders stay visible — easier to debug typos
  });
}
