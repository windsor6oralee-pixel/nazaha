import { NextResponse } from "next/server";
import type { ContractType } from "@prisma/client";
import { requireHR } from "@/infrastructure/tenant";
import {
  listTemplates,
  saveTemplateVersion,
  renderPreview,
  getPlaceholdersForOrg,
} from "@/infrastructure/contracts/contract-template.service";

const ADMIN_ROLES = ["admin", "hr_manager"];
const TYPES = new Set<ContractType>([
  "EMPLOYMENT_CONTRACT", "CONFIDENTIALITY_AGREEMENT", "IT_POLICY_ACKNOWLEDGEMENT", "CONFLICT_OF_INTEREST", "CUSTOM",
]);
const MAX_BODY = 200_000;

function parseBody(body: unknown): { type: ContractType; nameAr: string; bodyHtml: string } | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.type !== "string" || !TYPES.has(b.type as ContractType)) return { error: "نوع العقد غير صالح" };
  if (typeof b.nameAr !== "string" || b.nameAr.trim().length < 2) return { error: "اسم العقد مطلوب" };
  if (typeof b.bodyHtml !== "string" || b.bodyHtml.trim().length < 20) return { error: "نص القالب قصير جداً" };
  if (b.bodyHtml.length > MAX_BODY) return { error: "نص القالب يتجاوز الحد المسموح" };
  if (/<script[\s>]/i.test(b.bodyHtml) || /\son[a-z]+\s*=/i.test(b.bodyHtml)) return { error: "لا يُسمح بالسكربتات أو معالجات الأحداث داخل القالب" };
  return { type: b.type as ContractType, nameAr: b.nameAr, bodyHtml: b.bodyHtml };
}

export async function GET() {
  const ctx = await requireHR({ roles: ADMIN_ROLES });
  if (ctx instanceof NextResponse) return ctx;
  const [templates, placeholders] = await Promise.all([
    listTemplates(ctx.organizationId),
    getPlaceholdersForOrg(ctx.organizationId),
  ]);
  return NextResponse.json({ templates, placeholders });
}

// Saves a new active version (previous version stays intact for already-generated contracts).
export async function PUT(req: Request) {
  const ctx = await requireHR({ roles: ADMIN_ROLES });
  if (ctx instanceof NextResponse) return ctx;

  const parsed = parseBody(await req.json().catch(() => null));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 422 });

  try {
    const saved = await saveTemplateVersion(ctx.organizationId, parsed.type, parsed);
    return NextResponse.json({ ok: true, template: { id: saved.id, version: saved.version, updatedAt: saved.updatedAt } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "فشل الحفظ" }, { status: 422 });
  }
}

// Renders a preview with sample data; nothing is persisted.
export async function POST(req: Request) {
  const ctx = await requireHR({ roles: ADMIN_ROLES });
  if (ctx instanceof NextResponse) return ctx;

  const parsed = parseBody(await req.json().catch(() => null));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 422 });

  const html = await renderPreview(ctx.organizationId, parsed.bodyHtml, parsed.nameAr);
  return NextResponse.json({ html });
}
