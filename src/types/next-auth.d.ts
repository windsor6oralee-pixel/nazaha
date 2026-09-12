import type { DefaultSession, DefaultJWT } from "next-auth";

export type SessionType = "hr_user" | "candidate" | "platform_admin";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      nameAr: string;
      role: string;
      sessionType: SessionType;
      // Empty string for platform admins — they have no tenant.
      organizationId: string;
      applicationId?: string;
    } & DefaultSession["user"];
  }

  interface User {
    nameAr: string;
    role: string;
    sessionType: SessionType;
    organizationId: string;
    applicationId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    nameAr: string;
    role: string;
    sessionType: SessionType;
    organizationId: string;
    applicationId?: string;
  }
}
