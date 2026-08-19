import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalHome = process.env.HOME;
let homeDir: string;

beforeEach(() => {
  homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inblog-cli-session-'));
  vi.resetModules();
  vi.stubEnv('HOME', homeDir);
});

afterEach(() => {
  vi.unstubAllEnvs();
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  fs.rmSync(homeDir, { recursive: true, force: true });
});

describe('token-store session compatibility', () => {
  it('treats a legacy session without authMethod as OAuth', async () => {
    const sessionPath = path.join(homeDir, '.config', 'inblog', 'tokens.json');
    fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
    fs.writeFileSync(sessionPath, JSON.stringify({
      tokens: {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_at: 123,
        user_id: 'user-1',
      },
      activeBlogId: 7,
      activeBlogSubdomain: 'legacy-blog',
    }));

    const { getSessionAuthMethod, isOAuthSession, readSession } = await import('../token-store.js');
    const session = readSession();

    expect(session).not.toBeNull();
    expect(isOAuthSession(session!)).toBe(true);
    expect(getSessionAuthMethod(session!)).toBe('oauth');
  });

  it('persists API-key sessions with restrictive file permissions', async () => {
    const { getSessionAuthMethod, isApiKeySession, readSession, writeSession } = await import('../token-store.js');
    writeSession({
      authMethod: 'api-key',
      apiKey: 'secret-api-key',
      baseUrl: 'https://inblog.ai',
      activeBlogId: 42,
      activeBlogSubdomain: 'api-blog',
      activeBlogPlan: 'team',
      scopes: ['posts:read'],
    });

    const session = readSession();
    const sessionPath = path.join(homeDir, '.config', 'inblog', 'tokens.json');

    expect(session).not.toBeNull();
    expect(isApiKeySession(session!)).toBe(true);
    expect(getSessionAuthMethod(session!)).toBe('api-key');
    expect(fs.statSync(sessionPath).mode & 0o777).toBe(0o600);
  });
});
