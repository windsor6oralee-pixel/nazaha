/**
 * Reads SMTP configuration from SystemSetting (per-organization) and
 * decrypts the stored password. Returns null if not configured.
 */
import { prisma } from "@/infrastructure/database/client";
import { decrypt } from "@/lib/crypto";

export interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
}

const KEYS = ["smtp_host", "smtp_port", "smtp_secure", "smtp_user", "smtp_pass_enc", "smtp_from_email", "smtp_from_name"] as const;

export async function getSmtpConfig(organizationId: string): Promise<SmtpSettings | null> {
  const rows = await prisma.systemSetting.findMany({
    where: { organizationId, key: { in: [...KEYS] } },
  });

  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  if (!map.smtp_host || !map.smtp_user || !map.smtp_pass_enc) return null;

  return {
    host:      map.smtp_host,
    port:      Number(map.smtp_port ?? "587"),
    secure:    map.smtp_secure === "true",
    user:      map.smtp_user,
    pass:      decrypt(map.smtp_pass_enc),
    fromEmail: map.smtp_from_email ?? map.smtp_user,
    fromName:  map.smtp_from_name ?? "نزاهة التوظيف",
  };
}

export async function saveSmtpConfig(
  organizationId: string,
  settings: Omit<SmtpSettings, "pass"> & { pass?: string; passEnc?: string }
): Promise<void> {
  const { encrypt } = await import("@/lib/crypto");

  const entries: Record<string, string> = {
    smtp_host:       settings.host,
    smtp_port:       String(settings.port),
    smtp_secure:     String(settings.secure),
    smtp_user:       settings.user,
    smtp_from_email: settings.fromEmail,
    smtp_from_name:  settings.fromName,
  };

  if (settings.pass) {
    entries.smtp_pass_enc = encrypt(settings.pass);
  } else if (settings.passEnc) {
    entries.smtp_pass_enc = settings.passEnc;
  }

  await prisma.$transaction(
    Object.entries(entries).map(([key, value]) =>
      prisma.systemSetting.upsert({
        where: { organizationId_key: { organizationId, key } },
        update: { value },
        create: { organizationId, key, value },
      })
    )
  );
}

export async function deleteSmtpConfig(organizationId: string): Promise<void> {
  await prisma.systemSetting.deleteMany({
    where: { organizationId, key: { in: [...KEYS] } },
  });
}
