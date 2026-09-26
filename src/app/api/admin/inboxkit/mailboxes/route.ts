import { NextResponse } from "next/server";
import { requireHR } from "@/infrastructure/tenant";
import { listInboxKitMailboxes } from "@/infrastructure/notifications/inboxkit.service";

export async function POST(req: Request) {
  const ctx = await requireHR({ roles: ["admin", "hr_manager"] });
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json().catch(() => ({}));
  const { apiKey, workspaceId } = body;

  if (!apiKey || !workspaceId) {
    return NextResponse.json({ error: "apiKey و workspaceId مطلوبان" }, { status: 400 });
  }

  try {
    const mailboxes = await listInboxKitMailboxes(apiKey, workspaceId);
    return NextResponse.json({ mailboxes });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "فشل جلب صناديق البريد" },
      { status: 502 }
    );
  }
}
