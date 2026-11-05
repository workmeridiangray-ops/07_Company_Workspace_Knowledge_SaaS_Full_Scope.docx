/** @type {import('next').NextConfig} */
export default {
  output: 'standalone',
  poweredByHeader: false,
  experimental: { serverActions: { bodySizeLimit: '12mb' } },
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ]}];
  },
};
