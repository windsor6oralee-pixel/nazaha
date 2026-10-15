import { NextResponse } from "next/server";
import { checkHealth } from "@/infrastructure/health/health.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const status = await checkHealth();
  return NextResponse.json(status, { status: status.status === "ok" ? 200 : 503 });
}
