import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  rewrites() {
    const apiOrigin = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

    return Promise.resolve([
      { destination: `${apiOrigin}/:path*`, source: '/api/:path*' },
    ]);
  },
};

export default nextConfig;
