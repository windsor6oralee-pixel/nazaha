import { prisma } from "@/infrastructure/database/client";

export interface HealthStatus {
  status: "ok" | "error";
  timestamp: string;
  database: "connected" | "disconnected";
  uptime: number;
  error?: string;
}

export async function checkHealth(): Promise<HealthStatus> {
  const timestamp = new Date().toISOString();
  const uptime = Math.round(process.uptime());

  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok", timestamp, database: "connected", uptime };
  } catch (error) {
    const detail =
      process.env.NODE_ENV === "production"
        ? undefined
        : error instanceof Error
          ? error.message
          : String(error);

    return {
      status: "error",
      timestamp,
      database: "disconnected",
      uptime,
      ...(detail ? { error: detail } : {}),
    };
  }
}
