/**
 * DELETE /api/admin/documents/[id] — remove a document rule (by its id).
 * Only reachable by HR admin; the service double-checks the rule belongs
 * to this org's default-workflow step before deleting.
 */
import { NextResponse } from "next/server";
import { requireHR } from "@/infrastructure/tenant";
import { deleteDocumentRule } from "@/infrastructure/workflow/document-rules.service";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireHR({ roles: ["admin", "hr_manager"] });
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  await deleteDocumentRule(ctx.organizationId, id);
  return NextResponse.json({ ok: true });
}
