import type { InblogClient } from '../client.js';
import type { PreviewToken } from '../types.js';

export class PreviewTokensEndpoint {
  constructor(private client: InblogClient) {}

  async create(
    postId: string,
    options: { ttlHours?: number; oneTime?: boolean; name?: string } = {},
  ): Promise<{ token: string; share_url: string; expires_at: number | null; site: string; name: string | null }> {
    return this.client.rawPost('/preview-tokens', {
      post_id: parseInt(postId, 10),
      ttl_hours: options.ttlHours ?? 24,
      one_time: options.oneTime ?? false,
      name: options.name,
    });
  }

  async list(postId: string): Promise<PreviewToken[]> {
    const res = await this.client.rawGet('/preview-tokens', {
      post_id: postId,
    });
    return res.tokens ?? [];
  }

  async revoke(token: string): Promise<{ ok: boolean; revoked: boolean }> {
    return this.client.rawDelete(`/preview-tokens?token=${encodeURIComponent(token)}`);
  }
}
