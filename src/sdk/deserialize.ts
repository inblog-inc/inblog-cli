import type { JsonApiResource, JsonApiResponse } from './types.js';

/**
 * Resolve included resources for a relationship.
 */
function resolveRelationship(
  rel: { data: { type: string; id: string } | { type: string; id: string }[] | null },
  included: JsonApiResource[],
): any {
  if (!rel.data) return null;

  if (Array.isArray(rel.data)) {
    return rel.data.map((ref) => {
      const found = included.find((r) => r.type === ref.type && r.id === ref.id);
      return found ? flattenResource(found, included) : { id: ref.id, type: ref.type };
    });
  }

  const ref = rel.data as { type: string; id: string };
  const found = included.find((r) => r.type === ref.type && r.id === ref.id);
  return found ? flattenResource(found, included) : { id: ref.id, type: ref.type };
}

/**
 * Flatten a JSON:API resource into a plain object.
 * Merges id + attributes + resolved relationships.
 */
export function flattenResource(
  resource: JsonApiResource,
  included: JsonApiResource[] = [],
): Record<string, any> {
  const result: Record<string, any> = {
    id: resource.id,
    ...resource.attributes,
  };

  if (resource.relationships) {
    for (const [key, rel] of Object.entries(resource.relationships)) {
      result[key] = resolveRelationship(rel, included);
    }
  }

  return result;
}

/**
 * Deserialize a JSON:API response into flat object(s).
 */
export function deserialize<T = Record<string, any>>(
  response: JsonApiResponse<JsonApiResource>,
): T;
export function deserialize<T = Record<string, any>>(
  response: JsonApiResponse<JsonApiResource[]>,
): T[];
export function deserialize<T = Record<string, any>>(
  response: JsonApiResponse,
): T | T[] {
  const included = response.included ?? [];

  if (Array.isArray(response.data)) {
    return response.data.map((r) => flattenResource(r, included)) as T[];
  }

  return flattenResource(response.data, included) as T;
}

/**
 * Extract pagination meta from a JSON:API response.
 */
export function extractMeta(response: JsonApiResponse): {
  total?: number;
  page?: number;
  limit?: number;
  hasNext: boolean;
} {
  return {
    total: response.meta?.total,
    page: response.meta?.page,
    limit: response.meta?.limit,
    hasNext: !!response.links?.next,
  };
}
