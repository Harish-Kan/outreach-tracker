import type { NextConfig } from "next";

/**
 * Supabase is the only third party the browser talks to, so connect-src can be
 * pinned to exactly that project rather than opened to all of supabase.co.
 */
const supabaseOrigin = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return "https://*.supabase.co";
  try {
    return new URL(url).origin;
  } catch {
    return "https://*.supabase.co";
  }
})();

const supabaseSocket = supabaseOrigin.replace(/^https/, "wss");

const isDev = process.env.NODE_ENV === "development";

/**
 * 'unsafe-inline' on script-src is a real weakness, and a deliberate one.
 * Removing it means minting a nonce per request in proxy.ts, because both
 * Next's hydration bootstrap and the next-themes pre-paint script are inline.
 * The rest of the policy still does the work that matters here: frame-ancestors
 * stops the delete buttons being clickjacked, connect-src stops an injected
 * script exfiltrating contacts to another host, and form-action stops a form
 * being repointed at an attacker.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} ${supabaseSocket}${isDev ? " ws://localhost:*" : ""}`,
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          // Belt and braces with frame-ancestors, for older browsers.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
