/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep the database driver out of the bundle. @neondatabase/serverless opens a
  // real WebSocket and pulls in optional native addons; bundling it produced
  // "bufferUtil.mask is not a function" and dropped every connection.
  serverExternalPackages: ["@neondatabase/serverless", "ws", "better-auth"],
  // Android's Digital Asset Links must live at this exact path. Next ignores
  // dot-directories under app/, so the route handler is rewritten into place.
  async rewrites() {
    return [{ source: "/.well-known/assetlinks.json", destination: "/api/assetlinks" }];
  },
  experimental: {
    serverActions: {
      // Receipt photos are submitted through a Server Action. Keep this below
      // Vercel's 4.5 MB Function request limit, while allowing normal camera photos.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
