import { describe, it, expect } from 'vitest';
import { serialize } from '../serialize.js';

describe('serialize', () => {
  it('should create a JSON:API request body for create', () => {
    const result = serialize('posts', { title: 'Hello', slug: 'hello' });
    expect(result).toEqual({
      data: {
        type: 'posts',
        attributes: { title: 'Hello', slug: 'hello' },
      },
    });
  });

  it('should include id for update', () => {
    const result = serialize('posts', { title: 'Updated' }, '42');
    expect(result).toEqual({
      data: {
        type: 'posts',
        id: '42',
        attributes: { title: 'Updated' },
      },
    });
  });

  it('should handle empty attributes', () => {
    const result = serialize('tags', {});
    expect(result.data.type).toBe('tags');
    expect(result.data.attributes).toEqual({});
  });
});
