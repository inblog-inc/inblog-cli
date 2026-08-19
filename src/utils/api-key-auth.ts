import type { StoredApiKeySession } from './token-store.js';

export interface ApiKeyIdentity {
  blogId: number;
  subdomain: string;
  scopes: string[];
  plan?: string;
  title?: string;
}

type JsonRecord = Record<string, unknown>;

export interface ApiKeyLoginInput {
  apiKey?: string;
  shouldPrompt: boolean;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getResponseData(value: unknown): JsonRecord | null {
  if (!isRecord(value)) return null;
  const data = isRecord(value.data) ? value.data : value;
  if (!isRecord(data)) return null;
  const attributes = isRecord(data.attributes) ? data.attributes : {};
  return { ...attributes, ...data };
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function getNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return undefined;
}

function getBlogIdentity(data: JsonRecord): { blogId?: number; subdomain?: string } {
  const blog = isRecord(data.blog) ? data.blog : undefined;
  const activeBlog = isRecord(data.active_blog) ? data.active_blog : undefined;
  return {
    blogId: getNumber(data.blog_id)
      ?? getNumber(data.blogId)
      ?? getNumber(blog?.id)
      ?? getNumber(activeBlog?.id),
    subdomain: getString(data.subdomain)
      ?? getString(data.blog_subdomain)
      ?? getString(data.blogSubdomain)
      ?? getString(blog?.subdomain)
      ?? getString(activeBlog?.subdomain),
  };
}

function getScopes(data: JsonRecord): string[] {
  const scopes = data.scopes ?? data.scope;
  if (Array.isArray(scopes)) return scopes.filter((scope): scope is string => typeof scope === 'string');
  if (typeof scopes === 'string') return scopes.split(/[\s,]+/).filter(Boolean);
  return [];
}

export function normalizeBaseUrl(baseUrl: string): string {
  try {
    return new URL(baseUrl).origin;
  } catch {
    throw new Error('Invalid API base URL.');
  }
}

export function getApiKeyLoginInput(
  apiKeyOption: string | boolean | undefined,
  apiKeyFromEnv: string | undefined,
): ApiKeyLoginInput | undefined {
  if (typeof apiKeyOption === 'string') {
    return { apiKey: apiKeyOption.trim(), shouldPrompt: false };
  }
  if (apiKeyOption === true) {
    return { shouldPrompt: true };
  }
  if (apiKeyFromEnv?.trim()) {
    return { apiKey: apiKeyFromEnv.trim(), shouldPrompt: false };
  }
  return undefined;
}

export function getBoundApiKeyBaseUrl(
  session: StoredApiKeySession,
  requestedBaseUrl?: string,
): string {
  if (!session.baseUrl) {
    throw new Error(
      'This API-key session has no validated server origin. Run `inblog auth logout` and `inblog auth login --api-key` again.',
    );
  }

  const boundBaseUrl = normalizeBaseUrl(session.baseUrl);
  if (requestedBaseUrl && normalizeBaseUrl(requestedBaseUrl) !== boundBaseUrl) {
    throw new Error(
      'The configured API base URL differs from the server used for API-key login. Re-login with an API key for that server.',
    );
  }
  return boundBaseUrl;
}

function getApiUrl(baseUrl: string, path: string): string {
  return new URL(path, `${normalizeBaseUrl(baseUrl)}/`).toString();
}

function headers(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/vnd.api+json',
  };
}

async function getJson(response: Response, description: string): Promise<JsonRecord> {
  if (!response.ok) {
    throw new Error(`${description}: HTTP ${response.status}`);
  }
  const data = getResponseData(await response.json());
  if (!data) throw new Error(`${description}: invalid response`);
  return data;
}

/**
 * Validate an API key without mutating server state, then cache its blog metadata.
 */
export async function validateApiKey(apiKey: string, baseUrl: string): Promise<ApiKeyIdentity> {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const meResponse = await fetch(getApiUrl(normalizedBaseUrl, '/api/v1/me'), {
    method: 'GET',
    headers: headers(apiKey),
  });
  const me = await getJson(meResponse, 'API key validation failed');
  const { blogId, subdomain } = getBlogIdentity(me);

  if (!blogId || !subdomain) {
    throw new Error('API key validation response did not include its scoped blog.');
  }

  const identity: ApiKeyIdentity = {
    blogId,
    subdomain,
    scopes: getScopes(me),
  };

  const blogResponse = await fetch(getApiUrl(normalizedBaseUrl, '/api/v1/blogs/me'), {
    method: 'GET',
    headers: headers(apiKey),
  });
  if (blogResponse.ok) {
    const blog = getResponseData(await blogResponse.json());
    if (blog) {
      identity.plan = getString(blog.plan);
      identity.title = getString(blog.title);
    }
  }

  return identity;
}
