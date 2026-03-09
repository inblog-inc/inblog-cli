import { readSession, writeSession, type StoredSession, type StoredTokens } from './token-store.js';

const SUPABASE_URL =
  process.env.INBLOG_SUPABASE_URL || 'https://fgobbnslcbjgothosvni.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.INBLOG_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZnb2JibnNsY2JqZ290aG9zdm5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE2Nzc5OTc1MzYsImV4cCI6MTk5MzU3MzUzNn0.cFlx12_PLf42IHJseAxiYOw7MFiS2FOSRgbSZQNDiEo';

// Refresh buffer: refresh 60 seconds before actual expiry
const REFRESH_BUFFER_SECONDS = 60;

export { SUPABASE_URL, SUPABASE_ANON_KEY };

function isTokenExpiringSoon(session: StoredSession): boolean {
  const now = Math.floor(Date.now() / 1000);
  return session.tokens.expires_at - now < REFRESH_BUFFER_SECONDS;
}

async function refreshTokens(refreshToken: string): Promise<StoredTokens> {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    throw new Error('Session expired. Run `inblog auth login` to re-authenticate.');
  }

  const data: any = await response.json();

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
    user_id: data.user?.id || '',
  };
}

/**
 * Get a valid access token, refreshing if needed.
 * Returns null if no OAuth session exists.
 */
export async function getValidAccessToken(): Promise<string | null> {
  const session = readSession();
  if (!session) return null;

  if (!isTokenExpiringSoon(session)) {
    return session.tokens.access_token;
  }

  // Refresh the token
  const newTokens = await refreshTokens(session.tokens.refresh_token);
  session.tokens = newTokens;
  writeSession(session);

  return newTokens.access_token;
}

/**
 * Exchange authorization code for tokens using PKCE.
 */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
): Promise<StoredTokens> {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=pkce`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      auth_code: code,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Token exchange failed: ${errorData}`);
  }

  const data: any = await response.json();

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
    user_id: data.user?.id || '',
  };
}
