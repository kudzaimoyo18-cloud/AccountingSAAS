// Digital Asset Links, served at /.well-known/assetlinks.json via the rewrite in
// next.config.
//
// Android checks this file to confirm that this site and the Play-signed app
// belong to the same owner. Without a match the TWA still runs, but Chrome keeps
// a URL bar pinned to the top of the app, which looks broken.
//
// The fingerprint comes from the Play Console (Setup -> App integrity -> App
// signing key certificate, SHA-256). Set it as TWA_SHA256_FINGERPRINT once the
// app is uploaded; until then this returns an empty list rather than a wrong
// one, so verification fails loudly instead of silently pointing at a key we
// do not control.
const PACKAGE_NAME = process.env.TWA_PACKAGE_NAME ?? "app.vercel.mizan_tan.twa";

export const dynamic = "force-static";

export function GET() {
  const fingerprint = process.env.TWA_SHA256_FINGERPRINT?.trim();

  const statements = fingerprint
    ? [
        {
          relation: ["delegate_permission/common.handle_all_urls"],
          target: {
            namespace: "android_app",
            package_name: PACKAGE_NAME,
            sha256_cert_fingerprints: [fingerprint],
          },
        },
      ]
    : [];

  return new Response(JSON.stringify(statements, null, 2), {
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=3600",
    },
  });
}
