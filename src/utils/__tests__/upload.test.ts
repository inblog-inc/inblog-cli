import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  readConfig: vi.fn(),
  readSession: vi.fn(),
  getValidAccessToken: vi.fn(),
}));

vi.mock('../config.js', () => ({ readConfig: mocks.readConfig }));
vi.mock('../token-store.js', () => ({
  readSession: mocks.readSession,
  isApiKeySession: (session: { authMethod?: string }) => session.authMethod === 'api-key',
}));
vi.mock('../token-refresh.js', () => ({ getValidAccessToken: mocks.getValidAccessToken }));

import { uploadImage } from '../upload.js';

let tempDir: string;
let imagePath: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inblog-cli-upload-'));
  imagePath = path.join(tempDir, 'image.png');
  fs.writeFileSync(imagePath, 'image');
  mocks.readConfig.mockReturnValue({});
  mocks.readSession.mockReturnValue({
    authMethod: 'api-key',
    apiKey: 'secret-api-key',
    baseUrl: 'https://validated.example',
    activeBlogId: 12,
    activeBlogSubdomain: 'api-blog',
    scopes: ['posts:write'],
  });
  mocks.getValidAccessToken.mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('uploadImage with API-key sessions', () => {
  it('uses the validated API-key origin for uploads', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ publicUrl: 'https://cdn.example/image.png' })));
    vi.stubGlobal('fetch', fetchMock);

    await expect(uploadImage(imagePath, 'post_image')).resolves.toBe(
      'https://cdn.example/image.png',
    );

    const [url, options] = fetchMock.mock.calls[0];
    expect((url as URL).origin).toBe('https://validated.example');
    expect(options.headers).toMatchObject({ Authorization: 'Bearer secret-api-key' });
    expect(options.headers).not.toHaveProperty('X-Blog-Id');
  });

  it('rejects a different configured origin before sending the API key', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    mocks.readConfig.mockReturnValue({ baseUrl: 'https://other.example' });

    await expect(uploadImage(imagePath, 'post_image')).rejects.toThrow(
      'differs from the server used for API-key login',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
