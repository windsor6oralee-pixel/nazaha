import { NextRequest, NextResponse } from "next/server";
import { requireHR } from "@/infrastructure/tenant";
import { isLifecycleAction } from "@/infrastructure/applications/lifecycle";
import { LifecycleError, performLifecycleAction } from "@/infrastructure/applications/lifecycle.service";

interface Params { params: Promise<{ id: string }> }

// قرار يدوي على طلب: اعتماد، إكمال، رفض، انسحاب، إعادة فتح.
// الصلاحية لكل إجراء تُفحص في محرك الدورة (lifecycle.ts) لا هنا.
export async function POST(request: NextRequest, { params }: Params) {
  const ctx = await requireHR({ roles: ["admin", "hr_manager", "hr_officer"] });
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as { action?: unknown; reason?: unknown } | null;
  if (!body || !isLifecycleAction(body.action)) {
    return NextResponse.json({ error: "إجراء غير صالح" }, { status: 400 });
  }
  const reason = typeof body.reason === "string" ? body.reason.slice(0, 1000) : null;

  try {
    const result = await performLifecycleAction({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      role: ctx.role,
      applicationId: id,
      action: body.action,
      reason,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof LifecycleError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[applications/transition]", err);
    return NextResponse.json({ error: "تعذّر تنفيذ الإجراء" }, { status: 500 });
  }
}
