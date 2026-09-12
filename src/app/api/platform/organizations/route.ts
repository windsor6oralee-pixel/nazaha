import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requirePlatformAdmin } from "@/infrastructure/tenant";
import {
  listOrganizations,
  provisionOrganization,
  validateProvisionInput,
  type ProvisionInput,
} from "@/infrastructure/platform/provisioning.service";

export async function GET() {
  const ctx = await requirePlatformAdmin();
  if (ctx instanceof NextResponse) return ctx;
  return NextResponse.json({ organizations: await listOrganizations() });
}

export async function POST(req: Request) {
  const ctx = await requirePlatformAdmin();
  if (ctx instanceof NextResponse) return ctx;

  const body = (await req.json().catch(() => null)) as Partial<ProvisionInput> | null;
  if (!body) return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });

  const error = validateProvisionInput(body);
  if (error) return NextResponse.json({ error }, { status: 422 });

  try {
    const result = await provisionOrganization(body as ProvisionInput);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = String((err.meta as { target?: string[] } | undefined)?.target ?? "");
      const message = target.includes("email")
        ? "بريد المشرف مستخدم بالفعل في جهة أخرى"
        : "المعرّف مستخدم بالفعل لجهة أخرى";
      return NextResponse.json({ error: message }, { status: 409 });
    }
    console.error("[platform/organizations]", err);
    return NextResponse.json({ error: "فشل تجهيز الجهة — لم يُحفظ أي شيء" }, { status: 500 });
  }
}
