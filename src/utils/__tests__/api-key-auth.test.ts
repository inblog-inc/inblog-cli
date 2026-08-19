import { afterEach, describe, expect, it, vi } from 'vitest';
import { getApiKeyLoginInput, getBoundApiKeyBaseUrl, validateApiKey } from '../api-key-auth.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('validateApiKey', () => {
  it('validates the key and derives scoped blog metadata with GET requests', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: {
          type: 'api-keys',
          id: 'key-1',
          attributes: {
            blog_id: 12,
            subdomain: 'api-blog',
            scopes: ['posts:read', 'posts:write'],
          },
        },
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: {
          type: 'blogs',
          id: '12',
          attributes: { title: 'API Blog', plan: 'team' },
        },
      })));
    vi.stubGlobal('fetch', fetchMock);

    await expect(validateApiKey('secret-api-key', 'https://example.test/')).resolves.toEqual({
      blogId: 12,
      subdomain: 'api-blog',
      scopes: ['posts:read', 'posts:write'],
      title: 'API Blog',
      plan: 'team',
    });

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://example.test/api/v1/me', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer secret-api-key',
        Accept: 'application/vnd.api+json',
      },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://example.test/api/v1/blogs/me', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer secret-api-key',
        Accept: 'application/vnd.api+json',
      },
    });
  });

  it('keeps a valid scoped key when optional blog metadata is unavailable', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        blog: { id: '12', subdomain: 'api-blog' },
        scope: 'posts:read posts:write',
      })))
      .mockResolvedValueOnce(new Response('forbidden', { status: 403 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(validateApiKey('secret-api-key', 'https://example.test')).resolves.toEqual({
      blogId: 12,
      subdomain: 'api-blog',
      scopes: ['posts:read', 'posts:write'],
    });
  });
});

describe('API-key login origin binding', () => {
  const session = {
    authMethod: 'api-key' as const,
    apiKey: 'secret-api-key',
    baseUrl: 'https://validated.example/',
    activeBlogId: 12,
    activeBlogSubdomain: 'api-blog',
    scopes: ['posts:read'],
  };

  it('normalizes the validated origin and rejects a different configured server', () => {
    expect(getBoundApiKeyBaseUrl(session, 'https://validated.example')).toBe('https://validated.example');
    expect(() => getBoundApiKeyBaseUrl(session, 'https://other.example')).toThrow(
      'differs from the server used for API-key login',
    );
  });

  it('gives an explicit bare flag precedence over INBLOG_API_KEY', () => {
    expect(getApiKeyLoginInput(true, 'environment-key')).toEqual({ shouldPrompt: true });
    expect(getApiKeyLoginInput(undefined, 'environment-key')).toEqual({
      apiKey: 'environment-key',
      shouldPrompt: false,
    });
    expect(getApiKeyLoginInput('argument-key', 'environment-key')).toEqual({
      apiKey: 'argument-key',
      shouldPrompt: false,
    });
  });
});
