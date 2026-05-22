import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/*': ['./bin/steam-cli'],
  },
};

export default nextConfig;
