import type { NextConfig } from "next";

const securityHeaders = [
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Disallow embedding in any frame (clickjacking protection)
  { key: "X-Frame-Options", value: "DENY" },
  // Limit referrer information sent to third parties
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable browser features the app never uses
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // Content Security Policy
  // script-src includes 'unsafe-inline' because Next.js injects inline hydration
  // scripts. Replace with nonce-based CSP once next.config headers() supports it.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
