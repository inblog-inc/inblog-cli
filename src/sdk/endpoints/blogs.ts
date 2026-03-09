import type { InblogClient } from '../client.js';
import type { Blog, BlogUpdateInput } from '../types.js';

export class BlogsEndpoint {
  constructor(private client: InblogClient) {}

  async me() {
    return this.client.get<Blog>('/v1/blogs/me');
  }

  async update(subdomain: string, input: BlogUpdateInput) {
    return this.client.update<Blog>(
      `/v1/blogs/${subdomain}`,
      'blogs',
      subdomain,
      input as Record<string, any>,
    );
  }

  // Domain management (plain JSON endpoints, not JSON:API)

  async domainConnect(domain: string) {
    return this.client.rawPost('/v1/blogs/domain', { custom_domain: domain });
  }

  async domainStatus() {
    return this.client.rawGet('/v1/blogs/domain');
  }

  async domainDisconnect() {
    return this.client.rawDelete('/v1/blogs/domain');
  }

  // Custom UI / Banner (plain JSON endpoints)

  async getCustomUi() {
    return this.client.rawGet('/v1/blogs/custom-ui');
  }

  async updateCustomUi(input: Record<string, any>) {
    return this.client.rawPatch('/v1/blogs/custom-ui', input);
  }
}
