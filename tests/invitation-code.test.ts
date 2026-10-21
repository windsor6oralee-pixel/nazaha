import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHash } from "node:crypto";
import { prisma } from "@/infrastructure/database/client";
import { sendInvitation, getLatestInvitation } from "@/infrastructure/services/invitation.service";
import { activateCandidateAccount } from "@/infrastructure/auth/credentials.service";
import { decrypt } from "@/lib/crypto";

// The invitation code HR sees in the profile must be the real code, stored only
// encrypted, and its displayed state must follow the token's lifecycle.
//
// The code is an activation code: it turns into a permanent account once, then
// stops working.

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
const PASSWORD = "InvitationPass2026!";

let candidateId: string;
let candidateEmail: string;

beforeAll(async () => {
  // سمة اختبار ثابتة: تفعيل الحساب يكتب سجلّ تدقيق، وسجلّ التدقيق غير
  // قابل للحذف — فلا يمكن حذف المرشح بعده. تبقى السمة بين التشغيلات.
  const org = await prisma.organization.findFirstOrThrow({
    where: { slug: "mof" },
    select: { id: true },
  });
  const workflow = await prisma.workflow.findFirstOrThrow({
    where: { organizationId: org.id },
    select: { id: true },
  });

  candidateEmail = "invitation-code-test@nazaha.local";
  const candidate = await prisma.candidate.upsert({
    where: { organizationId_nationalId: { organizationId: org.id, nationalId: "900000010" } },
    update: { email: candidateEmail },
    create: {
      nationalId: "900000010",
      nameAr: "مرشح اختبار رمز الدعوة",
      email: candidateEmail,
      jobTitle: "اختبار",
      department: "اختبار",
      acceptanceDate: new Date(),
      organizationId: org.id,
    },
    select: { id: true },
  });
  candidateId = candidate.id;

  const existing = await prisma.application.findFirst({
    where: { candidateId },
    select: { id: true },
  });
  if (!existing) {
    await prisma.application.create({
      data: {
        candidateId,
        organizationId: org.id,
        workflowId: workflow.id,
        status: "APPROVED",
      },
    });
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("persistent invitation code", () => {
  it("stores an encrypted copy that decrypts to the code that was e-mailed", async () => {
    const { rawToken } = await sendInvitation(candidateId);

    const row = await prisma.verificationToken.findUniqueOrThrow({ where: { tokenHash: sha256(rawToken) } });
    expect(row.tokenCiphertext).toBeTruthy();
    expect(row.tokenCiphertext).not.toContain(rawToken);      // never plaintext at rest
    expect(decrypt(row.tokenCiphertext!)).toBe(rawToken);

    const shown = await getLatestInvitation(candidateId);
    expect(shown).toMatchObject({ code: rawToken, status: "active", usedAt: null });
  });

  it("flips to 'used' once the candidate activates their account with it", async () => {
    const { rawToken } = await sendInvitation(candidateId);

    await activateCandidateAccount(rawToken, candidateEmail, PASSWORD);

    const shown = await getLatestInvitation(candidateId);
    expect(shown?.status).toBe("used");
    expect(shown?.usedAt).toBeInstanceOf(Date);
  });

  it("re-sending rotates the code: the old one stops working, the new one is shown", async () => {
    const first = await sendInvitation(candidateId);
    const second = await sendInvitation(candidateId);

    expect(second.rawToken).not.toBe(first.rawToken);
    await expect(
      activateCandidateAccount(first.rawToken, candidateEmail, PASSWORD),
    ).rejects.toMatchObject({ code: "INVALID_CODE" });
    expect((await getLatestInvitation(candidateId))?.code).toBe(second.rawToken);
  });
});
