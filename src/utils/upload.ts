import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { readConfig } from './config.js';
import { readSession } from './token-store.js';
import { getValidAccessToken } from './token-refresh.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

export type ImageBucket =
  | 'favicon'
  | 'featured_image'
  | 'logo'
  | 'avatar'
  | 'og_image'
  | 'banner'
  | 'post_image';

function getUploadUrl(): string {
  const config = readConfig();
  const baseUrl = config.baseUrl || 'https://inblog.ai';
  return `${baseUrl}/api/v1/upload`;
}

async function getAuthHeader(): Promise<string> {
  const token = await getValidAccessToken();
  if (!token) {
    const session = readSession();
    if (!session?.tokens?.access_token) {
      throw new Error('Not logged in. Run `inblog auth login` first.');
    }
    return `Bearer ${session.tokens.access_token}`;
  }
  return `Bearer ${token}`;
}

/**
 * Checks if a string is a local file path (not a URL).
 */
export function isLocalPath(value: string): boolean {
  if (value.startsWith('http://') || value.startsWith('https://')) return false;
  return fs.existsSync(value);
}

/**
 * Uploads a local image file to inblog R2 storage via server proxy.
 * Returns the public CDN URL.
 */
export async function uploadImage(filePath: string, bucket: ImageBucket): Promise<string> {
  const resolved = path.resolve(filePath);

  if (!fs.existsSync(resolved)) {
    throw new Error(`File not found: ${resolved}`);
  }

  const stat = fs.statSync(resolved);
  if (stat.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds 10MB limit: ${(stat.size / 1024 / 1024).toFixed(1)}MB`);
  }

  const ext = path.extname(resolved).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  const fileKey = `${bucket}/${new Date().toISOString()}-${randomUUID()}`;
  const body = fs.readFileSync(resolved);

  const uploadUrl = getUploadUrl();
  const authHeader = await getAuthHeader();

  const response = await fetch(`${uploadUrl}?fileKey=${fileKey}`, {
    method: 'POST',
    body,
    headers: {
      'Content-Type': contentType,
      Authorization: authHeader,
    },
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
  }

  const data: any = await response.json();
  return data.publicUrl;
}

/**
 * If the value is a local file path, uploads it and returns the URL.
 * If it's already a URL, returns it as-is.
 */
export async function resolveImageUrl(value: string, bucket: ImageBucket): Promise<string> {
  if (!isLocalPath(value)) return value;
  return uploadImage(value, bucket);
}

/**
 * Uploads a base64 data URI to R2 and returns the CDN URL.
 */
async function uploadBase64(dataUri: string, bucket: ImageBucket): Promise<string> {
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) throw new Error('Invalid data URI');

  const contentType = match[1];
  const body = Buffer.from(match[2], 'base64');

  if (body.length > MAX_FILE_SIZE) {
    throw new Error(`Base64 image exceeds 10MB limit: ${(body.length / 1024 / 1024).toFixed(1)}MB`);
  }

  const fileKey = `${bucket}/${new Date().toISOString()}-${randomUUID()}`;

  const uploadUrl = getUploadUrl();
  const authHeader = await getAuthHeader();

  const response = await fetch(`${uploadUrl}?fileKey=${fileKey}`, {
    method: 'POST',
    body,
    headers: {
      'Content-Type': contentType,
      Authorization: authHeader,
    },
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
  }

  const data: any = await response.json();
  return data.publicUrl;
}

/**
 * Processes HTML content: finds local file paths and base64 data URIs in
 * img src attributes, uploads them to R2, and replaces with CDN URLs.
 * Returns the processed HTML with all images on CDN.
 */
export async function processContentImages(html: string): Promise<{ html: string; uploadCount: number }> {
  // Match src="..." in img tags (data-type="imageBlock" or regular img)
  const imgSrcRegex = /(<img\s[^>]*\bsrc=["'])([^"']+)(["'][^>]*>)/gi;
  const matches: { full: string; prefix: string; src: string; suffix: string; index: number }[] = [];

  let m: RegExpExecArray | null;
  while ((m = imgSrcRegex.exec(html)) !== null) {
    matches.push({ full: m[0], prefix: m[1], src: m[2], suffix: m[3], index: m.index });
  }

  if (matches.length === 0) return { html, uploadCount: 0 };

  let uploadCount = 0;
  const replacements: Map<string, string> = new Map();

  // Process uploads concurrently (max 5 at a time)
  const concurrency = 5;
  for (let i = 0; i < matches.length; i += concurrency) {
    const batch = matches.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      batch.map(async ({ src }) => {
        // Skip already-uploaded CDN URLs
        if (src.startsWith('https://source.inblog.dev/') || src.startsWith('https://image.inblog.dev/')) {
          return null;
        }

        // Base64 data URI
        if (src.startsWith('data:image/')) {
          const url = await uploadBase64(src, 'post_image');
          return { src, url };
        }

        // Local file path
        if (isLocalPath(src)) {
          const url = await uploadImage(src, 'post_image');
          return { src, url };
        }

        return null;
      }),
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        replacements.set(result.value.src, result.value.url);
        uploadCount++;
      }
    }
  }

  // Apply replacements
  let processed = html;
  for (const [src, url] of replacements) {
    // Use split/join for replacement to avoid regex special char issues with base64
    processed = processed.split(src).join(url);
  }

  return { html: processed, uploadCount };
}
