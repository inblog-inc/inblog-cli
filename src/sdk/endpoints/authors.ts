import type { InblogClient } from '../client.js';
import type { Author, AuthorUpdateInput, AuthorListOptions } from '../types.js';

export class AuthorsEndpoint {
  constructor(private client: InblogClient) {}

  async list(options: AuthorListOptions = {}) {
    const params: Record<string, any> = {};
    if (options.page) params.page = options.page;
    if (options.limit) params.limit = options.limit;
    if (options.include?.length) params.include = options.include.join(',');
    return this.client.list<Author>('/v1/authors', params);
  }

  async get(id: string) {
    return this.client.get<Author>(`/v1/authors/${id}`);
  }

  async update(id: string, input: AuthorUpdateInput) {
    return this.client.update<Author>(
      `/v1/authors/${id}`,
      'authors',
      id,
      input as Record<string, any>,
    );
  }
}
