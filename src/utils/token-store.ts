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

export interface StoredSession {
  tokens: StoredTokens;
  activeBlogId?: number;
  activeBlogSubdomain?: string;
  activeBlogPlan?: string;
}

function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function readSession(): StoredSession | null {
  if (!fs.existsSync(TOKENS_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf-8'));
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
