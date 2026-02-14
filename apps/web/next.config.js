/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@codearena/shared'],
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
};

module.exports = nextConfig;
