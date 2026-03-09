import { describe, it, expect } from 'vitest';
import { deserialize, flattenResource, extractMeta } from '../deserialize.js';
import type { JsonApiResponse, JsonApiResource } from '../types.js';

describe('flattenResource', () => {
  it('should flatten a simple resource', () => {
    const resource: JsonApiResource = {
      type: 'posts',
      id: '42',
      attributes: {
        title: 'Hello World',
        slug: 'hello-world',
        published: true,
      },
    };

    const result = flattenResource(resource);
    expect(result).toEqual({
      id: '42',
      title: 'Hello World',
      slug: 'hello-world',
      published: true,
    });
  });

  it('should resolve to-one relationships', () => {
    const resource: JsonApiResource = {
      type: 'posts',
      id: '1',
      attributes: { title: 'Post' },
      relationships: {
        blog: {
          data: { type: 'blogs', id: 'myblog' },
        },
      },
    };

    const included: JsonApiResource[] = [
      {
        type: 'blogs',
        id: 'myblog',
        attributes: { title: 'My Blog', subdomain: 'myblog' },
      },
    ];

    const result = flattenResource(resource, included);
    expect(result.blog).toEqual({
      id: 'myblog',
      title: 'My Blog',
      subdomain: 'myblog',
    });
  });

  it('should resolve to-many relationships', () => {
    const resource: JsonApiResource = {
      type: 'posts',
      id: '1',
      attributes: { title: 'Post' },
      relationships: {
        tags: {
          data: [
            { type: 'tags', id: '10' },
            { type: 'tags', id: '20' },
          ],
        },
      },
    };

    const included: JsonApiResource[] = [
      { type: 'tags', id: '10', attributes: { name: 'JS', slug: 'js', priority: 1 } },
      { type: 'tags', id: '20', attributes: { name: 'TS', slug: 'ts', priority: 2 } },
    ];

    const result = flattenResource(resource, included);
    expect(result.tags).toHaveLength(2);
    expect(result.tags[0]).toEqual({ id: '10', name: 'JS', slug: 'js', priority: 1 });
    expect(result.tags[1]).toEqual({ id: '20', name: 'TS', slug: 'ts', priority: 2 });
  });

  it('should handle null relationships', () => {
    const resource: JsonApiResource = {
      type: 'posts',
      id: '1',
      attributes: { title: 'Post' },
      relationships: {
        blog: { data: null },
      },
    };

    const result = flattenResource(resource);
    expect(result.blog).toBeNull();
  });

  it('should return ref when included resource not found', () => {
    const resource: JsonApiResource = {
      type: 'posts',
      id: '1',
      attributes: { title: 'Post' },
      relationships: {
        blog: { data: { type: 'blogs', id: 'missing' } },
      },
    };

    const result = flattenResource(resource, []);
    expect(result.blog).toEqual({ id: 'missing', type: 'blogs' });
  });
});

describe('deserialize', () => {
  it('should deserialize a single resource response', () => {
    const response: JsonApiResponse<JsonApiResource> = {
      jsonapi: { version: '1.0' },
      data: {
        type: 'posts',
        id: '42',
        attributes: { title: 'Test', slug: 'test' },
      },
    };

    const result = deserialize(response);
    expect(result).toEqual({ id: '42', title: 'Test', slug: 'test' });
  });

  it('should deserialize a collection response', () => {
    const response: JsonApiResponse<JsonApiResource[]> = {
      jsonapi: { version: '1.0' },
      data: [
        { type: 'tags', id: '1', attributes: { name: 'A', slug: 'a', priority: 1 } },
        { type: 'tags', id: '2', attributes: { name: 'B', slug: 'b', priority: 2 } },
      ],
    };

    const result = deserialize(response);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: '1', name: 'A', slug: 'a', priority: 1 });
  });

  it('should handle included resources in a collection', () => {
    const response: JsonApiResponse<JsonApiResource[]> = {
      jsonapi: { version: '1.0' },
      data: [
        {
          type: 'posts',
          id: '1',
          attributes: { title: 'Post 1' },
          relationships: {
            tags: { data: [{ type: 'tags', id: '10' }] },
          },
        },
      ],
      included: [
        { type: 'tags', id: '10', attributes: { name: 'JS', slug: 'js', priority: 0 } },
      ],
    };

    const result = deserialize(response);
    expect(result[0].tags).toHaveLength(1);
    expect(result[0].tags[0].name).toBe('JS');
  });
});

describe('extractMeta', () => {
  it('should extract pagination meta', () => {
    const response: JsonApiResponse = {
      jsonapi: { version: '1.0' },
      data: [],
      meta: { total: 100, page: 2, limit: 10 },
      links: {
        self: '/v1/posts?page=2',
        next: '/v1/posts?page=3',
      },
    };

    const meta = extractMeta(response);
    expect(meta.total).toBe(100);
    expect(meta.page).toBe(2);
    expect(meta.limit).toBe(10);
    expect(meta.hasNext).toBe(true);
  });

  it('should handle missing pagination', () => {
    const response: JsonApiResponse = {
      jsonapi: { version: '1.0' },
      data: { type: 'posts', id: '1', attributes: {} },
    };

    const meta = extractMeta(response);
    expect(meta.total).toBeUndefined();
    expect(meta.hasNext).toBe(false);
  });
});
