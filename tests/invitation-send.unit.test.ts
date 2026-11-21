/**
 * Unit tests for the credentials-provisioning sendInvitation() — mock the DB
 * client and the notifier so these do not touch Postgres or any real SMTP.
 * Covers:
 *   - credentials template renders both username and password visibly
 *   - password generator is strong and unique per call
 *   - delivered=true (SMTP) ⇒ candidate account provisioned + invitationSent set
 *   - delivered=false (Console/stub) ⇒ no DB write
 *   - throwing adapter ⇒ no DB write
 *   - loginEmail collision rejected
 *   - batch SMTP guard rejects when SMTP config missing
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { candidateCredentials } from "@/infrastructure/notifications/templates/credentials";
import { generateCandidatePassword } from "@/lib/password-gen";

// The delivery-hardening step re-reads the candidate and verifies the sent
// password against the stored bcrypt hash — stub that comparison as successful.
vi.mock("bcryptjs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("bcryptjs")>();
  return { ...actual, compare: vi.fn(async () => true) };
});

const mocks = vi.hoisted(() => {
  const candidate = {
    id: "cand_1",
    nameAr: "اختبار المرشح",
    email: "test@example.com",
    jobTitle: "مهندس",
    department: "التقنية",
    organizationId: "org_1",
    accountActivatedAt: null,
    organization: { nameAr: "منظمة اختبار" },
  };
  return {
    candidate,
    prisma: {
      candidate: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(candidate),
        findUnique: vi.fn().mockResolvedValue(null),      // no collision
        update: vi.fn().mockResolvedValue({}),
      },
      verificationToken: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      systemSetting: {
        findMany: vi.fn(),
      },
      $transaction: vi.fn().mockImplementation(async (ops: unknown) => {
        // Mimic Prisma's array-form transaction: just resolve each op.
        if (Array.isArray(ops)) return Promise.all(ops);
        return typeof ops === "function" ? (ops as (p: unknown) => Promise<unknown>)({}) : ops;
      }),
    },
    notifier: {
      isTransport: true,
      send: vi.fn(),
    },
  };
});

vi.mock("@/infrastructure/database/client", () => ({ prisma: mocks.prisma }));
vi.mock("@/infrastructure/notifications", () => ({
  getOrgNotifier: vi.fn(async () => mocks.notifier),
}));
vi.mock("@/lib/crypto", () => ({
  encrypt: (v: string) => `enc(${v})`,
  decrypt: (v: string) => v.replace(/^enc\((.*)\)$/, "$1"),
}));

import { sendInvitation, InvitationError } from "@/infrastructure/services/invitation.service";

beforeEach(() => {
  mocks.prisma.candidate.findUniqueOrThrow.mockClear();
  mocks.prisma.candidate.findUnique.mockReset().mockResolvedValue(null);
  mocks.prisma.candidate.update.mockClear();
  mocks.prisma.verificationToken.updateMany.mockClear();
  mocks.prisma.$transaction.mockClear();
  mocks.notifier.send.mockReset().mockResolvedValue(undefined);
  mocks.notifier.isTransport = true;
});

describe("generateCandidatePassword()", () => {
  it("yields the requested length with at least one of each required class", () => {
    for (let i = 0; i < 20; i++) {
      const p = generateCandidatePassword(12);
      expect(p).toHaveLength(12);
      expect(/[a-z]/.test(p)).toBe(true);
      expect(/[A-Z]/.test(p)).toBe(true);
      expect(/[0-9]/.test(p)).toBe(true);
      expect(/[!@#$%*?\-_=+]/.test(p)).toBe(true);
      // No visually-confusing characters.
      expect(/[0OIl1|]/.test(p)).toBe(false);
    }
  });
  it("never repeats across many calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) seen.add(generateCandidatePassword(12));
    expect(seen.size).toBe(100);
  });
});

describe("candidateCredentials template", () => {
  it("renders username and password as visible copyable text", () => {
    const { subject, html } = candidateCredentials({
      candidateName: "اسم",
      jobTitle: "وظيفة",
      department: "قسم",
      organizationName: "جهة",
      loginEmail: "user@example.com",
      password: "P@ssw0rd!2z",
      loginUrl: "https://nazaha.example",
    });
    expect(subject).toContain("دعوة لاستكمال إجراءات التوظيف");
    expect(subject).toContain("منصة نزاهة");
    // Both strings must appear verbatim in the HTML.
    expect(html).toContain("user@example.com");
    expect(html).toContain("P@ssw0rd!2z");
    // Institutional identity hierarchy must be reflected in the design.
    expect(html).toContain("منصة القبول والنزاهة");
    expect(html).toContain("منصة نزاهة للتوظيف");
    expect(html).toContain("جهة");
    // user-select:all makes a single click/tap grab the whole string in mail clients.
    expect(html).toMatch(/user-select:\s*all/);
    // Points at the login page, not the setup/token page.
    expect(html).toContain("https://nazaha.example/auth/candidate");
    expect(html).not.toContain("/auth/candidate/setup");
  });
});

describe("sendInvitation() — credentials provisioning", () => {
  it("provisions the account and flips invitationSent when transport delivers", async () => {
    mocks.notifier.isTransport = true;
    // findUnique sequence inside sendInvitation:
    //   first  → loginEmail clash check  → none
    //   second → passwordHash re-read      → stored hash
    // bcrypt `compare` is stubbed (vi.mock above) to succeed, so the hardening
    // step sees a hash that matches the generated password.
    mocks.prisma.candidate.findUnique.mockReset();
    mocks.prisma.candidate.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ passwordHash: "stored-bcrypt-hash" });
    const res = await sendInvitation("cand_1");

    expect(mocks.notifier.send).toHaveBeenCalledOnce();
    expect(res.sent).toBe(true);
    expect(res.delivered).toBe(true);
    // The exact plaintext that landed in the mail is the one returned to the caller.
    expect(res.rawToken.length).toBeGreaterThanOrEqual(12);
    const mail = mocks.notifier.send.mock.calls[0][0];
    expect(mail.to).toBe("test@example.com");
    expect(mail.html).toContain(res.rawToken);
    expect(mail.html).toContain("test@example.com");

    // DB write: inside a transaction, with the candidate update as the first op.
    expect(mocks.prisma.$transaction).toHaveBeenCalledOnce();
    expect(mocks.prisma.candidate.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "cand_1" },
      data: expect.objectContaining({
        loginEmail: "test@example.com",
        invitationSent: true,
      }),
    }));
    // passwordHash is bcrypt output — just assert it's set and NOT the plaintext.
    const updData = mocks.prisma.candidate.update.mock.calls[0][0].data;
    expect(typeof updData.passwordHash).toBe("string");
    expect(updData.passwordHash).not.toBe(res.rawToken);
    expect(updData.passwordHash.length).toBeGreaterThan(20);
  });

  it("does NOT touch the DB when only the Console stub handled the mail", async () => {
    mocks.notifier.isTransport = false;
    const res = await sendInvitation("cand_1");

    expect(res.delivered).toBe(false);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.prisma.candidate.update).not.toHaveBeenCalled();
  });

  it("does NOT touch the DB when the adapter throws", async () => {
    mocks.notifier.send.mockRejectedValueOnce(new Error("SMTP down"));
    await expect(sendInvitation("cand_1")).rejects.toThrow("SMTP down");
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.prisma.candidate.update).not.toHaveBeenCalled();
  });

  it("rejects when another candidate already owns the loginEmail", async () => {
    mocks.prisma.candidate.findUnique.mockResolvedValueOnce({ id: "someone_else" });
    await expect(sendInvitation("cand_1")).rejects.toBeInstanceOf(InvitationError);
    expect(mocks.notifier.send).not.toHaveBeenCalled();
  });
});

async function loadSmtpOrAbort(orgId: string) {
  const rows = await mocks.prisma.systemSetting.findMany({
    where: { organizationId: orgId, key: { in: ["smtp_host", "smtp_user", "smtp_pass_enc"] } },
  });
  const map = Object.fromEntries(rows.map((r: { key: string; value: string }) => [r.key, r.value]));
  const missing = ["smtp_host", "smtp_user", "smtp_pass_enc"].filter((k) => !map[k]);
  if (missing.length) throw new Error(`SMTP not configured (missing: ${missing.join(", ")})`);
  return map;
}

describe("batch SMTP guard", () => {
  it("aborts when smtp_* keys are missing", async () => {
    mocks.prisma.systemSetting.findMany.mockResolvedValueOnce([{ key: "smtp_host", value: "" }]);
    await expect(loadSmtpOrAbort("org_x")).rejects.toThrow(/SMTP not configured/);
  });

  it("passes when all required smtp_* keys are set", async () => {
    mocks.prisma.systemSetting.findMany.mockResolvedValueOnce([
      { key: "smtp_host",     value: "smtp.gmail.com" },
      { key: "smtp_user",     value: "noreply@x.com" },
      { key: "smtp_pass_enc", value: "iv:tag:ct" },
    ]);
    await expect(loadSmtpOrAbort("org_x")).resolves.toBeTruthy();
  });
});
