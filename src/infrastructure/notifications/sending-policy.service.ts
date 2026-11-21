/**
 * Per-org sending policy: which InboxKit domains this tenant is allowed to
 * send through, and how to combine them.
 *
 * Stored as ONE JSON blob in SystemSetting (key: `sending_policy`). Platform
 * admins own the policy — org admins see it read-only. If no policy exists,
 * the system defaults to using every mailbox in the org's pool (back-compat).
 */
import { prisma } from "../database/client";

const KEY = "sending_policy";

export type SendingMode = "exclusive" | "overflow" | "shared";

export interface SendingPolicy {
  mode: SendingMode;
  /** Domains always eligible to send. */
  primary: string[];
  /** Domains added to the pool for `overflow` / `shared` modes. */
  overflow: string[];
  /** Domains that must never send for this org, overriding everything else. */
  excluded: string[];
  /** Hard ceiling of outgoing mails per mailbox per UTC day. */
  dailyCapPerMailbox: number;
  /** Primary-pool consumption at which `overflow` mode starts admitting overflow mailboxes (0–100). */
  overflowThresholdPercent: number;
}

export const DEFAULT_POLICY: SendingPolicy = {
  mode: "shared",
  primary: [],
  overflow: [],
  excluded: [],
  dailyCapPerMailbox: 400,
  overflowThresholdPercent: 70,
};

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function normalize(input: Partial<SendingPolicy>): SendingPolicy {
  const dedup = (xs: unknown): string[] =>
    Array.isArray(xs) ? Array.from(new Set(xs.filter((x): x is string => typeof x === "string" && x.length > 0).map((x) => x.toLowerCase()))) : [];
  const mode: SendingMode = input.mode === "exclusive" || input.mode === "overflow" || input.mode === "shared"
    ? input.mode : "shared";
  return {
    mode,
    primary:  dedup(input.primary),
    overflow: dedup(input.overflow),
    excluded: dedup(input.excluded),
    dailyCapPerMailbox:       clampInt(input.dailyCapPerMailbox,       10,  2000, DEFAULT_POLICY.dailyCapPerMailbox),
    overflowThresholdPercent: clampInt(input.overflowThresholdPercent,  0,   100, DEFAULT_POLICY.overflowThresholdPercent),
  };
}

export async function getSendingPolicy(organizationId: string): Promise<SendingPolicy> {
  const row = await prisma.systemSetting.findUnique({
    where: { organizationId_key: { organizationId, key: KEY } },
  });
  if (!row?.value) return DEFAULT_POLICY;
  try {
    return normalize(JSON.parse(row.value) as Partial<SendingPolicy>);
  } catch {
    return DEFAULT_POLICY;
  }
}

export async function saveSendingPolicy(organizationId: string, policy: Partial<SendingPolicy>): Promise<SendingPolicy> {
  const normalized = normalize(policy);
  await prisma.systemSetting.upsert({
    where:  { organizationId_key: { organizationId, key: KEY } },
    update: { value: JSON.stringify(normalized) },
    create: { organizationId, key: KEY, value: JSON.stringify(normalized) },
  });
  return normalized;
}

/** Parses the sending domain out of an e-mail address (lowercased). */
export function domainOf(email: string): string {
  const at = email.lastIndexOf("@");
  return at === -1 ? "" : email.slice(at + 1).toLowerCase();
}

/**
 * Decides which mailboxes from a pool are eligible for a send, given the policy.
 * Order matters: primary mailboxes come first in the returned list, so the
 * pool adapter's round-robin rotates through them before touching overflow.
 */
