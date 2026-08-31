import "server-only";

import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ---------------------------------------------------------------------------
// Object storage on Cloudflare R2 (S3 API), replacing Supabase Storage.
//
// Supabase enforced per-folder access with storage RLS policies keyed on the
// company id in the object path. R2 has no such policy layer, so the bucket is
// entirely private and the ONLY way in or out is a short-lived presigned URL
// minted here, after the caller has been checked against the tenant guard in
// lib/db/tenant.ts. Keys still start with the company id, and assertCompanyKey()
// re-checks that prefix on every call so a signed URL can never be minted for
// another tenant's object.
// ---------------------------------------------------------------------------

const BUCKET = process.env.R2_BUCKET ?? "documents";

/** How long presigned URLs live. Long enough to upload a phone photo, short
 *  enough that a leaked link is worthless by the time it is shared. */
const UPLOAD_URL_TTL_SECONDS = 10 * 60;
const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;

/** Hard ceiling on a single upload, mirrored by the client before it starts. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

let client: S3Client | null = null;

function r2(): S3Client {
  if (client) return client;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY " +
        "and R2_BUCKET in .env.local — see README.",
    );
  }

  client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return client;
}

export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY,
  );
}

/**
 * Every object key must live under the company's own prefix. This is the
 * equivalent of the old storage RLS policy that matched
 * (storage.foldername(name))[1] against the caller's company.
 *
 * Throws rather than returning false: a bad key is a bug or an attack, never a
 * condition worth continuing past.
 */
export function assertCompanyKey(key: string, companyId: string): void {
  if (!key || !key.startsWith(`${companyId}/`)) {
    throw new Error("Storage key does not belong to this company.");
  }
  // Reject traversal and absolute keys outright; R2 would happily store them.
  if (key.includes("..") || key.startsWith("/") || key.includes("//")) {
    throw new Error("Invalid storage key.");
  }
}

/** Build a collision-proof key under a company's prefix. */
export function buildKey(companyId: string, folder: string, filename: string): string {
  const safeName = filename
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(-120);
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${companyId}/${folder}/${stamp}-${safeName || "file"}`;
}

/**
 * A presigned PUT the browser uploads straight to, so the file never passes
 * through a serverless function and can never trip Vercel's ~4.5MB body cap.
 *
 * The R2 bucket needs a CORS rule allowing PUT from the app's origin — see the
 * "Cloudflare R2" section of the README.
 */
export async function createUploadUrl(
  key: string,
  companyId: string,
  contentType: string,
): Promise<string> {
  assertCompanyKey(key, companyId);
  return getSignedUrl(
    r2(),
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType || "application/octet-stream",
    }),
    { expiresIn: UPLOAD_URL_TTL_SECONDS },
  );
}

/** A short-lived link for viewing or downloading one object. */
export async function createDownloadUrl(key: string, companyId: string): Promise<string> {
  assertCompanyKey(key, companyId);
  return getSignedUrl(r2(), new GetObjectCommand({ Bucket: BUCKET, Key: key }), {
    expiresIn: DOWNLOAD_URL_TTL_SECONDS,
  });
}

/** Server-side upload, for files the app itself generates (tax packs, exports). */
export async function putObject(
  key: string,
  companyId: string,
  body: Buffer | Uint8Array | string,
  contentType: string,
): Promise<string> {
  assertCompanyKey(key, companyId);
  await r2().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  return key;
}

/** Read an object into memory — used to feed uploaded documents to the AI pass. */
export async function getObjectBytes(key: string, companyId: string): Promise<Buffer> {
  assertCompanyKey(key, companyId);
  const res = await r2().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  if (!res.Body) throw new Error(`Storage object not found: ${key}`);
  const bytes = await res.Body.transformToByteArray();
  return Buffer.from(bytes);
}

/** Read an object as text (CSV statements). */
export async function getObjectText(key: string, companyId: string): Promise<string> {
  const buf = await getObjectBytes(key, companyId);
  return buf.toString("utf8");
}

export async function deleteObject(key: string, companyId: string): Promise<void> {
  assertCompanyKey(key, companyId);
  await r2().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/** Confirm an upload actually landed, and how big it is. */
export async function statObject(
  key: string,
  companyId: string,
): Promise<{ size: number; contentType: string | null } | null> {
  assertCompanyKey(key, companyId);
  try {
    const res = await r2().send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return { size: res.ContentLength ?? 0, contentType: res.ContentType ?? null };
  } catch {
    return null;
  }
}
