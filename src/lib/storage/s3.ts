/**
 * S3-compatible storage adapter.
 *
 * Reads from env:
 *   S3_ENDPOINT         — e.g. https://s3.amazonaws.com | https://minio.example.com | https://<account>.r2.cloudflarestorage.com
 *   S3_REGION           — e.g. us-east-1 | auto (Cloudflare R2)
 *   S3_BUCKET           — bucket name  (default: mcloud-files)
 *   S3_ACCESS_KEY       — access key / key ID
 *   S3_SECRET_KEY       — secret access key
 *   S3_FORCE_PATH_STYLE — "true" for MinIO / self-hosted; omit for AWS/R2
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
  const accessKeyId = process.env.S3_ACCESS_KEY;
  const secretAccessKey = process.env.S3_SECRET_KEY;
  if (!accessKeyId || !secretAccessKey) return null;

  // Strip trailing slashes from endpoint — a trailing slash causes double-slash
  // paths like https://endpoint//bucket/key, which many providers reject with
  // a plain-text "Bad Request" body instead of valid XML, breaking the SDK.
  const rawEndpoint = process.env.S3_ENDPOINT;
  const endpoint = rawEndpoint ? rawEndpoint.replace(/\/+$/, "") : undefined;

  // Sanitize region — values like "n/a", "N/A", or anything containing
  // non-hostname chars are invalid and cause the AWS SDK to throw.
  // Fall back to "auto" (valid for Cloudflare R2 and most S3-compatible providers).
  const rawRegion = process.env.S3_REGION ?? "";
  const region = /^[a-zA-Z0-9-]+$/.test(rawRegion) ? rawRegion : "auto";

  // When a custom endpoint is set, default to path-style URLs
  // ({endpoint}/{bucket}/key) because most S3-compatible providers
  // (MinIO, custom proxies, etc.) don't support virtual-hosted-style
  // ({bucket}.{endpoint}/key) which is the AWS default.
  // Set S3_FORCE_PATH_STYLE=false explicitly to override.
  const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === "false"
    ? false
    : process.env.S3_FORCE_PATH_STYLE === "true" || !!endpoint;

  return new S3Client({
    region,
    ...(endpoint ? { endpoint } : {}),
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle,
  });
}

// Client is created once per process and cached.
// Cleared to undefined so the first call triggers makeClient().
let _client: S3Client | null | undefined = undefined;
function getClient(): S3Client {
  if (_client === undefined) _client = makeClient();
  if (!_client) throw new Error("S3 not configured — set S3_ACCESS_KEY and S3_SECRET_KEY");
  return _client;
}

export function isS3Configured(): boolean {
  return !!(process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY);
}

/**
 * Extract a human-readable message from an AWS SDK error.
 *
 * When an S3-compatible provider returns a non-XML body (e.g. plain-text
 * "Bad Request" or a JSON blob), the AWS SDK fails with a cryptic
 * "char 'X' is not expected.:1:1 Deserialization error" message. We pull
 * the raw response body out of the hidden `$response` field and use that
 * as the error message instead.
 */
async function extractS3Error(err: unknown): Promise<string> {
  try {
    const raw = (err as Record<string, unknown> | null)?.$response as
      | { body?: { transformToString?: () => Promise<string> }; statusCode?: number }
      | undefined;

    if (raw?.body?.transformToString) {
      const body = (await raw.body.transformToString()).trim();
      if (body) {
        const status = raw.statusCode ? ` (HTTP ${raw.statusCode})` : "";
        return `S3 provider error${status}: ${body}`;
      }
    }
  } catch {
    // best-effort — fall through to the original message
  }
  return String(err);
}

/** Upload a Buffer to S3. Throws with a readable message on failure. */
export async function s3Upload(
  key: string,
  body: Buffer | Uint8Array,
  contentType = "application/octet-stream"
): Promise<void> {
  try {
    await getClient().send(
      new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: body, ContentType: contentType })
    );
  } catch (err) {
    const msg = await extractS3Error(err);
    throw new Error(msg);
  }
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
  try {
    return await getSignedUrl(
      getClient(),
      new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }),
      { expiresIn }
    );
  } catch (err) {
    const msg = await extractS3Error(err);
    throw new Error(msg);
  }
}

/** Generate a presigned upload URL. */
export async function s3SignedUploadUrl(key: string, expiresIn = 300): Promise<string> {
  try {
    return await getSignedUrl(
      getClient(),
      new PutObjectCommand({ Bucket: S3_BUCKET, Key: key }),
      { expiresIn }
    );
  } catch (err) {
    const msg = await extractS3Error(err);
    throw new Error(msg);
  }
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
