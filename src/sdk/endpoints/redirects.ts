import type { InblogClient } from '../client.js';
import type { Redirect, RedirectCreateInput, RedirectUpdateInput, RedirectListOptions } from '../types.js';

export class RedirectsEndpoint {
  constructor(private client: InblogClient) {}

  async list(options: RedirectListOptions = {}) {
    const params: Record<string, any> = {};
    if (options.page) params.page = options.page;
    if (options.limit) params.limit = options.limit;
    return this.client.list<Redirect>('/v1/redirects', params);
  }

  async get(id: string) {
    return this.client.get<Redirect>(`/v1/redirects/${id}`);
  }

  async create(input: RedirectCreateInput) {
    return this.client.create<Redirect>('/v1/redirects', 'redirects', input as Record<string, any>);
  }

  async update(id: string, input: RedirectUpdateInput) {
    return this.client.update<Redirect>(
      `/v1/redirects/${id}`,
      'redirects',
      id,
      input as Record<string, any>,
    );
  }

  async delete(id: string) {
    return this.client.delete(`/v1/redirects/${id}`);
  }
}
