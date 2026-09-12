import type { NotificationProvider } from "./notification.interface";
import { ConsoleAdapter } from "./console.adapter";

let _instance: NotificationProvider | null = null;

/** Returns the org-agnostic notifier (env-based, for backward compat) */
export function getNotifier(): NotificationProvider {
  if (_instance) return _instance;

  const provider = process.env.NOTIFICATION_PROVIDER ?? "console";

  if (provider === "smtp") {
    const { SmtpAdapter } = require("./smtp.adapter") as typeof import("./smtp.adapter");
    _instance = new SmtpAdapter({
      host:   process.env.SMTP_HOST!,
      port:   Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      user:   process.env.SMTP_USER!,
      pass:   process.env.SMTP_PASS!,
      from:   process.env.SMTP_FROM ?? "نزاهة التوظيف <no-reply@nazaha.gov.sa>",
    });
  } else {
    _instance = new ConsoleAdapter();
  }

  return _instance;
}

/**
 * Returns a notifier configured from the org's DB-stored SMTP settings.
 * Falls back to ConsoleAdapter when SMTP is not configured for this org.
 */
export async function getOrgNotifier(organizationId: string): Promise<NotificationProvider> {
  const { getSmtpConfig } = await import("./smtp-config.service");
  const config = await getSmtpConfig(organizationId);

  if (!config) return new ConsoleAdapter();

  const { SmtpAdapter } = await import("./smtp.adapter");
  return new SmtpAdapter({
    host:   config.host,
    port:   config.port,
    secure: config.secure,
    user:   config.user,
    pass:   config.pass,
    from:   `${config.fromName} <${config.fromEmail}>`,
  });
}

export type { NotificationProvider, EmailMessage } from "./notification.interface";
export * as templates from "./templates";
