import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit", "fontkit", "mongoose", "mongodb"],
};

export default nextConfig;
