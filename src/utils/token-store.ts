import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const CONFIG_DIR = path.join(os.homedir(), '.config', 'inblog');
const TOKENS_FILE = path.join(CONFIG_DIR, 'tokens.json');

export interface StoredTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user_id: string;
}

interface StoredSessionBase {
  tokens: StoredTokens;
  activeBlogId?: number;
  activeBlogSubdomain?: string;
  activeBlogPlan?: string;
  activeBlogTitle?: string;
}

/**
 * OAuth sessions created before authMethod was introduced omit the field.
 * Keep that representation valid so existing CLI logins continue to work.
 */
export interface StoredOAuthSession extends StoredSessionBase {
  authMethod?: 'oauth';
}

export interface StoredApiKeySession {
  authMethod: 'api-key';
  apiKey: string;
  /**
   * Normalized server origin validated during API-key login. Older API-key
   * sessions may not have this and must be re-authenticated before use.
   */
  baseUrl?: string;
  activeBlogId: number;
  activeBlogSubdomain: string;
  activeBlogPlan?: string;
  activeBlogTitle?: string;
  scopes: string[];
}

export type StoredSession = StoredOAuthSession | StoredApiKeySession;

export function isApiKeySession(session: StoredSession): session is StoredApiKeySession {
  return session.authMethod === 'api-key';
}

export function isOAuthSession(session: StoredSession): session is StoredOAuthSession {
  return !isApiKeySession(session);
}

export function getSessionAuthMethod(session: StoredSession): 'oauth' | 'api-key' {
  return isApiKeySession(session) ? 'api-key' : 'oauth';
}

function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function readSession(): StoredSession | null {
  if (!fs.existsSync(TOKENS_FILE)) return null;
  try {
    const session: unknown = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf-8'));
    if (!session || typeof session !== 'object') return null;

    const candidate = session as Partial<StoredSession>;
    if (candidate.authMethod === 'api-key') {
      return typeof candidate.apiKey === 'string'
        && (candidate.baseUrl === undefined || typeof candidate.baseUrl === 'string')
        && typeof candidate.activeBlogId === 'number'
        && typeof candidate.activeBlogSubdomain === 'string'
        && Array.isArray(candidate.scopes)
        ? candidate as StoredApiKeySession
        : null;
    }

    const oauthCandidate = candidate as { tokens?: Partial<StoredTokens> };
    return oauthCandidate.tokens && typeof oauthCandidate.tokens.access_token === 'string'
      ? candidate as StoredOAuthSession
      : null;
  } catch {
    return null;
  }
}

export function writeSession(session: StoredSession): void {
  ensureConfigDir();
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(session, null, 2) + '\n', {
    encoding: 'utf-8',
    mode: 0o600,
  });
  fs.chmodSync(TOKENS_FILE, 0o600);
}

export function clearSession(): void {
  if (fs.existsSync(TOKENS_FILE)) {
    fs.unlinkSync(TOKENS_FILE);
  }
}

export function setActiveBlog(blogId: number, subdomain: string, plan?: string): void {
  const session = readSession();
  if (!session) {
    throw new Error('Not logged in. Run `inblog auth login` first.');
  }
  session.activeBlogId = blogId;
  session.activeBlogSubdomain = subdomain;
  if (plan !== undefined) session.activeBlogPlan = plan;
  writeSession(session);
}
