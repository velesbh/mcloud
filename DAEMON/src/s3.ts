/**
 * S3-compatible storage adapter for the daemon.
 *
 * Mirrors the main app's src/lib/storage/s3.ts.
 *
 * Reads from env:
 *   S3_ENDPOINT          — e.g. https://s3.amazonaws.com | https://minio.example.com
 *   S3_REGION            — e.g. us-east-1 | auto (Cloudflare R2)
 *   S3_BUCKET            — bucket name (default: mcloud-files)
 *   S3_ACCESS_KEY        — access key / key ID
 *   S3_SECRET_KEY        — secret access key
 *   S3_FORCE_PATH_STYLE  — "true" for MinIO / self-hosted; omit for AWS/R2
 *
 * If S3_ACCESS_KEY is not set, all calls throw immediately so the caller can
 * fall back to Supabase Storage or another mechanism.
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const S3_BUCKET = process.env.S3_BUCKET ?? "mcloud-files";

function makeClient(): S3Client | null {
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY;
  const secretAccessKey = process.env.S3_SECRET_KEY;
  if (!accessKeyId || !secretAccessKey) return null;
  return new S3Client({
    region: process.env.S3_REGION ?? "auto",
    ...(endpoint ? { endpoint } : {}),
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  });
}

let _client: S3Client | null | undefined = undefined;
function getClient(): S3Client {
  if (_client === undefined) _client = makeClient();
  if (!_client) throw new Error("S3 not configured — set S3_ACCESS_KEY and S3_SECRET_KEY");
  return _client;
}

export function isS3Configured(): boolean {
  return !!(process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY);
}

/** Upload a Buffer to S3. */
export async function s3Upload(
  key: string,
  body: Buffer | Uint8Array,
  contentType = "application/octet-stream"
): Promise<void> {
  await getClient().send(
    new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: body, ContentType: contentType })
  );
}

/** Delete an object from S3 (best-effort — does not throw on 404). */
export async function s3Delete(key: string): Promise<void> {
  try {
    await getClient().send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
  } catch {
    // best-effort
  }
}

/** Generate a presigned download URL (default 5-min expiry). */
export async function s3SignedDownloadUrl(key: string, expiresIn = 300): Promise<string> {
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }),
    { expiresIn }
  );
}

/** Generate a presigned upload URL. */
export async function s3SignedUploadUrl(key: string, expiresIn = 300): Promise<string> {
  return getSignedUrl(
    getClient(),
    new PutObjectCommand({ Bucket: S3_BUCKET, Key: key }),
    { expiresIn }
  );
}

/** Check if an object exists. */
export async function s3Exists(key: string): Promise<boolean> {
  try {
    await getClient().send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}
