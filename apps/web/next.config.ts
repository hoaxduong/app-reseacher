import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  transpilePackages: ["@workspace/ui"],
}

export default nextConfig
