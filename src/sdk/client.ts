import type { JsonApiResponse, JsonApiErrorResponse, JsonApiResource } from './types.js';
import { deserialize, extractMeta } from './deserialize.js';
import { serialize } from './serialize.js';

export class InblogApiError extends Error {
  status: number;
  code: string;
  title: string;
  detail?: string;

  constructor(status: number, code: string, title: string, detail?: string) {
    super(detail || title);
    this.name = 'InblogApiError';
    this.status = status;
    this.code = code;
    this.title = title;
    this.detail = detail;
  }
}

export interface ClientOptions {
  apiKey?: string;
  accessToken?: string;
  baseUrl?: string;
  blogId?: number;
  blogSubdomain?: string;
}

export class InblogClient {
  private apiKey?: string;
  private accessToken?: string;
  private baseUrl: string;
  private blogId?: number;
  private blogSubdomain?: string;
  private tokenRefresher?: () => Promise<string | null>;

  constructor(options: ClientOptions) {
    this.apiKey = options.apiKey;
    this.accessToken = options.accessToken;
    this.baseUrl = (options.baseUrl ?? 'https://inblog.ai').replace(/\/$/, '');
    this.blogId = options.blogId;
    this.blogSubdomain = options.blogSubdomain;

    if (!this.apiKey && !this.accessToken) {
      throw new Error('Either apiKey or accessToken must be provided');
    }
  }

  setTokenRefresher(fn: () => Promise<string | null>): void {
    this.tokenRefresher = fn;
  }

