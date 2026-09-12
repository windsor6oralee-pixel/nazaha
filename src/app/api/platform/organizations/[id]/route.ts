import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/infrastructure/tenant";
import { setOrganizationActive } from "@/infrastructure/platform/provisioning.service";

interface Params { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Params) {
  const ctx = await requirePlatformAdmin();
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;

  const body = (await req.json().catch(() => null)) as { isActive?: unknown } | null;
  if (!body || typeof body.isActive !== "boolean") {
    return NextResponse.json({ error: "isActive مطلوب" }, { status: 400 });
  }

  try {
    const org = await setOrganizationActive(id, body.isActive);
    return NextResponse.json(org);
  } catch {
    return NextResponse.json({ error: "الجهة غير موجودة" }, { status: 404 });
  }
}
