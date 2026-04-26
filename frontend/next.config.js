/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "anilibria.top" },
      { protocol: "https", hostname: "static-libria.weekstorm.one" },
      { protocol: "https", hostname: "**.libria.fun" },
      { protocol: "https", hostname: "cache.libria.fun" },
    ],
  },
  async rewrites() {
    const api = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001";
    return [{ source: "/api/:path*", destination: `${api}/api/:path*` }];
  },
};
module.exports = nextConfig;
