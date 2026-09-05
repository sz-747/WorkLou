import type { NextConfig } from "next";

const suffix = process.env.BASE44_PUBLIC_HOST_SUFFIX;
const nextConfig: NextConfig = {
  allowedDevOrigins: suffix ? [`https://3000-${suffix}`, `3000-${suffix}`] : [],
};
export default nextConfig;