  private async readHeaders(): Promise<Record<string, string>> {
    const token = await this.resolveToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.api+json',
    };
    if (this.accessToken && this.blogId) {
      headers['X-Blog-Id'] = String(this.blogId);
    }
    return headers;
  }

  private async writeHeaders(): Promise<Record<string, string>> {
    const token = await this.resolveToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/vnd.api+json',
    };
    if (this.accessToken && this.blogId) {
      headers['X-Blog-Id'] = String(this.blogId);
    }
    return headers;
  }

  private async resolveToken(): Promise<string> {
    if (this.apiKey) return this.apiKey;
    if (this.tokenRefresher) {
      const refreshed = await this.tokenRefresher();
      if (refreshed) {
        this.accessToken = refreshed;
        return refreshed;
      }
    }
    if (this.accessToken) return this.accessToken;
    throw new Error('No valid authentication token available');
  }

  private buildUrl(path: string, params?: Record<string, any>): string {
    const url = new URL(`/api${path}`, this.baseUrl);

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null) continue;

        if (typeof value === 'object' && !Array.isArray(value)) {
          // Handle nested params like filter[slug]=xxx
          for (const [subKey, subValue] of Object.entries(value)) {
            if (subValue !== undefined && subValue !== null) {
              url.searchParams.set(`${key}[${subKey}]`, String(subValue));
            }
          }
        } else {
          url.searchParams.set(key, String(value));
        }
      }
    }

    return url.toString();
  }

  private async handleResponse(response: Response): Promise<JsonApiResponse> {
    const text = await response.text();
    let body: any;

    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      throw new InblogApiError(response.status, 'PARSE_ERROR', 'Failed to parse API response');
    }

    if (!response.ok) {
      if (body?.errors?.[0]) {
        const err = body.errors[0];
        throw new InblogApiError(
          parseInt(err.status, 10) || response.status,
          err.code || 'UNKNOWN_ERROR',
          err.title || 'API Error',
          err.detail,
        );
      }
      throw new InblogApiError(response.status, 'UNKNOWN_ERROR', `HTTP ${response.status}`);
    }

    return body;
  }

  async get<T = Record<string, any>>(
    path: string,
    params?: Record<string, any>,
  ): Promise<{ data: T; meta: ReturnType<typeof extractMeta> }> {
    const url = this.buildUrl(path, params);
    const response = await fetch(url, { method: 'GET', headers: await this.readHeaders() });
    const json = await this.handleResponse(response);
    return {
      data: deserialize<T>(json as JsonApiResponse<JsonApiResource>),
      meta: extractMeta(json),
    };
  }

  async list<T = Record<string, any>>(
    path: string,
    params?: Record<string, any>,
  ): Promise<{ data: T[]; meta: ReturnType<typeof extractMeta> }> {
    const url = this.buildUrl(path, params);
    const response = await fetch(url, { method: 'GET', headers: await this.readHeaders() });
    const json = await this.handleResponse(response);
    return {
      data: deserialize<T>(json as JsonApiResponse<JsonApiResource[]>),
      meta: extractMeta(json),
    };
  }

  async create<T = Record<string, any>>(
    path: string,
    type: string,
    attributes: Record<string, any>,
    params?: Record<string, any>,
  ): Promise<{ data: T; meta: ReturnType<typeof extractMeta> }> {
    const url = this.buildUrl(path, params);
    const body = serialize(type, attributes);
    const response = await fetch(url, {
      method: 'POST',
      headers: await this.writeHeaders(),
      body: JSON.stringify(body),
    });
    const json = await this.handleResponse(response);
    return {
      data: deserialize<T>(json as JsonApiResponse<JsonApiResource>),
      meta: extractMeta(json),
    };
  }

  async update<T = Record<string, any>>(
    path: string,
    type: string,
    id: string,
    attributes: Record<string, any>,
  ): Promise<{ data: T; meta: ReturnType<typeof extractMeta> }> {
    const url = this.buildUrl(path);
    const body = serialize(type, attributes, id);
    const response = await fetch(url, {
      method: 'PATCH',
      headers: await this.writeHeaders(),
      body: JSON.stringify(body),
    });
    const json = await this.handleResponse(response);
    return {
      data: deserialize<T>(json as JsonApiResponse<JsonApiResource>),
      meta: extractMeta(json),
    };
  }

  async delete(path: string): Promise<void> {
    const url = this.buildUrl(path);
    const response = await fetch(url, { method: 'DELETE', headers: await this.readHeaders() });
    if (!response.ok) {
      await this.handleResponse(response); // will throw
    }
  }

  async post<T = Record<string, any>>(
    path: string,
    body?: any,
  ): Promise<{ data: T; meta: ReturnType<typeof extractMeta> }> {
    const url = this.buildUrl(path);
    const response = await fetch(url, {
      method: 'POST',
      headers: await this.writeHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await this.handleResponse(response);
    return {
      data: deserialize<T>(json as JsonApiResponse<JsonApiResource>),
      meta: extractMeta(json),
    };
  }

  async patch<T = Record<string, any>>(
    path: string,
    body?: any,
  ): Promise<{ data: T; meta: ReturnType<typeof extractMeta> }> {
    const url = this.buildUrl(path);
    const response = await fetch(url, {
      method: 'PATCH',
      headers: await this.writeHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await this.handleResponse(response);
    return {
      data: deserialize<T>(json as JsonApiResponse<JsonApiResource>),
      meta: extractMeta(json),
    };
  }

  /**
   * Raw GET — for non-JSON:API endpoints that return plain JSON.
   */
  async rawGet(path: string, params?: Record<string, any>): Promise<any> {
    const url = this.buildUrl(path, params);
    const response = await fetch(url, { method: 'GET', headers: await this.readHeaders() });
    return this.handleRawResponse(response);
  }

  /**
   * Raw POST — for non-JSON:API endpoints.
   */
  async rawPost(path: string, body?: any): Promise<any> {
    const url = this.buildUrl(path);
    const headers = await this.readHeaders();
    headers['Content-Type'] = 'application/json';
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    return this.handleRawResponse(response);
  }

  /**
   * Raw PATCH — for non-JSON:API endpoints.
   */
  async rawPatch(path: string, body?: any): Promise<any> {
    const url = this.buildUrl(path);
    const headers = await this.readHeaders();
    headers['Content-Type'] = 'application/json';
    const response = await fetch(url, {
      method: 'PATCH',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    return this.handleRawResponse(response);
  }

  /**
   * Raw DELETE — for non-JSON:API endpoints.
   */
  async rawDelete(path: string): Promise<any> {
    const url = this.buildUrl(path);
    const response = await fetch(url, { method: 'DELETE', headers: await this.readHeaders() });
    if (response.status === 204) return { success: true };
    return this.handleRawResponse(response);
  }

  private async handleRawResponse(response: Response): Promise<any> {
    const text = await response.text();
    let body: any;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      if (!response.ok) {
        throw new InblogApiError(response.status, 'PARSE_ERROR', 'Failed to parse API response');
      }
      return text;
    }
    if (!response.ok) {
      if (body?.errors?.[0]) {
        const err = body.errors[0];
        throw new InblogApiError(
          parseInt(err.status, 10) || response.status,
          err.code || 'UNKNOWN_ERROR',
          err.title || 'API Error',
          err.detail,
        );
      }
      throw new InblogApiError(response.status, 'UNKNOWN_ERROR', body?.message || `HTTP ${response.status}`);
    }
    return body;
  }
}
