/**
 * Auth config without Prisma imports.
 * Safe to import in middleware (Edge runtime).
 * The actual credential validation is in auth.ts.
 */
import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },

  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = !!auth?.user;

      // Candidate portal: requires 'candidate' session type
      if (pathname.startsWith("/candidate")) {
        if (!isLoggedIn) return false;
        return auth.user.sessionType === "candidate";
      }

      // HR portal: requires hr role
      if (pathname.startsWith("/hr")) {
        if (!isLoggedIn) return false;
        return auth.user.sessionType === "hr_user";
      }

      // Platform console: enforced in middleware (needs its own login page, not /auth/login)
      // Public routes: always allowed
      return true;
    },

    jwt({ token, user }) {
      // On first sign-in, merge the user object into the token
      if (user) {
        token.id = user.id;
        token.nameAr = user.nameAr;
        token.role = user.role;
        token.sessionType = user.sessionType;
        token.organizationId = user.organizationId;
        token.applicationId = user.applicationId;
        // تاريخ فتح الجلسة — يُضبط مرة واحدة عند الدخول ولا يُمسّ بعدها.
        // لا يمكن الاعتماد على `iat` لأن NextAuth يعيد توقيع الرمز في كل طلب
        // فتُحدَّث قيمته، فتفقد الجلسة معناها.
        token.sessionIssuedAt = Date.now();
      }
      return token;
    },

    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.nameAr = token.nameAr as string;
        session.user.role = token.role as string;
        session.user.sessionType = token.sessionType as "hr_user" | "candidate" | "platform_admin";
        session.user.organizationId = token.organizationId as string;
        session.user.applicationId = token.applicationId as string | undefined;
        // يُقارن بـ passwordChangedAt لإبطال كل جلسة أقدم من تغيير كلمة المرور.
        if (typeof token.sessionIssuedAt === "number") {
          session.user.sessionIssuedAt = new Date(token.sessionIssuedAt);
        }
      }
      return session;
    },
  },

  session: { strategy: "jwt", maxAge: 8 * 60 * 60 }, // 8-hour tokens for a work system
  providers: [], // filled in auth.ts
};
