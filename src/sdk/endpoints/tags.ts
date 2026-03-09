import type { InblogClient } from '../client.js';
import type { Tag, TagCreateInput, TagUpdateInput, TagListOptions } from '../types.js';

export class TagsEndpoint {
  constructor(private client: InblogClient) {}

  async list(options: TagListOptions = {}) {
    const params: Record<string, any> = {};
    if (options.include?.length) params.include = options.include.join(',');
    return this.client.list<Tag>('/v1/tags', params);
  }

  async get(id: string) {
    return this.client.get<Tag>(`/v1/tags/${id}`);
  }

  async create(input: TagCreateInput) {
    return this.client.create<Tag>('/v1/tags', 'tags', input as Record<string, any>);
  }

  async update(id: string, input: TagUpdateInput) {
    return this.client.update<Tag>(`/v1/tags/${id}`, 'tags', id, input as Record<string, any>);
  }

  async delete(id: string) {
    return this.client.delete(`/v1/tags/${id}`);
  }
}
