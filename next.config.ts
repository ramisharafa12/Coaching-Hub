import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // firebase-admin must stay on the server and not be bundled into client code.
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;
