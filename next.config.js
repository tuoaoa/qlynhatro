/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  basePath: '/qlynhatro',
  experimental: {
    serverComponentsExternalPackages: ['sqlite3'],
  },
};

module.exports = nextConfig;
