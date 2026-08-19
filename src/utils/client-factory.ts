import { Command } from 'commander';
import { InblogClient } from '../sdk/client.js';
import { readConfig } from './config.js';
import { isApiKeySession, readSession } from './token-store.js';
import { getValidAccessToken } from './token-refresh.js';
import { checkPlanOrExit } from './errors.js';
import { getBoundApiKeyBaseUrl } from './api-key-auth.js';
import { PostsEndpoint } from '../sdk/endpoints/posts.js';
import { TagsEndpoint } from '../sdk/endpoints/tags.js';
import { AuthorsEndpoint } from '../sdk/endpoints/authors.js';
import { BlogsEndpoint } from '../sdk/endpoints/blogs.js';
import { RedirectsEndpoint } from '../sdk/endpoints/redirects.js';
import { FormsEndpoint, FormResponsesEndpoint } from '../sdk/endpoints/forms.js';
import { SearchConsoleEndpoint } from '../sdk/endpoints/search-console.js';
import { AnalyticsEndpoint } from '../sdk/endpoints/analytics.js';
import { PreviewTokensEndpoint } from '../sdk/endpoints/preview-tokens.js';

export interface ClientContext {
  client: InblogClient;
  posts: PostsEndpoint;
  tags: TagsEndpoint;
  authors: AuthorsEndpoint;
  blogs: BlogsEndpoint;
  redirects: RedirectsEndpoint;
  forms: FormsEndpoint;
  formResponses: FormResponsesEndpoint;
  searchConsole: SearchConsoleEndpoint;
  analytics: AnalyticsEndpoint;
  previewTokens: PreviewTokensEndpoint;
}

/**
 * Create SDK client from CLI global options.
 */
export function createClientFromCommand(cmd: Command): ClientContext {
  const opts = cmd.optsWithGlobals();
  const config = readConfig();

  const session = readSession();
  if (!session) {
    throw new Error('Not logged in. Run `inblog auth login` to authenticate.');
  }

  const requestedBaseUrl = opts.baseUrl || config.baseUrl;
  const baseUrl = isApiKeySession(session)
    ? getBoundApiKeyBaseUrl(session, requestedBaseUrl)
    : requestedBaseUrl || 'https://inblog.ai';

  checkPlanOrExit();

  if (!session.activeBlogId || !session.activeBlogSubdomain) {
    throw new Error(
      'No active blog selected. Run `inblog blogs switch` to select a blog.',
    );
  }

  const client = isApiKeySession(session)
    ? new InblogClient({
      apiKey: session.apiKey,
      baseUrl,
      blogId: session.activeBlogId,
      blogSubdomain: session.activeBlogSubdomain,
    })
    : new InblogClient({
      accessToken: session.tokens.access_token,
      baseUrl,
      blogId: session.activeBlogId,
      blogSubdomain: session.activeBlogSubdomain,
    });

  if (!isApiKeySession(session)) {
    client.setTokenRefresher(getValidAccessToken);
  }

  return {
    client,
    posts: new PostsEndpoint(client),
    tags: new TagsEndpoint(client),
    authors: new AuthorsEndpoint(client),
    blogs: new BlogsEndpoint(client),
    redirects: new RedirectsEndpoint(client),
    forms: new FormsEndpoint(client),
    formResponses: new FormResponsesEndpoint(client),
    searchConsole: new SearchConsoleEndpoint(client),
    analytics: new AnalyticsEndpoint(client),
    previewTokens: new PreviewTokensEndpoint(client),
  };
}

/**
 * Get global --json flag value from command hierarchy.
 */
export function isJsonMode(cmd: Command): boolean {
  return cmd.optsWithGlobals().json === true;
}

/**
 * Get global --no-input flag value from command hierarchy.
 * When true, interactive prompts should fail instead of prompting.
 */
export function isNoInputMode(cmd: Command): boolean {
  return cmd.optsWithGlobals().input === false;
}
