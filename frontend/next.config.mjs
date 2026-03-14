/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.ipfs.io" },
      { protocol: "https", hostname: "**.nftstorage.link" },
      { protocol: "https", hostname: "**.cloudflare.com" },
      { protocol: "https", hostname: "**.r2.dev" },
    ],
  },
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: https:",
            "connect-src 'self' https: wss:",
            "frame-ancestors 'none'",
          ].join("; "),
        },
      ],
    },
  ],
  webpack: (config) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    if (Array.isArray(config.externals)) {
      config.externals.push("pino-pretty", "lokijs", "encoding");
    } else {
      config.externals = [config.externals, "pino-pretty", "lokijs", "encoding"].filter(Boolean);
    }
    return config;
  },
};

export default nextConfig;
