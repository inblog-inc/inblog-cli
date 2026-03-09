import type { InblogClient } from '../client.js';

export class SearchConsoleEndpoint {
  constructor(private client: InblogClient) {}

  async oauthUrl(redirectUri?: string) {
    const params: Record<string, string> = {};
    if (redirectUri) params.redirect_uri = redirectUri;
    return this.client.rawGet('/v1/blogs/search-console/oauth-url', params);
  }

  async connect(code: string, redirectUri: string) {
    return this.client.rawPost('/v1/blogs/search-console/connect', { code, redirect_uri: redirectUri });
  }

  async status() {
    return this.client.rawGet('/v1/blogs/search-console/status');
  }

  async disconnect() {
    return this.client.rawDelete('/v1/blogs/search-console/disconnect');
  }

  async keywords(options: { start_date?: string; end_date?: string; limit?: number; sort?: string; order?: string } = {}) {
    return this.client.rawGet('/v1/blogs/search-console/keywords', options);
  }

  async pages(options: { start_date?: string; end_date?: string; limit?: number; sort?: string; order?: string } = {}) {
    return this.client.rawGet('/v1/blogs/search-console/pages', options);
  }
}
