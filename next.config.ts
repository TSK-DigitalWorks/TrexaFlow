import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' blob: data: https://*.supabase.co https://res.cloudinary.com",
              "media-src 'self' https://res.cloudinary.com",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.cloudinary.com https://res.cloudinary.com",
              "font-src 'self'",
              "frame-src 'none'",
              "object-src 'none'",
            ].join('; '),
          },
        ],
      },
    ]
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
};

export default nextConfig;
