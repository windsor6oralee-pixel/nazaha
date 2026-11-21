/**
 * Round-robin adapter that rotates sends across a pool of SMTP mailboxes
 * while respecting a per-mailbox daily cap and a per-org sending policy.
 *
 * On each send:
 *   1. load today's counters from the usage tracker (cheap — one indexed query)
 *   2. pick the subset of mailboxes still under cap (and, in `overflow` mode,
 *      only admit overflow domains if primary consumption crossed threshold)
 *   3. round-robin inside that subset
 *   4. on success, bump that mailbox's counter atomically
 *
 * On SMTP error, the next mailbox in the ring is tried (up to maxAttempts).
 * If every eligible mailbox is exhausted or failing, the send throws so the
 * caller (batch runner / resend endpoint) can stop and surface the state.
 */
import type { NotificationProvider, EmailMessage } from "./notification.interface";
import type { SendingPolicy } from "./sending-policy.service";
import { pickEligibleMailboxes } from "./sending-policy.service";
import { getUsageMap, recordSend } from "./usage-tracker.service";

export interface PoolMailbox {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
}

export class MailboxPoolAdapter implements NotificationProvider {
  readonly isTransport = true;
  private cursor = 0;
  private transporters = new Map<string, import("nodemailer").Transporter>();

  constructor(
    private readonly pool: PoolMailbox[],
    /** Optional — when set, enables daily-cap enforcement and usage recording. */
    private readonly orgId?: string,
    /** Optional — if omitted, no cap is applied (fallback to pure round-robin). */
    private readonly policy?: SendingPolicy,
  ) {
    if (!pool.length) throw new Error("MailboxPoolAdapter requires ≥1 mailbox");
  }

  /** The e-mails sending will cycle through, in rotation order. */
  get senders(): string[] { return this.pool.map((m) => m.fromEmail); }
  get size(): number { return this.pool.length; }

  private async transporterFor(mb: PoolMailbox) {
    const cached = this.transporters.get(mb.fromEmail);
    if (cached) return cached;
    const nodemailer = await import("nodemailer");
    const t = nodemailer.createTransport({
      host:   mb.host,
      port:   mb.port,
      secure: mb.secure,
      auth:   { user: mb.user, pass: mb.pass },
    });
    this.transporters.set(mb.fromEmail, t);
    return t;
  }

  async send(message: EmailMessage): Promise<void> {
    const usage = this.orgId && this.policy ? await getUsageMap(this.orgId) : new Map<string, number>();
    const eligible = this.policy
      ? pickEligibleMailboxes(this.pool, this.policy, usage)
      : this.pool;

    if (!eligible.length) {
      throw new Error("لا توجد صناديق بريد متاحة للإرسال اليوم — تجاوز كل الصناديق سقفها اليومي");
    }

    const maxAttempts = Math.min(eligible.length, 3);
    let lastErr: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const mb = eligible[this.cursor % eligible.length];
      this.cursor = (this.cursor + 1) % eligible.length;
      try {
        const t = await this.transporterFor(mb);
        await t.sendMail({
          from:    `${mb.fromName} <${mb.fromEmail}>`,
          to:      message.to,
          subject: message.subject,
          html:    message.html,
          text:    message.text,
        });
        if (this.orgId) await recordSend(this.orgId, mb.fromEmail);
        return;
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("all eligible mailboxes failed");
  }
}
