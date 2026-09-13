import { NextResponse } from "next/server";
import { getTenantContext } from "@/infrastructure/tenant";
import { getStorage } from "@/infrastructure/storage";
import { getOrganizationLogoPath } from "@/infrastructure/services/organization.service";

const CONTENT_TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg" };

// Serves the caller's own organization logo. The `v` query param is a cache-buster only.
export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx) return new NextResponse("غير مصرح", { status: 401 });

  const logoPath = await getOrganizationLogoPath(ctx.organizationId);
  if (!logoPath) return new NextResponse("لا يوجد شعار", { status: 404 });

  const result = await getStorage().stream(logoPath);
  if (!result) return new NextResponse("لا يوجد شعار", { status: 404 });

  const ext = logoPath.split(".").pop() ?? "";
  const webStream = new ReadableStream({
    start(controller) {
      result.stream.on("data", (chunk) => controller.enqueue(chunk));
      result.stream.on("end", () => controller.close());
      result.stream.on("error", (err) => controller.error(err));
    },
  });

  return new NextResponse(webStream, {
    headers: {
      "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
