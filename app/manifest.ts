import type { MetadataRoute } from "next";

// PWA manifest — makes Mizan installable ("Add to Home Screen") on iOS/Android.
// start_url is the portal: the installed app opens straight into the books.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mizan — AI bookkeeping",
    short_name: "Mizan",
    description:
      "Snap receipts, approve AI-drafted books, and keep VAT & corporate tax filing-ready.",
    id: "/app",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F6F8FA",
    theme_color: "#0F1B16",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        // Separate art, not the same square: Android crops maskable icons to a
        // circle-ish shape, so the mark is scaled to 60% on the brand ground to
        // stay inside the safe zone. Reusing icon-512 here sliced the logo.
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
