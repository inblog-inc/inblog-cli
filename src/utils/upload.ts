import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { readConfig } from './config.js';
import { isApiKeySession, readSession } from './token-store.js';
import { getValidAccessToken } from './token-refresh.js';
import { getBoundApiKeyBaseUrl } from './api-key-auth.js';

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

const MIME_TO_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/x-icon': '.ico',
};

export type ImageBucket =
  | 'favicon'
  | 'featured_image'
  | 'logo'
  | 'avatar'
  | 'og_image'
  | 'banner'
  | 'post_image';

function getUploadUrl(requestedBaseUrl?: string): string {
  const config = readConfig();
  const session = readSession();
  const configuredBaseUrl = requestedBaseUrl || config.baseUrl;
  const baseUrl = session && isApiKeySession(session)
    ? getBoundApiKeyBaseUrl(session, configuredBaseUrl)
    : configuredBaseUrl || 'https://inblog.ai';
  return `${baseUrl}/api/v1/upload`;
}

async function getAuthHeader(): Promise<string> {
  const token = await getValidAccessToken();
  if (token) return `Bearer ${token}`;
  const session = readSession();
  if (!session) {
    throw new Error('Not logged in. Run `inblog auth login` first.');
  }
  return isApiKeySession(session)
    ? `Bearer ${session.apiKey}`
    : `Bearer ${session.tokens.access_token}`;
}

function getBlogIdHeader(): string | undefined {
  const session = readSession();
  return session && !isApiKeySession(session) ? session.activeBlogId?.toString() : undefined;
}

function buildFileKey(bucket: string, ext: string): string {
  return `${bucket}/${Date.now()}-${randomUUID()}${ext}`;
}

/**
 * Checks if a string is a local file path (not a URL).
 */
export function isLocalPath(value: string): boolean {
  if (value.startsWith('http://') || value.startsWith('https://')) return false;
  return fs.existsSync(value);
}

/**
 * Uploads a local image file to inblog R2 storage via authenticated API proxy.
 * Returns the public CDN URL.
 */
export async function uploadImage(
  filePath: string,
  bucket: ImageBucket,
  requestedBaseUrl?: string,
): Promise<string> {
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
  const fileKey = buildFileKey(bucket, ext);
  const body = fs.readFileSync(resolved);

  const uploadUrl = getUploadUrl(requestedBaseUrl);
  const authHeader = await getAuthHeader();
  const blogId = getBlogIdHeader();

  const url = new URL(uploadUrl);
  url.searchParams.set('fileKey', fileKey);

  const headers: Record<string, string> = {
    'Content-Type': contentType,
    Authorization: authHeader,
  };
  if (blogId) headers['X-Blog-Id'] = blogId;

  const response = await fetch(url, {
    method: 'POST',
    body,
    headers,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Upload failed: ${response.status} ${response.statusText}${text ? ` — ${text}` : ''}`);
  }

  const data: any = await response.json();
  return data.publicUrl;
}

/**
 * If the value is a local file path, uploads it and returns the URL.
 * If it's already a URL, returns it as-is.
 */
export async function resolveImageUrl(
  value: string,
  bucket: ImageBucket,
  requestedBaseUrl?: string,
): Promise<string> {
  if (!isLocalPath(value)) return value;
  return uploadImage(value, bucket, requestedBaseUrl);
}

/**
 * Uploads a base64 data URI to R2 and returns the CDN URL.
 */
async function uploadBase64(
  dataUri: string,
  bucket: ImageBucket,
  requestedBaseUrl?: string,
): Promise<string> {
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) throw new Error('Invalid data URI');

  const contentType = match[1];
  const body = Buffer.from(match[2], 'base64');

  if (body.length > MAX_FILE_SIZE) {
    throw new Error(`Image exceeds 10MB limit: ${(body.length / 1024 / 1024).toFixed(1)}MB`);
  }

  const ext = MIME_TO_EXT[contentType] || '.bin';
  const fileKey = buildFileKey(bucket, ext);

  const uploadUrl = getUploadUrl(requestedBaseUrl);
  const authHeader = await getAuthHeader();
  const blogId = getBlogIdHeader();

  const url = new URL(uploadUrl);
  url.searchParams.set('fileKey', fileKey);

  const headers: Record<string, string> = {
    'Content-Type': contentType,
    Authorization: authHeader,
  };
  if (blogId) headers['X-Blog-Id'] = blogId;

  const response = await fetch(url, {
    method: 'POST',
    body,
    headers,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Upload failed: ${response.status} ${response.statusText}${text ? ` — ${text}` : ''}`);
  }

  const data: any = await response.json();
  return data.publicUrl;
}

/**
 * Processes HTML content: finds local file paths and base64 data URIs in
 * img src attributes, uploads them to R2, and replaces with CDN URLs.
 * Returns the processed HTML with all images on CDN.
 */
export async function processContentImages(
  html: string,
  requestedBaseUrl?: string,
): Promise<{ html: string; uploadCount: number }> {
  const imgSrcRegex = /(<img\s[^>]*\bsrc=["'])([^"']+)(["'][^>]*>)/gi;
  const matches: { full: string; prefix: string; src: string; suffix: string; index: number }[] = [];

  let m: RegExpExecArray | null;
  while ((m = imgSrcRegex.exec(html)) !== null) {
    matches.push({ full: m[0], prefix: m[1], src: m[2], suffix: m[3], index: m.index });
  }

  if (matches.length === 0) return { html, uploadCount: 0 };

  let uploadCount = 0;
  const replacements: Map<string, string> = new Map();

  const concurrency = 5;
  for (let i = 0; i < matches.length; i += concurrency) {
    const batch = matches.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      batch.map(async ({ src }) => {
        if (src.startsWith('https://source.inblog.dev/') || src.startsWith('https://image.inblog.dev/')) {
          return null;
        }
        if (src.startsWith('data:image/')) {
          const url = await uploadBase64(src, 'post_image', requestedBaseUrl);
          return { src, url };
        }
        if (isLocalPath(src)) {
          const url = await uploadImage(src, 'post_image', requestedBaseUrl);
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

  let processed = html;
  for (const [src, url] of replacements) {
    processed = processed.split(src).join(url);
  }

  return { html: processed, uploadCount };
}
