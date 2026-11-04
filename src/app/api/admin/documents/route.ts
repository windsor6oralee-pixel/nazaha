/**
 * GET  /api/admin/documents — list the HR-managed document rules for this org
 * POST /api/admin/documents — add or update one rule (upsert by documentType)
 *
 * The data lives in WorkflowStepDocument rows under the org's default workflow.
 * Changes affect NEW candidates only — existing applications keep their already-
 * generated Document rows so nothing a candidate uploaded is lost or re-asked.
 */
import { NextResponse } from "next/server";
import { requireHR } from "@/infrastructure/tenant";
import {
  listDocumentRules,
  upsertDocumentRule,
  DOCUMENT_CATALOG,
  type DocumentTypeCode,
} from "@/infrastructure/workflow/document-rules.service";

const ADMIN_ROLES = ["admin", "hr_manager"];

export async function GET() {
  const ctx = await requireHR({ roles: ADMIN_ROLES });
  if (ctx instanceof NextResponse) return ctx;

  const rules = await listDocumentRules(ctx.organizationId);
  return NextResponse.json({ rules, catalog: DOCUMENT_CATALOG });
}

export async function POST(req: Request) {
  const ctx = await requireHR({ roles: ADMIN_ROLES });
  if (ctx instanceof NextResponse) return ctx;

  const body = (await req.json().catch(() => ({}))) as {
    documentType?: string;
    nameAr?: string;
    isRequired?: boolean;
    maxFileSizeMb?: number;
    allowedMimeTypes?: string[];
    maxFileCount?: number;
    requiresReview?: boolean;
    notes?: string | null;
    externalActionUrl?: string | null;
    externalActionLabel?: string | null;
    externalFeeLabel?: string | null;
    externalFeeAmount?: number | null;
    externalFeeCurrency?: string | null;
    askBeforeUpload?: boolean;
  };
  if (!body.documentType) return NextResponse.json({ error: "documentType مطلوب" }, { status: 400 });

  const rule = await upsertDocumentRule(ctx.organizationId, {
    documentType: body.documentType as DocumentTypeCode,
    nameAr: body.nameAr,
    isRequired: body.isRequired,
    maxFileSizeMb: body.maxFileSizeMb,
    allowedMimeTypes: body.allowedMimeTypes,
    maxFileCount: body.maxFileCount,
    requiresReview: body.requiresReview,
    notes: body.notes ?? null,
    externalActionUrl:   body.externalActionUrl,
    externalActionLabel: body.externalActionLabel,
    externalFeeLabel:    body.externalFeeLabel,
    externalFeeAmount:   body.externalFeeAmount,
    externalFeeCurrency: body.externalFeeCurrency,
    askBeforeUpload:     body.askBeforeUpload,
  });
  return NextResponse.json({ rule });
}
