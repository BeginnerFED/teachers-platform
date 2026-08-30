import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // @tp/shared is published as raw TypeScript inside the workspace, so Next has to compile it.
  transpilePackages: ['@tp/shared'],
}

export default nextConfig
