import "server-only";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Cloudflare R2 (S3-compatible) — replaces Supabase Storage for the private
// `documents` bucket. Uploads go straight from the browser via a presigned PUT
// URL (so big receipt photos never travel through a Server Action body), and
// the server reads the object back for AI extraction.

export const R2_BUCKET = process.env.R2_BUCKET ?? "mizan-documents";

let _client: S3Client | null = null;
function client(): S3Client {
  if (_client) return _client;
  const accountId = process.env.R2_ACCOUNT_ID;
  _client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
    },
  });
  return _client;
}

/** Presigned PUT the browser uses to upload a file directly to R2. */
export function presignUpload(
  key: string,
  contentType: string,
  expiresIn = 300,
): Promise<string> {
  return getSignedUrl(
    client(),
    new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: contentType }),
    { expiresIn },
  );
}

/** Presigned GET for viewing/downloading a stored document. */
export function presignDownload(key: string, expiresIn = 300): Promise<string> {
  return getSignedUrl(
    client(),
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }),
    { expiresIn },
  );
}

/** Read an object fully into memory (server-side, e.g. for AI extraction). */
export async function getObjectBytes(
  key: string,
): Promise<{ bytes: Buffer; contentType: string }> {
  const res = await client().send(
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }),
  );
  const bytes = Buffer.from(await res.Body!.transformToByteArray());
  return { bytes, contentType: res.ContentType ?? "application/octet-stream" };
}

export async function deleteObject(key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
}
