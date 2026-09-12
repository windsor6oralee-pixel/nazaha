import NextAuth from "next-auth";
import { authConfig } from "@/infrastructure/auth/auth.config";

// Use the lightweight config (no Prisma) for middleware
// This runs on Edge runtime
const { auth } = NextAuth(authConfig);

const TENANT_PREFIXES = ["/hr", "/admin", "/candidate"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const user = req.auth?.user;
  const origin = req.nextUrl.origin;

  // ── Platform console: its own session type and its own login page ──
  if (pathname.startsWith("/platform")) {
    if (pathname === "/platform/login") {
      return user?.sessionType === "platform_admin"
        ? Response.redirect(new URL("/platform", origin))
        : undefined;
    }
    if (user?.sessionType !== "platform_admin") {
      const loginUrl = new URL("/platform/login", origin);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return Response.redirect(loginUrl);
    }
    return;
  }

  // Platform admins have no tenant: keep them out of tenant portals entirely.
  if (user?.sessionType === "platform_admin" && TENANT_PREFIXES.some((p) => pathname.startsWith(p))) {
    return Response.redirect(new URL("/platform", origin));
  }

  // If authorized callback returned false, redirect to login
  // with the appropriate return URL
  if (!user) {
    const loginUrl = new URL("/auth/login", origin);

    if (pathname.startsWith("/candidate")) {
      loginUrl.searchParams.set("type", "candidate");
    } else if (pathname.startsWith("/hr")) {
      loginUrl.searchParams.set("type", "hr");
    }

    loginUrl.searchParams.set("callbackUrl", pathname);
    return Response.redirect(loginUrl);
  }

  // Candidate trying to access HR portal
  if (pathname.startsWith("/hr") && user.sessionType !== "hr_user") {
    return Response.redirect(new URL("/auth/login?type=hr", origin));
  }

  // HR user trying to access candidate portal
  if (pathname.startsWith("/candidate") && user.sessionType !== "candidate") {
    return Response.redirect(new URL("/hr", origin));
  }

  // Admin routes: require hr_user with admin or hr_manager role
  if (pathname.startsWith("/admin")) {
    if (user.sessionType !== "hr_user") {
      return Response.redirect(new URL("/auth/login", origin));
    }
    const role = (user as any).role ?? "";
    if (!["admin", "hr_manager"].includes(role)) {
      return Response.redirect(new URL("/hr", origin));
    }
  }
});

export const config = {
  matcher: ["/candidate/:path*", "/hr/:path*", "/admin/:path*", "/platform/:path*"],
};
