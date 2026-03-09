/**
 * Build a JSON:API request body (simplified format).
 * The inblog API accepts both wrapped and unwrapped formats;
 * we use the simplified format: { type, attributes }.
 */
export function serialize(
  type: string,
  attributes: Record<string, any>,
  id?: string,
): { data: { type: string; id?: string; attributes: Record<string, any> } } {
  const resource: { type: string; id?: string; attributes: Record<string, any> } = {
    type,
    attributes,
  };

  if (id !== undefined) {
    resource.id = id;
  }

  return { data: resource };
}
