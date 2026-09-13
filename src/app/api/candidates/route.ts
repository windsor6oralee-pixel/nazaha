import { NextRequest, NextResponse } from "next/server";
import { createCandidate } from "@/infrastructure/services/candidate.service";
import { requireHR } from "@/infrastructure/tenant";
import { listFieldDefinitions, validateValues } from "@/infrastructure/custom-fields/field.service";

interface Body {
  nameAr?: unknown;
  nationalId?: unknown;
  email?: unknown;
  phone?: unknown;
  jobTitle?: unknown;
  department?: unknown;
  acceptanceDate?: unknown;
  expectedStartDate?: unknown;
  hrWelcomeNote?: unknown;
}

function validate(body: Body): string | null {
  if (!body.nameAr || typeof body.nameAr !== "string" || body.nameAr.trim().length < 2)
    return "الاسم مطلوب";
  if (!body.nationalId || typeof body.nationalId !== "string" || body.nationalId.trim().length < 10)
    return "رقم الهوية يجب أن يكون 10 أرقام على الأقل";
  if (!body.email || typeof body.email !== "string" || !body.email.includes("@"))
    return "البريد الإلكتروني غير صالح";
  if (!body.jobTitle || typeof body.jobTitle !== "string" || body.jobTitle.trim().length < 2)
    return "المسمى الوظيفي مطلوب";
  if (!body.department || typeof body.department !== "string" || body.department.trim().length < 2)
    return "القسم مطلوب";
  if (!body.acceptanceDate || typeof body.acceptanceDate !== "string")
    return "تاريخ القبول مطلوب";
  return null;
}

export async function POST(request: NextRequest) {
  const ctx = await requireHR({ roles: ["admin", "hr_manager", "hr_officer"] });
  if (ctx instanceof NextResponse) return ctx;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const error = validate(body);
  if (error) {
    return NextResponse.json({ error }, { status: 422 });
  }

  const defs = await listFieldDefinitions(ctx.organizationId);
  const rawCustom = (body as { customFields?: unknown }).customFields;
  const customInput = rawCustom && typeof rawCustom === "object" ? (rawCustom as Record<string, unknown>) : {};
  const validated = validateValues(defs, customInput);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 422 });
  }

  try {
    const result = await createCandidate({
      customValues: validated.values,
      nameAr: (body.nameAr as string).trim(),
      nationalId: (body.nationalId as string).trim(),
      email: (body.email as string).trim(),
      phone: body.phone ? String(body.phone).trim() : undefined,
      jobTitle: (body.jobTitle as string).trim(),
      department: (body.department as string).trim(),
      acceptanceDate: new Date(body.acceptanceDate as string),
      expectedStartDate: body.expectedStartDate
        ? new Date(body.expectedStartDate as string)
        : undefined,
      hrWelcomeNote: body.hrWelcomeNote ? String(body.hrWelcomeNote).trim() : undefined,
      organizationId: ctx.organizationId,
      createdByUserId: ctx.userId,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "حدث خطأ غير متوقع";
    const status = message.includes("يوجد مرشح") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
