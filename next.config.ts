import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Clerk serves its JS and API from a "frontend API" host that is encoded in the publishable key
 * (pk_test_<base64 of "host$">). Allow exactly that host in addition to Clerk's shared domains, so
 * the policy keeps working with a custom production domain without being a blanket allow-list.
 */
function clerkFrontendHost(): string | null {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const encoded = key?.split('_')[2];
  if (!encoded) return null;
  try {
    const host = Buffer.from(encoded, 'base64').toString('utf8').replace(/\$$/, '');
    return /^[a-z0-9.-]+$/i.test(host) ? `https://${host}` : null;
  } catch {
    return null;
  }
}

const clerkHost = clerkFrontendHost();
const clerkSources = ['https://*.clerk.accounts.dev', 'https://*.clerk.com', clerkHost].filter(Boolean).join(' ');

// CSP is the backstop against XSS: even if untrusted content slipped into the page, the browser
// refuses to run scripts or talk to hosts outside this list.
const contentSecurityPolicy = [
  `default-src 'self'`,
  // Next.js emits inline bootstrap scripts, so 'unsafe-inline' is required until nonces are wired in.
  // Dev additionally needs 'unsafe-eval' for React Fast Refresh.
  `script-src 'self' 'unsafe-inline' ${isDev ? `'unsafe-eval' ` : ''}${clerkSources} https://challenges.cloudflare.com`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: https://img.clerk.com`,
  `font-src 'self' data:`,
  `connect-src 'self' ${clerkSources} https://clerk-telemetry.com`,
  `frame-src https://challenges.cloudflare.com ${clerkSources}`,
  `worker-src 'self' blob:`,
  `form-action 'self' https://www.payfast.co.za https://sandbox.payfast.co.za`,
  `base-uri 'self'`,
  `object-src 'none'`,
  `frame-ancestors 'none'`,
].join('; ');

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
