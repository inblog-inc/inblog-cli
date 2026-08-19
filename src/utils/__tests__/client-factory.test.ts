import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config.js', () => ({ readConfig: vi.fn(() => ({})) }));
vi.mock('../token-store.js', () => ({
  readSession: vi.fn(),
  isApiKeySession: (session: { authMethod?: string }) => session.authMethod === 'api-key',
}));
vi.mock('../token-refresh.js', () => ({ getValidAccessToken: vi.fn() }));

import { createClientFromCommand, isNoInputMode } from '../client-factory.js';
import { readSession } from '../token-store.js';
import { getValidAccessToken } from '../token-refresh.js';

describe('createClientFromCommand with API-key sessions', () => {
  beforeEach(() => {
    vi.mocked(readSession).mockReturnValue({
      authMethod: 'api-key',
      apiKey: 'secret-api-key',
      baseUrl: 'https://example.test',
      activeBlogId: 12,
      activeBlogSubdomain: 'api-blog',
      activeBlogPlan: 'team',
      scopes: ['posts:read'],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('uses the API key directly and does not install an OAuth refresher', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true })));
    vi.stubGlobal('fetch', fetchMock);
    const command = new Command().option('--base-url <url>');
    command.parse(['node', 'inblog', '--base-url', 'https://example.test']);

    const { client } = createClientFromCommand(command);
    await client.rawGet('/v1/ping');

    expect(fetchMock).toHaveBeenCalledWith('https://example.test/api/v1/ping', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer secret-api-key',
        Accept: 'application/vnd.api+json',
      },
    });
    expect(getValidAccessToken).not.toHaveBeenCalled();
  });

  it('rejects a different explicit API origin before making a request', () => {
    const command = new Command().option('--base-url <url>');
    command.parse(['node', 'inblog', '--base-url', 'https://other.example']);

    expect(() => createClientFromCommand(command)).toThrow(
      'differs from the server used for API-key login',
    );
  });

  it('detects Commander’s negated --no-input option', () => {
    const command = new Command().option('--no-input');
    command.parse(['node', 'inblog', '--no-input']);

    expect(isNoInputMode(command)).toBe(true);
  });
});
