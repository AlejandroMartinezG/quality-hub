const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: basePath,
  assetPrefix: basePath,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
