import { NextResponse } from "next/server";
import { requireHR } from "@/infrastructure/tenant";
import {
  getOrganizationProfile,
  updateOrganizationProfile,
  type OrganizationProfileInput,
} from "@/infrastructure/services/organization.service";

const ADMIN_ROLES = ["admin", "hr_manager"];
const ORG_TYPES = new Set(["GOVERNMENT", "SEMI_GOVERNMENT", "PRIVATE"]);
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const TEXT_FIELDS = [
  "nameAr", "nameEn", "officialNameAr", "authorizedSignerName", "authorizedSignerTitle",
  "commercialRegNo", "address", "contactEmail", "contactPhone",
] as const;

function parse(body: Record<string, unknown>): { data: OrganizationProfileInput } | { error: string } {
  const data: OrganizationProfileInput = {};

  for (const key of TEXT_FIELDS) {
    if (!(key in body)) continue;
    const v = body[key];
    if (v !== null && typeof v !== "string") return { error: `حقل ${key} غير صالح` };
    const trimmed = typeof v === "string" ? v.trim() : null;
    if (key === "nameAr" && !trimmed) return { error: "اسم الجهة مطلوب" };
    (data as Record<string, unknown>)[key] = trimmed || null;
  }
  if (data.nameAr === null) delete data.nameAr;

  if ("type" in body) {
    if (typeof body.type !== "string" || !ORG_TYPES.has(body.type)) return { error: "نوع الجهة غير صالح" };
    data.type = body.type as OrganizationProfileInput["type"];
  }
  if ("primaryColor" in body) {
    const c = body.primaryColor;
    if (c === null || c === "") data.primaryColor = null;
    else if (typeof c !== "string" || !HEX_COLOR.test(c)) return { error: "اللون يجب أن يكون بصيغة #RRGGBB" };
    else data.primaryColor = c.toUpperCase();
  }
  if (data.contactEmail && !data.contactEmail.includes("@")) return { error: "بريد التواصل غير صالح" };

  return { data };
}

export async function GET() {
  const ctx = await requireHR({ roles: ADMIN_ROLES });
  if (ctx instanceof NextResponse) return ctx;
  const profile = await getOrganizationProfile(ctx.organizationId);
  return NextResponse.json(profile);
}

export async function PATCH(req: Request) {
  const ctx = await requireHR({ roles: ADMIN_ROLES });
  if (ctx instanceof NextResponse) return ctx;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const parsed = parse(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 422 });

  const profile = await updateOrganizationProfile(ctx.organizationId, parsed.data);
  return NextResponse.json(profile);
}
