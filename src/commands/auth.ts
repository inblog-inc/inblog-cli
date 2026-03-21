import { Command } from 'commander';
import open from 'open';
import { readConfig } from '../utils/config.js';
import { printJson, printSuccess, printDetail, printWarning } from '../utils/output.js';
import { isJsonMode } from '../utils/client-factory.js';
import { handleError } from '../utils/errors.js';
import { generateCodeVerifier, generateCodeChallenge } from '../utils/pkce.js';
import { createAuthServer } from '../utils/callback-server.js';
import { writeSession, readSession, clearSession } from '../utils/token-store.js';
import { exchangeCodeForTokens, SUPABASE_URL } from '../utils/token-refresh.js';

export function registerAuthCommands(program: Command): void {
  const auth = program.command('auth').description('Manage authentication')
    .addHelpText('after', `
Examples:
  $ inblog auth login                          Log in with Google OAuth
  $ inblog auth login --blog my-blog           Log in and select blog by subdomain
  $ inblog auth status --json                  Check login status as JSON
  $ inblog auth logout                         Clear stored session`);

  auth
    .command('login')
    .description('Log in with your Google account')
    .option('--blog <id-or-subdomain>', 'Select blog by ID or subdomain (skips browser blog selection)')
    .action(async function (this: Command) {
      const json = isJsonMode(this);
      const blogArg: string | undefined = this.opts().blog;
      try {
        // Check if already logged in
        const existingSession = readSession();
        if (existingSession) {
          printWarning('Already logged in. Run `inblog auth logout` first to switch accounts.');
          return;
        }

        const codeVerifier = generateCodeVerifier();
        const codeChallenge = generateCodeChallenge(codeVerifier);

        // Start auth server (handles OAuth callback + browser blog selection)
        const server = await createAuthServer();

        const redirectUri = `http://127.0.0.1:${server.port}/auth/callback`;
        const authUrl = new URL(`${SUPABASE_URL}/auth/v1/authorize`);
        authUrl.searchParams.set('provider', 'google');
        authUrl.searchParams.set('redirect_to', redirectUri);
        authUrl.searchParams.set('code_challenge', codeChallenge);
        authUrl.searchParams.set('code_challenge_method', 'S256');

        if (!json) {
          console.log('Opening browser for login...');
        }
        await open(authUrl.toString());
        if (!json) {
          console.log('Waiting for authentication...');
        }

        // Phase 1: Wait for OAuth callback
        const code = await server.waitForCode();

        // Exchange code for tokens
        const tokens = await exchangeCodeForTokens(code, codeVerifier);

        // Fetch user's blogs
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
          server.close();
          writeSession({ tokens });
          printSuccess('Logged in successfully.');
          printWarning('Could not fetch blog list. Run `inblog blogs list` to select a blog.');
          return;
        }

        const blogsData: any = await response.json();
        const blogs = blogsData.data || [];

        if (blogs.length === 0) {
          server.close();
          writeSession({ tokens });
          if (json) {
            printJson({ success: true, message: 'Logged in, but you have no blogs yet.' });
          } else {
            printSuccess('Logged in, but you have no blogs yet.');
          }
          return;
        }

        // Phase 2: Blog selection (in browser or via --blog flag)
        if (blogArg) {
          // --blog flag: match by ID or subdomain
          const target = blogs.find((b: any) => b.id === blogArg || b.attributes.subdomain === blogArg);
          if (!target) {
            server.close();
            throw new Error(`Blog not found: ${blogArg}. Run \`inblog blogs list\` to see available blogs.`);
          }
          server.setAutoSelectedBlog({
            id: parseInt(target.id, 10),
            subdomain: target.attributes.subdomain,
            plan: target.attributes.plan,
          });
        } else if (blogs.length === 1) {
          // Single blog: auto-select
          server.setAutoSelectedBlog({
            id: parseInt(blogs[0].id, 10),
            subdomain: blogs[0].attributes.subdomain,
            plan: blogs[0].attributes.plan,
          });
        } else {
          // Multiple blogs: show selection UI in browser
          if (!json) {
            console.log('Multiple blogs found. Please select one in your browser...');
          }
          server.setBlogs(blogs.map((b: any) => ({
            id: parseInt(b.id, 10),
            title: b.attributes.title,
            subdomain: b.attributes.subdomain,
            permission: b.attributes.permission,
            plan: b.attributes.plan,
          })));
        }

        // Wait for blog selection (resolves immediately for auto-selected)
        const selectedBlog = await server.waitForBlogSelection();
        server.close();

        writeSession({
          tokens,
          activeBlogId: selectedBlog.id,
          activeBlogSubdomain: selectedBlog.subdomain,
          activeBlogPlan: selectedBlog.plan,
        });

        if (json) {
          printJson({
            success: true,
            blogId: selectedBlog.id,
            subdomain: selectedBlog.subdomain,
            plan: selectedBlog.plan,
          });
        } else {
          printSuccess(`Logged in. Active blog: ${selectedBlog.subdomain}`);
        }

        if (selectedBlog.plan !== 'team' && selectedBlog.plan !== 'enterprise') {
          printWarning(`Blog "${selectedBlog.subdomain}" is on the ${selectedBlog.plan || 'free'} plan.`);
          printWarning('  CLI features require a Team plan or above.');
          printWarning(`  Upgrade: https://inblog.ai/dashboard/${selectedBlog.subdomain}/settings/billing`);
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
