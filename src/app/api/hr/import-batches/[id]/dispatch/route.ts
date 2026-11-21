/**
 * POST /api/hr/import-batches/[id]/dispatch — invitation phase (SEPARATE from
 * the import itself; runs only after a terminal execution state).
 *
 * Body: { provisionNewAccounts?: boolean }
 *   - default false: existing accounts get the password-free notice; candidates
 *     with no account are reported as SKIPPED_NO_ACCOUNT (no account is ever
 *     created implicitly).
 *   - true: explicit opt-in to provision new accounts + mail credentials for
 *     the no-account items (still never touches existing passwords).
 *
 * UNKNOWN attempts are never auto-resent; they come back in `unknown`.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireHR } from "@/infrastructure/tenant";
import { dispatchBatchInvitations } from "@/infrastructure/services/import-invitation.service";

export const runtime = "nodejs";
export const maxDuration = 300;

interface Params { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  // Sending is privileged — same bar as approve/execute.
  const ctx = await requireHR({ roles: ["admin", "hr_manager"] });
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as { provisionNewAccounts?: unknown } | null;
  const provisionNewAccounts = body?.provisionNewAccounts === true;

  try {
    const result = await dispatchBatchInvitations(ctx.organizationId, id, {
      provisionNewAccounts,
      sentByUserId: ctx.userId,
    });
    if (!result.ok) {
      const status = result.error === "NOT_FOUND" ? 404 : 409;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ ...result, ok: true });
  } catch (e) {
    console.error("[import-batches/dispatch]", e);
    return NextResponse.json({ error: "تعذّر إرسال الدعوات" }, { status: 500 });
  }
}
