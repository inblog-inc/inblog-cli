import { Command } from 'commander';
import { select } from '@inquirer/prompts';
import open from 'open';
import { readConfig } from '../utils/config.js';
import { printJson, printSuccess, printDetail, printWarning } from '../utils/output.js';
import { isJsonMode } from '../utils/client-factory.js';
import { handleError } from '../utils/errors.js';
import { generateCodeVerifier, generateCodeChallenge } from '../utils/pkce.js';
import { startCallbackServer } from '../utils/callback-server.js';
import { writeSession, readSession, clearSession } from '../utils/token-store.js';
import { exchangeCodeForTokens, SUPABASE_URL } from '../utils/token-refresh.js';

export function registerAuthCommands(program: Command): void {
  const auth = program.command('auth').description('Manage authentication');

  auth
    .command('login')
    .description('Log in with your Google account')
    .action(async function (this: Command) {
      const json = isJsonMode(this);
      try {
        if (json) {
          throw new Error('Interactive login is not available in --json mode.');
        }

        // Check if already logged in
        const existingSession = readSession();
        if (existingSession) {
          printWarning('Already logged in. Run `inblog auth logout` first to switch accounts.');
          return;
        }

        const codeVerifier = generateCodeVerifier();
        const codeChallenge = generateCodeChallenge(codeVerifier);

        // Start callback server
        const serverPromise = startCallbackServer();

        // Wait a tick for the server to start, then open browser
        await new Promise((r) => setTimeout(r, 100));

        const redirectUri = `http://127.0.0.1:54321/auth/callback`;
        const authUrl = new URL(`${SUPABASE_URL}/auth/v1/authorize`);
        authUrl.searchParams.set('provider', 'google');
        authUrl.searchParams.set('redirect_to', redirectUri);
        authUrl.searchParams.set('code_challenge', codeChallenge);
        authUrl.searchParams.set('code_challenge_method', 'S256');

        console.log('Opening browser for login...');
        await open(authUrl.toString());
        console.log('Waiting for authentication...');

        // Wait for callback
        const { code } = await serverPromise;

        // Exchange code for tokens
        const tokens = await exchangeCodeForTokens(code, codeVerifier);

        // Fetch user's blogs to pick an active one
        const config = readConfig();
        const baseUrl = this.optsWithGlobals().baseUrl || config.baseUrl || 'https://inblog.ai';
        const response = await fetch(`${baseUrl}/api/v1/user/blogs`, {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
            'X-Blog-Id': '0',
            Accept: 'application/vnd.api+json',
          },
        });

        if (!response.ok) {
          writeSession({ tokens });
          printSuccess('Logged in successfully.');
          printWarning('Could not fetch blog list. Run `inblog blogs list` to select a blog.');
          return;
        }

        const blogsData: any = await response.json();
        const blogs = blogsData.data || [];

        if (blogs.length === 0) {
          writeSession({ tokens });
          printSuccess('Logged in, but you have no blogs yet.');
          return;
        }

        let activeBlogId: number;
        let activeBlogSubdomain: string;
        let activeBlogPlan: string | undefined;

        if (blogs.length === 1) {
          activeBlogId = parseInt(blogs[0].id, 10);
          activeBlogSubdomain = blogs[0].attributes.subdomain;
          activeBlogPlan = blogs[0].attributes.plan;
        } else {
          const choices = blogs.map((b: any) => ({
            name: `${b.attributes.title} (${b.attributes.subdomain}) [${b.attributes.permission}]`,
            value: { id: parseInt(b.id, 10), subdomain: b.attributes.subdomain },
          }));

          const selected = await select<{ id: number; subdomain: string }>({
            message: 'Select a blog to use:',
            choices,
          });

          activeBlogId = selected.id;
          activeBlogSubdomain = selected.subdomain;
          const selectedBlog = blogs.find((b: any) => parseInt(b.id, 10) === activeBlogId);
          activeBlogPlan = selectedBlog?.attributes.plan;
        }

        writeSession({
          tokens,
          activeBlogId,
          activeBlogSubdomain,
          activeBlogPlan,
        });

        printSuccess(`Logged in. Active blog: ${activeBlogSubdomain}`);

        if (activeBlogPlan !== 'team' && activeBlogPlan !== 'enterprise') {
          printWarning(`Blog "${activeBlogSubdomain}" is on the ${activeBlogPlan || 'free'} plan.`);
          printWarning('  CLI features require a Team plan or above.');
          printWarning(`  Upgrade: https://inblog.ai/dashboard/${activeBlogSubdomain}/settings/billing`);
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  auth
    .command('logout')
    .description('Log out and clear stored session')
    .action(async function (this: Command) {
      const json = isJsonMode(this);
      try {
        const session = readSession();
        if (!session) {
          if (json) {
            printJson({ success: true, message: 'Already logged out' });
          } else {
            printWarning('Already logged out.');
          }
          return;
        }

        clearSession();
        if (json) {
          printJson({ success: true, message: 'Logged out' });
        } else {
          printSuccess('Logged out.');
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  auth
    .command('status')
    .description('Show current login status')
    .action(async function (this: Command) {
      const json = isJsonMode(this);
      try {
        const session = readSession();
        if (!session) {
          if (json) {
            printJson({ loggedIn: false });
          } else {
            console.log('Not logged in. Run `inblog auth login` to authenticate.');
          }
          return;
        }

        const expiresAt = new Date(session.tokens.expires_at * 1000).toISOString();

        if (json) {
          printJson({
            loggedIn: true,
            userId: session.tokens.user_id,
            activeBlogId: session.activeBlogId,
            activeBlogSubdomain: session.activeBlogSubdomain,
            tokenExpiresAt: expiresAt,
          });
        } else {
          printDetail([
            ['User ID', session.tokens.user_id],
            ['Active Blog', session.activeBlogSubdomain || '—'],
            ['Active Blog ID', session.activeBlogId || '—'],
            ['Token Expires', expiresAt],
          ]);
        }
      } catch (error) {
        handleError(error, json);
      }
    });
}
