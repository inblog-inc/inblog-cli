import type { InblogClient } from '../client.js';
import type {
  Post, Author, Tag, PostCreateInput, PostUpdateInput, PostListOptions,
} from '../types.js';

export class PostsEndpoint {
  constructor(private client: InblogClient) {}

  async list(options: PostListOptions = {}) {
    const params: Record<string, any> = {};
    if (options.page) params.page = options.page;
    if (options.limit) params.limit = options.limit;
    if (options.sort) params.sort = options.sort;
    if (options.order) params.order = options.order;
    if (options.include?.length) params.include = options.include.join(',');
    if (options.filter) params.filter = options.filter;
    return this.client.list<Post>('/v1/posts', params);
  }

  async get(id: string, include?: string[]) {
    const params: Record<string, any> = {};
    if (include?.length) params.include = include.join(',');
    return this.client.get<Post>(`/v1/posts/${id}`, params);
  }

  async create(input: PostCreateInput) {
    const { tag_ids, author_ids, ...attributes } = input;
    const attrs: Record<string, any> = { ...attributes };
    if (tag_ids) attrs.tag_ids = tag_ids;
    if (author_ids) attrs.author_ids = author_ids;
    return this.client.create<Post>('/v1/posts', 'posts', attrs, {
      include: 'tags,authors',
    });
  }

  async update(id: string, input: PostUpdateInput) {
    return this.client.update<Post>(`/v1/posts/${id}`, 'posts', id, input as Record<string, any>);
  }

  async delete(id: string) {
    return this.client.delete(`/v1/posts/${id}`);
  }

  async publish(id: string) {
    return this.client.patch<Post>(`/v1/posts/${id}/publish`, {
      data: { type: 'publish_action', attributes: { action: 'publish' } },
    });
  }

  async unpublish(id: string) {
    return this.client.patch<Post>(`/v1/posts/${id}/publish`, {
      data: { type: 'publish_action', attributes: { action: 'unpublish' } },
    });
  }

  async schedule(id: string, scheduledAt: string) {
    return this.client.patch<Post>(`/v1/posts/${id}/publish`, {
      data: { type: 'publish_action', attributes: { action: 'schedule', published_at: scheduledAt } },
    });
  }

  // ── Relationship management ──

  async listTags(postId: string) {
    return this.client.list<Tag>(`/v1/posts/${postId}/tags`);
  }

  async addTags(postId: string, tagIds: number[]) {
    return this.client.post<Post>(`/v1/posts/${postId}/tags`, {
      data: tagIds.map((id) => ({ id })),
    });
  }

  async removeTag(postId: string, tagId: string) {
    return this.client.delete(`/v1/posts/${postId}/tags/${tagId}`);
  }

  async listAuthors(postId: string) {
    return this.client.list<Author>(`/v1/posts/${postId}/authors`);
  }

  async addAuthors(postId: string, authorIds: string[]) {
    return this.client.post<Post>(`/v1/posts/${postId}/authors`, {
      data: authorIds.map((id) => ({ id })),
    });
  }

  async removeAuthor(postId: string, authorId: string) {
    return this.client.delete(`/v1/posts/${postId}/authors/${authorId}`);
  }
}
