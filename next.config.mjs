/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      // Receipt photos are submitted through a Server Action. Keep this below
      // Vercel's 4.5 MB Function request limit, while allowing normal camera photos.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
