import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { prisma } from "@/infrastructure/database/client";
import {
  verifyHRCredentials,
  verifyCandidateToken,
  isPrincipalActive,
  resetLivenessCache,
} from "@/infrastructure/auth/credentials.service";

// Closes Vuln 3: suspending an organization (or a user) must lock out logins
// immediately AND invalidate live sessions on their next request.

const HR_EMAIL = "salma.rashidi@mof.gov.sa";
const HR_PASSWORD = process.env.SEED_DEV_HR_PASSWORD ?? "change-me-dev-only";
const CANDIDATE_TOKEN = process.env.SEED_DEV_CANDIDATE_TOKEN ?? "dev-magic-token-ahmed-2026";

let orgId: string;
let userId: string;
let candidateId: string;

async function setOrgActive(active: boolean) {
  await prisma.organization.update({ where: { id: orgId }, data: { isActive: active } });
  resetLivenessCache();
}
async function setUserActive(active: boolean) {
  await prisma.user.update({ where: { id: userId }, data: { isActive: active } });
  resetLivenessCache();
}
// The seeded magic token is single-use; re-arm it so the candidate login can be exercised.
async function rearmCandidateToken() {
  const { createHash } = await import("node:crypto");
  const tokenHash = createHash("sha256").update(CANDIDATE_TOKEN).digest("hex");
  await prisma.verificationToken.updateMany({ where: { tokenHash }, data: { usedAt: null, expiresAt: new Date(Date.now() + 86_400_000) } });
}

beforeAll(async () => {
  const user = await prisma.user.findUniqueOrThrow({ where: { email: HR_EMAIL }, select: { id: true, organizationId: true } });
  orgId = user.organizationId;
  userId = user.id;
  candidateId = (await prisma.candidate.findFirstOrThrow({ where: { organizationId: orgId, nationalId: "1098765432" } })).id;
});

afterEach(async () => {
  await setOrgActive(true);
  await setUserActive(true);
  await rearmCandidateToken();
});

afterAll(async () => prisma.$disconnect());

describe("login", () => {
  it("HR login works for an active user in an active organization", async () => {
    expect(await verifyHRCredentials(HR_EMAIL, HR_PASSWORD)).toMatchObject({ sessionType: "hr_user", organizationId: orgId });
  });

  it("HR login is refused when the organization is suspended", async () => {
    await setOrgActive(false);
    expect(await verifyHRCredentials(HR_EMAIL, HR_PASSWORD)).toBeNull();
  });

  it("HR login is refused when the user is deactivated", async () => {
    await setUserActive(false);
    expect(await verifyHRCredentials(HR_EMAIL, HR_PASSWORD)).toBeNull();
  });

  it("HR login is refused for a wrong password (no throw)", async () => {
    expect(await verifyHRCredentials(HR_EMAIL, "definitely-wrong")).toBeNull();
  });

  it("candidate magic-link login is refused when the organization is suspended", async () => {
    await rearmCandidateToken();
    await setOrgActive(false);
    expect(await verifyCandidateToken(CANDIDATE_TOKEN)).toBeNull();
    // The token must NOT have been consumed by the refused attempt.
    const { createHash } = await import("node:crypto");
    const t = await prisma.verificationToken.findUniqueOrThrow({ where: { tokenHash: createHash("sha256").update(CANDIDATE_TOKEN).digest("hex") } });
    expect(t.usedAt).toBeNull();
  });

  it("candidate magic-link login works and is single-use", async () => {
    await rearmCandidateToken();
    expect(await verifyCandidateToken(CANDIDATE_TOKEN)).toMatchObject({ sessionType: "candidate", organizationId: orgId });
    expect(await verifyCandidateToken(CANDIDATE_TOKEN)).toBeNull();
  });
});

describe("live sessions", () => {
  it("an existing HR session dies when the organization is suspended", async () => {
    const principal = { sessionType: "hr_user" as const, id: userId, organizationId: orgId };
    expect(await isPrincipalActive(principal)).toBe(true);
    await setOrgActive(false);
    expect(await isPrincipalActive(principal)).toBe(false);
  });

  it("an existing HR session dies when the user is deactivated", async () => {
    const principal = { sessionType: "hr_user" as const, id: userId, organizationId: orgId };
    await setUserActive(false);
    expect(await isPrincipalActive(principal)).toBe(false);
  });

  it("an existing candidate session dies when the organization is suspended", async () => {
    const principal = { sessionType: "candidate" as const, id: candidateId, organizationId: orgId };
    expect(await isPrincipalActive(principal)).toBe(true);
    await setOrgActive(false);
    expect(await isPrincipalActive(principal)).toBe(false);
  });

  it("a session whose organizationId claim does not match the database is rejected", async () => {
    expect(await isPrincipalActive({ sessionType: "hr_user", id: userId, organizationId: "some-other-org" })).toBe(false);
  });

  it("platform admins are not subject to tenant liveness", async () => {
    expect(await isPrincipalActive({ sessionType: "platform_admin", id: "x", organizationId: "" })).toBe(true);
  });
});
