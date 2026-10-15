import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // firebase-admin must stay on the server and not be bundled into client code.
  serverExternalPackages: ["firebase-admin"],
  // Local testing: open the staff side at localhost:3000 and a student or guardian at
  // 127.0.0.1:3000 — different origins keep separate sign-ins. Dev server only.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
