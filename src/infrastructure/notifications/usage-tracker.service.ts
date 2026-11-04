/**
 * Per-mailbox daily send counter — single source of truth for daily caps.
 *
 * The `date` column is a Postgres DATE (no time), so the natural "day" of a
 * row is the UTC day. Buckets reset implicitly at UTC midnight — no cron
 * needed. Increments use the `(organizationId, mailboxEmail, date)` unique
 * index so concurrent sends from parallel adapters can't lose counts.
 */
import { prisma } from "@/infrastructure/database/client";

export interface MailboxUsage {
  mailboxEmail: string;
  sentCount: number;
}

/** The UTC day the row for a "right now" send should live under. */
function utcDay(now = new Date()): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Count map of {email → sentCount today} for every mailbox the org used today. */
export async function getUsageMap(organizationId: string): Promise<Map<string, number>> {
  const rows = await prisma.mailboxDailyUsage.findMany({
    where: { organizationId, date: utcDay() },
    select: { mailboxEmail: true, sentCount: true },
  });
  return new Map(rows.map((r) => [r.mailboxEmail.toLowerCase(), r.sentCount]));
}

/**
 * Atomically bumps the "sent today" counter for a mailbox by `by` (default 1).
 * Uses upsert so the first send of the day lazily creates the row and the
 * second+ increment it under the composite unique key — no race window.
 * Returns the new count.
 */
export async function recordSend(organizationId: string, mailboxEmail: string, by = 1): Promise<number> {
  const date = utcDay();
  const email = mailboxEmail.toLowerCase();
  const row = await prisma.mailboxDailyUsage.upsert({
    where:  { organizationId_mailboxEmail_date: { organizationId, mailboxEmail: email, date } },
    update: { sentCount: { increment: by } },
    create: { organizationId, mailboxEmail: email, date, sentCount: by },
    select: { sentCount: true },
  });
  return row.sentCount;
}

/** All of today's rows for an org, usable directly by the HR widget. */
export async function listTodayUsage(organizationId: string): Promise<MailboxUsage[]> {
  const rows = await prisma.mailboxDailyUsage.findMany({
    where: { organizationId, date: utcDay() },
    select: { mailboxEmail: true, sentCount: true },
    orderBy: { mailboxEmail: "asc" },
  });
  return rows;
}
