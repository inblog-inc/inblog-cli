import { Command } from 'commander';
import { InblogClient } from '../sdk/client.js';
import { readConfig } from './config.js';
import { readSession } from './token-store.js';
import { getValidAccessToken } from './token-refresh.js';
import { checkPlanOrExit } from './errors.js';
import { PostsEndpoint } from '../sdk/endpoints/posts.js';
import { TagsEndpoint } from '../sdk/endpoints/tags.js';
import { AuthorsEndpoint } from '../sdk/endpoints/authors.js';
import { BlogsEndpoint } from '../sdk/endpoints/blogs.js';
import { RedirectsEndpoint } from '../sdk/endpoints/redirects.js';
import { FormsEndpoint, FormResponsesEndpoint } from '../sdk/endpoints/forms.js';
import { SearchConsoleEndpoint } from '../sdk/endpoints/search-console.js';
import { AnalyticsEndpoint } from '../sdk/endpoints/analytics.js';

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
}

/**
 * Create SDK client from CLI global options.
 */
export function createClientFromCommand(cmd: Command): ClientContext {
  checkPlanOrExit();
  const opts = cmd.optsWithGlobals();
  const config = readConfig();
  const baseUrl = opts.baseUrl || config.baseUrl || 'https://inblog.ai';

  const session = readSession();
  if (!session) {
    throw new Error('Not logged in. Run `inblog auth login` to authenticate.');
  }

  if (!session.activeBlogId || !session.activeBlogSubdomain) {
    throw new Error(
      'No active blog selected. Run `inblog blogs switch` to select a blog.',
    );
  }

  const client = new InblogClient({
    accessToken: session.tokens.access_token,
    baseUrl,
    blogId: session.activeBlogId,
    blogSubdomain: session.activeBlogSubdomain,
  });
  client.setTokenRefresher(getValidAccessToken);

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
  return cmd.optsWithGlobals().noInput === true;
}
