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
      // وقت إصدار التوقيع — يُقارن بـ passwordChangedAt لإبطال الجلسات القديمة.
      // قد يصل نصاً بعد عبور الجلسة عبر JSON.
      sessionIssuedAt?: Date | string;
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
    // وقت فتح الجلسة بالمللي ثانية — يُضبط مرة واحدة عند الدخول ويبقى.
    sessionIssuedAt?: number;
  }
}
