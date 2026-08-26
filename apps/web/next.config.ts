import type { NextConfig } from 'next';

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com",
  "frame-src 'self' https://accounts.google.com https://*.firebaseapp.com",
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), geolocation=(), microphone=(), payment=(), usb=()',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
] as const;

const nextConfig: NextConfig = {
  headers() {
    return Promise.resolve(
      process.env.NODE_ENV === 'production'
        ? [
            {
              headers: [...securityHeaders],
              source: '/:path*',
            },
          ]
        : [],
    );
  },
  poweredByHeader: false,
  images: {
    qualities: [75, 95],
  },
  rewrites() {
    const apiOrigin = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

    return Promise.resolve([
      { destination: `${apiOrigin}/:path*`, source: '/api/:path*' },
    ]);
  },
};

export default nextConfig;
