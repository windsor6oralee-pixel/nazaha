import { describe, it, expect, afterAll } from "vitest";
import { createHash } from "node:crypto";
import { prisma } from "@/infrastructure/database/client";
import { sendInvitation, getLatestInvitation } from "@/infrastructure/services/invitation.service";
import { verifyCandidateToken } from "@/infrastructure/auth/credentials.service";
import { decrypt } from "@/lib/crypto";

// The invitation code HR sees in the profile must be the real code, stored only
// encrypted, and its displayed state must follow the token's lifecycle.

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

afterAll(async () => prisma.$disconnect());

describe("persistent invitation code", () => {
  it("stores an encrypted copy that decrypts to the code that was e-mailed", async () => {
    const cand = await prisma.candidate.findFirstOrThrow({ where: { organization: { slug: "mof" } } });
    const { rawToken } = await sendInvitation(cand.id);

    const row = await prisma.verificationToken.findUniqueOrThrow({ where: { tokenHash: sha256(rawToken) } });
    expect(row.tokenCiphertext).toBeTruthy();
    expect(row.tokenCiphertext).not.toContain(rawToken);      // never plaintext at rest
    expect(decrypt(row.tokenCiphertext!)).toBe(rawToken);

    const shown = await getLatestInvitation(cand.id);
    expect(shown).toMatchObject({ code: rawToken, status: "active", usedAt: null });
  });

  it("flips to 'used' once the candidate logs in with it", async () => {
    const cand = await prisma.candidate.findFirstOrThrow({ where: { organization: { slug: "mof" } } });
    const { rawToken } = await sendInvitation(cand.id);

    expect(await verifyCandidateToken(rawToken)).toMatchObject({ sessionType: "candidate" });

    const shown = await getLatestInvitation(cand.id);
    expect(shown?.status).toBe("used");
    expect(shown?.usedAt).toBeInstanceOf(Date);
  });

  it("re-sending rotates the code: the old one stops working, the new one is shown", async () => {
    const cand = await prisma.candidate.findFirstOrThrow({ where: { organization: { slug: "mof" } } });
    const first = await sendInvitation(cand.id);
    const second = await sendInvitation(cand.id);

    expect(second.rawToken).not.toBe(first.rawToken);
    expect(await verifyCandidateToken(first.rawToken)).toBeNull();
    expect((await getLatestInvitation(cand.id))?.code).toBe(second.rawToken);
  });
});
