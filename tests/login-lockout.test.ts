import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { prisma } from "@/infrastructure/database/client";
import { verifyHRCredentials, verifyPlatformCredentials } from "@/infrastructure/auth/credentials.service";

// Tests for brute-force lockout: 5 wrong passwords → 15-minute lockout.

const HR_EMAIL = "salma.rashidi@mof.gov.sa";
const HR_PASSWORD = process.env.SEED_DEV_HR_PASSWORD ?? "change-me-dev-only";
const PLATFORM_EMAIL = "platform@nazaha.local";
const PLATFORM_PASSWORD = process.env.SEED_DEV_PLATFORM_PASSWORD ?? "change-me-platform-pw";

let hrUserId: string;

beforeAll(async () => {
  const u = await prisma.user.findUniqueOrThrow({ where: { email: HR_EMAIL }, select: { id: true } });
  hrUserId = u.id;
});

afterEach(async () => {
  // Reset counters after each test so tests are independent.
  await prisma.user.update({ where: { id: hrUserId }, data: { failedLoginAttempts: 0, lockedUntil: null } });
  await prisma.platformAdmin.updateMany({ where: { email: PLATFORM_EMAIL }, data: { failedLoginAttempts: 0, lockedUntil: null } });
});

afterAll(() => prisma.$disconnect());

describe("HR login lockout", () => {
  it("counts failed attempts and locks after 5 wrong passwords", async () => {
    for (let i = 0; i < 4; i++) {
      expect(await verifyHRCredentials(HR_EMAIL, "wrong-password")).toBeNull();
    }
    // 4 attempts — not yet locked, right password should work
    expect(await verifyHRCredentials(HR_EMAIL, HR_PASSWORD)).not.toBeNull();
  });

  it("rejects the correct password while locked", async () => {
    for (let i = 0; i < 5; i++) {
      await verifyHRCredentials(HR_EMAIL, "wrong-password");
    }
    // 5th attempt triggers lockout — correct password must now be rejected too
    expect(await verifyHRCredentials(HR_EMAIL, HR_PASSWORD)).toBeNull();
  });

  it("succeeds after lockout expires", async () => {
    // Simulate an expired lockout directly in DB
    await prisma.user.update({
      where: { id: hrUserId },
      data: { failedLoginAttempts: 5, lockedUntil: new Date(Date.now() - 1000) },
    });
    expect(await verifyHRCredentials(HR_EMAIL, HR_PASSWORD)).not.toBeNull();
  });

  it("resets the failure counter on a successful login", async () => {
    for (let i = 0; i < 3; i++) {
      await verifyHRCredentials(HR_EMAIL, "wrong-password");
    }
    await verifyHRCredentials(HR_EMAIL, HR_PASSWORD);
    const u = await prisma.user.findUniqueOrThrow({ where: { id: hrUserId }, select: { failedLoginAttempts: true } });
    expect(u.failedLoginAttempts).toBe(0);
  });
});

describe("Platform admin lockout", () => {
  it("locks the platform admin account after 5 wrong passwords", async () => {
    for (let i = 0; i < 5; i++) {
      await verifyPlatformCredentials(PLATFORM_EMAIL, "wrong-password");
    }
    expect(await verifyPlatformCredentials(PLATFORM_EMAIL, PLATFORM_PASSWORD)).toBeNull();
  });
});
