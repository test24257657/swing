/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // Proxy API calls in dev so the browser stays same-origin.
    const api = process.env.API_PROXY_TARGET ?? "http://localhost:8000";
    return [{ source: "/api/:path*", destination: `${api}/:path*` }];
  },
};

export default nextConfig;
