import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'www.coles.com.au' },
      { protocol: 'https', hostname: 'www.woolworths.com.au' },
      { protocol: 'https', hostname: 'www.aldi.com.au' },
      { protocol: 'https', hostname: 'www.igashop.com.au' },
      { protocol: 'https', hostname: 'www.costco.com.au' },
      { protocol: 'https', hostname: 'www.harrisfarm.com.au' },
      { protocol: 'https', hostname: 'www.amazon.com.au' },
    ],
  },
};

export default nextConfig;
