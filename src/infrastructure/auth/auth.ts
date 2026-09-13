import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import {
  verifyHRCredentials,
  verifyCandidateToken,
  verifyPlatformCredentials,
} from "./credentials.service";

// Providers only adapt credentials to the verifiers in credentials.service.ts,
// which is where lockout rules (inactive user / suspended organization) live.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  providers: [
    Credentials({
      id: "hr-credentials",
      name: "HR Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        return verifyHRCredentials(String(credentials.email), String(credentials.password));
      },
    }),

    Credentials({
      id: "candidate-token",
      name: "Candidate Magic Link",
      credentials: {
        token: { label: "Token", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.token) return null;
        return verifyCandidateToken(String(credentials.token));
      },
    }),

    Credentials({
      id: "platform-credentials",
      name: "Platform Admin Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        return verifyPlatformCredentials(String(credentials.email), String(credentials.password));
      },
    }),
  ],
});
