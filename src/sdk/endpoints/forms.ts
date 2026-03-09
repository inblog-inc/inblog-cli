import type { InblogClient } from '../client.js';
import type { Form, FormResponse, FormListOptions, FormResponseListOptions } from '../types.js';

export class FormsEndpoint {
  constructor(private client: InblogClient) {}

  async list(options: FormListOptions = {}) {
    const params: Record<string, any> = {};
    if (options.page) params.page = options.page;
    if (options.limit) params.limit = options.limit;
    return this.client.list<Form>('/v1/forms', params);
  }

  async get(id: string) {
    return this.client.get<Form>(`/v1/forms/${id}`);
  }
}

export class FormResponsesEndpoint {
  constructor(private client: InblogClient) {}

  async list(options: FormResponseListOptions = {}) {
    const params: Record<string, any> = {};
    if (options.page) params.page = options.page;
    if (options.limit) params.limit = options.limit;
    if (options.filter) params.filter = options.filter;
    return this.client.list<FormResponse>('/v1/form-responses', params);
  }

  async get(id: string) {
    return this.client.get<FormResponse>(`/v1/form-responses/${id}`);
  }
}
