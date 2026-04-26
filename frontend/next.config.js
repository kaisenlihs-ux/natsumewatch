/** @type {import('next').NextConfig} */
const isExport = process.env.NEXT_OUTPUT === "export";
const nextConfig = {
  reactStrictMode: true,
  ...(isExport ? { output: "export", images: { unoptimized: true } } : {}),
  images: {
    unoptimized: isExport,
    remotePatterns: [
      { protocol: "https", hostname: "anilibria.top" },
      { protocol: "https", hostname: "static-libria.weekstorm.one" },
      { protocol: "https", hostname: "**.libria.fun" },
      { protocol: "https", hostname: "cache.libria.fun" },
    ],
  },
  ...(isExport
    ? {}
    : {
        async rewrites() {
          const api = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001";
          return [{ source: "/api/:path*", destination: `${api}/api/:path*` }];
        },
      }),
};
module.exports = nextConfig;
