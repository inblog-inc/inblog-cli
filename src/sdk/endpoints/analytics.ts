import type { InblogClient } from '../client.js';

export class AnalyticsEndpoint {
  constructor(private client: InblogClient) {}

  async traffic(options: { start_date?: string; end_date?: string; interval?: string; type?: string } = {}) {
    return this.client.rawGet('/v1/blogs/analytics/traffic', options);
  }

  async posts(options: { start_date?: string; end_date?: string; sort?: string; order?: string; limit?: number; include?: string } = {}) {
    return this.client.rawGet('/v1/blogs/analytics/posts', options);
  }

  async sources(options: { start_date?: string; end_date?: string; limit?: number } = {}) {
    return this.client.rawGet('/v1/blogs/analytics/sources', options);
  }

  async postTraffic(postId: number, options: { start_date?: string; end_date?: string; interval?: string } = {}) {
    return this.client.rawGet(`/v1/blogs/analytics/posts/${postId}`, options);
  }

  async postSources(postId: number, options: { start_date?: string; end_date?: string; limit?: number } = {}) {
    return this.client.rawGet(`/v1/blogs/analytics/posts/${postId}/sources`, options);
  }
}
