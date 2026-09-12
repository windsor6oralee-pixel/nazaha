import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { createHash } from "crypto";
import { prisma } from "@/infrastructure/database/client";
import { authConfig } from "./auth.config";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  providers: [
    /**
     * HR Provider — email + password
     * Validates against the users table with bcrypt.
     */
    Credentials({
      id: "hr-credentials",
      name: "HR Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: { role: true },
        });

        if (!user || !user.isActive) return null;

        const passwordMatch = await compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!passwordMatch) return null;

        // Update last login time
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        await prisma.auditLog.create({
          data: {
            actorType: "USER",
            action: "user.login",
            resource: "User",
            resourceId: user.id,
            userId: user.id,
          },
        });

        return {
          id: user.id,
          email: user.email,
          nameAr: user.nameAr,
          role: user.role.name,
          sessionType: "hr_user",
          organizationId: user.organizationId,
        } as any;
      },
    }),

    /**
     * Candidate Provider — magic link token
     * The token is the raw value from the URL.
     * We hash it and compare against VerificationToken.tokenHash.
     */
    Credentials({
      id: "candidate-token",
      name: "Candidate Magic Link",
      credentials: {
        token: { label: "Token", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.token) return null;

        const tokenHash = sha256(credentials.token as string);

        const verificationToken = await prisma.verificationToken.findUnique({
          where: { tokenHash },
          include: { candidate: true },
        });

        if (!verificationToken) return null;
        if (verificationToken.usedAt) return null; // already used
        if (verificationToken.expiresAt < new Date()) return null; // expired

        const candidate = verificationToken.candidate;

        // Get the active application
        const application = await prisma.application.findFirst({
          where: {
            candidateId: candidate.id,
            status: { notIn: ["COMPLETED", "WITHDRAWN", "REJECTED"] },
          },
          orderBy: { createdAt: "desc" },
        });

        // Mark token as used and update last access
        await prisma.$transaction([
          prisma.verificationToken.update({
            where: { id: verificationToken.id },
            data: { usedAt: new Date() },
          }),
          prisma.candidate.update({
            where: { id: candidate.id },
            data: { lastAccessAt: new Date() },
          }),
        ]);

        await prisma.auditLog.create({
          data: {
            actorType: "CANDIDATE",
            action: "candidate.login",
            resource: "Candidate",
            resourceId: candidate.id,
            candidateId: candidate.id,
            applicationId: application?.id,
          },
        });

        return {
          id: candidate.id,
          email: candidate.email,
          nameAr: candidate.nameAr,
          role: "candidate",
          sessionType: "candidate",
          organizationId: candidate.organizationId,
          applicationId: application?.id,
        } as any;
      },
    }),

    /**
     * Platform Admin Provider — operates the SaaS itself.
     * Separate table, no organizationId: never resolves to a tenant context.
     */
    Credentials({
      id: "platform-credentials",
      name: "Platform Admin Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const admin = await prisma.platformAdmin.findUnique({
          where: { email: (credentials.email as string).trim().toLowerCase() },
        });
        if (!admin || !admin.isActive) return null;

        const ok = await compare(credentials.password as string, admin.passwordHash);
        if (!ok) return null;

        await prisma.platformAdmin.update({
          where: { id: admin.id },
          data: { lastLoginAt: new Date() },
        });

        await prisma.auditLog.create({
          data: {
            actorType: "SYSTEM",
            action: "platform_admin.login",
            resource: "PlatformAdmin",
            resourceId: admin.id,
          },
        });

        return {
          id: admin.id,
          email: admin.email,
          nameAr: admin.nameAr,
          role: "platform_admin",
          sessionType: "platform_admin",
          organizationId: "",
        } as any;
      },
    }),
  ],
});