export function filterPoolByPolicy<T extends { fromEmail: string }>(pool: T[], policy: SendingPolicy): T[] {
  const inSet = (set: string[], d: string) => set.includes(d);
  const notExcluded = (m: T) => !inSet(policy.excluded, domainOf(m.fromEmail));

  const primaryList  = pool.filter((m) => notExcluded(m) && inSet(policy.primary, domainOf(m.fromEmail)));
  const overflowList = pool.filter((m) => notExcluded(m) && !inSet(policy.primary, domainOf(m.fromEmail)) && inSet(policy.overflow, domainOf(m.fromEmail)));

  switch (policy.mode) {
    case "exclusive":
      // Primary only. Falls back to the full non-excluded pool if primary is empty
      // so a mis-configuration doesn't silently disable sending for the tenant.
      return primaryList.length ? primaryList : pool.filter(notExcluded);
    case "overflow":
      // Primary first in rotation order; overflow mailboxes join at the end.
      return primaryList.length ? [...primaryList, ...overflowList] : [...overflowList, ...pool.filter(notExcluded)];
    case "shared":
    default:
      // Everything non-excluded, with primary rotating first for brand consistency.
      if (!primaryList.length && !overflowList.length) return pool.filter(notExcluded);
      return [...primaryList, ...overflowList, ...pool.filter((m) => notExcluded(m) && !inSet(policy.primary, domainOf(m.fromEmail)) && !inSet(policy.overflow, domainOf(m.fromEmail)))];
  }
}

/** The sorted list of unique domains present in a mailbox pool. */
export function domainsIn<T extends { fromEmail: string }>(pool: T[]): string[] {
  return Array.from(new Set(pool.map((m) => domainOf(m.fromEmail)))).sort();
}

/**
 * Combines policy filtering with today's usage to produce the *effective* send
 * pool for a batch: cap-exhausted mailboxes are dropped; `overflow` mode holds
 * the overflow mailboxes back until primary consumption crosses the threshold.
 *
 * `usage` maps lowercased mailboxEmail → sentCount today.
 */
export function pickEligibleMailboxes<T extends { fromEmail: string }>(
  pool: T[],
  policy: SendingPolicy,
  usage: Map<string, number>,
): T[] {
  const cap = policy.dailyCapPerMailbox;
  const under = (m: T) => (usage.get(m.fromEmail.toLowerCase()) ?? 0) < cap;

  const byPolicy = filterPoolByPolicy(pool, policy);
  const inSet = (set: string[], d: string) => set.includes(d);
  const primary = byPolicy.filter((m) => inSet(policy.primary, domainOf(m.fromEmail)));
  const rest    = byPolicy.filter((m) => !inSet(policy.primary, domainOf(m.fromEmail)));

  const primaryAlive = primary.filter(under);
  const restAlive    = rest.filter(under);

  if (policy.mode === "overflow" && primaryAlive.length) {
    // How "full" is the primary half of the policy pool today?
    const primaryUsed = primary.reduce((acc, m) => acc + Math.min(cap, usage.get(m.fromEmail.toLowerCase()) ?? 0), 0);
    const primaryCap  = primary.length * cap;
    const pct = primaryCap > 0 ? (primaryUsed / primaryCap) * 100 : 0;
    return pct < policy.overflowThresholdPercent ? primaryAlive : [...primaryAlive, ...restAlive];
  }
  return [...primaryAlive, ...restAlive];
}

/** Summary numbers for an org's send capacity today. Used by the HR widget. */
export function summarizeCapacity<T extends { fromEmail: string }>(
  pool: T[],
  policy: SendingPolicy,
  usage: Map<string, number>,
): {
  cap: number;
  used: number;
  totalCap: number;
  remaining: number;
  byDomain: Array<{ domain: string; used: number; cap: number; mailboxes: number }>;
} {
  const cap = policy.dailyCapPerMailbox;
  const effective = filterPoolByPolicy(pool, policy);
  const totalCap = effective.length * cap;
  const used = effective.reduce((acc, m) => acc + Math.min(cap, usage.get(m.fromEmail.toLowerCase()) ?? 0), 0);
  const byDomainMap = new Map<string, { used: number; mailboxes: number }>();
  for (const m of effective) {
    const d = domainOf(m.fromEmail);
    const entry = byDomainMap.get(d) ?? { used: 0, mailboxes: 0 };
    entry.used     += Math.min(cap, usage.get(m.fromEmail.toLowerCase()) ?? 0);
    entry.mailboxes += 1;
    byDomainMap.set(d, entry);
  }
  const byDomain = [...byDomainMap.entries()].map(([domain, v]) => ({
    domain,
    used: v.used,
    cap:  v.mailboxes * cap,
    mailboxes: v.mailboxes,
  })).sort((a, b) => a.domain.localeCompare(b.domain));
  return { cap, used, totalCap, remaining: Math.max(0, totalCap - used), byDomain };
}
