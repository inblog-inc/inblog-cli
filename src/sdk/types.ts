// ── JSON:API wire types ──

export interface JsonApiResource {
  type: string;
  id: string;
  attributes: Record<string, any>;
  relationships?: Record<string, {
    data: { type: string; id: string } | { type: string; id: string }[] | null;
  }>;
  links?: { self: string };
}

export interface JsonApiResponse<T = JsonApiResource | JsonApiResource[]> {
  jsonapi: { version: '1.0' };
  data: T;
  included?: JsonApiResource[];
  meta?: Record<string, any>;
  links?: {
    self: string;
    next?: string;
    prev?: string;
    first?: string;
    last?: string;
  };
}

export interface JsonApiError {
  status: string;
  code: string;
  title: string;
  detail?: string;
  meta?: Record<string, any>;
}

export interface JsonApiErrorResponse {
  jsonapi: { version: '1.0' };
  errors: JsonApiError[];
}

// ── Domain types (flat, deserialized) ──

export interface Post {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  content_html: string | null;
  content_type: 'tiptap' | 'notion';
  published: boolean;
  published_at: string | null;
  image: { url: string; blurhash?: string; created_at?: string } | null;
  canonical_url: string | null;
  notion_url: string | null;
  meta_title: string | null;
  meta_description: string | null;
  cta_text: string | null;
  cta_link: string | null;
  cta_color: string | null;
  cta_text_color: string | null;
  custom_scripts: {
    head_start_script: string | null;
    head_end_script: string | null;
    body_start_script: string | null;
    body_end_script: string | null;
    json_ld_script: string | null;
  } | null;
  tags?: Tag[];
  authors?: Author[];
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  priority: number;
}

export interface Author {
  id: string;
  author_name: string;
  avatar_url: string | null;
}

export interface Blog {
  id: number;
  title: string;
  subdomain: string;
  description: string | null;
  custom_domain: string | null;
  custom_domain_verified: boolean;
  custom_subdirectory: string | null;
  logo: string | null;
  logo_url: string | null;
  favicon: string | null;
  og_image: string | null;
  blog_language: string;
  timezone_diff: number;
  plan: string;
  ga_measurement_id: string | null;
  is_search_console_connected: boolean;
  search_console_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Redirect {
  id: string;
  from_path: string;
  to_path: string;
  redirect_type: 307 | 308;
  created_at: string;
  updated_at: string;
}

export interface Form {
  id: string;
  title: string;
  form_setting: any;
  magnet_type: string | null;
  magnet_url: string | null;
  magnet_file_src: string | null;
  submit_email_setting: any;
  thx_msg_setting: any;
  created_at: string;
  response_count: number;
}

export interface FormResponse {
  id: string;
  email: string;
  response: any;
  country: string | null;
  city: string | null;
  region: string | null;
  timezone: string | null;
  language: string | null;
  created_at: string;
}

// ── Request types ──

export interface PostCreateInput {
  title: string;
  slug?: string;
  description?: string;
  content_html?: string;
  published?: boolean;
  published_at?: string;
  image?: { url: string; blurhash?: string; created_at?: string };
  canonical_url?: string;
  notion_url?: string;
  meta_title?: string;
  meta_description?: string;
  cta_text?: string;
  cta_link?: string;
  cta_color?: string;
  cta_text_color?: string;
  tag_ids?: number[];
  author_ids?: string[];
}

export interface PostUpdateInput {
  title?: string;
  slug?: string;
  description?: string;
  content_html?: string;
  published?: boolean;
  published_at?: string;
  image?: { url: string; blurhash?: string; created_at?: string } | null;
  canonical_url?: string | null;
  notion_url?: string;
  meta_title?: string | null;
  meta_description?: string | null;
  cta_text?: string | null;
  cta_link?: string | null;
  cta_color?: string | null;
  cta_text_color?: string | null;
}

export interface TagCreateInput {
  name: string;
  slug?: string;
  priority?: number;
}

export interface TagUpdateInput {
  name?: string;
  slug?: string;
  priority?: number;
}

export interface RedirectCreateInput {
  from_path: string;
  to_path: string;
  redirect_type?: 307 | 308;
}

export interface RedirectUpdateInput {
  from_path?: string;
  to_path?: string;
  redirect_type?: 307 | 308;
}

export interface BlogUpdateInput {
  title?: string;
  description?: string;
  blog_language?: string;
  timezone_diff?: number;
  logo?: string;
  favicon?: string;
  og_image?: string;
  ga_measurement_id?: string;
}

export interface AuthorUpdateInput {
  author_name?: string;
  avatar_url?: string | null;
}

// ── List/filter options ──

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface PostListOptions extends PaginationOptions {
  sort?: string;
  order?: 'asc' | 'desc';
  filter?: {
    slug?: string;
    published?: boolean;
    published_at_gte?: string;
    published_at_lte?: string;
    tag_id?: number;
    author_id?: string;
    content_type?: 'tiptap' | 'notion';
  };
  include?: string[];
}

export interface TagListOptions {
  include?: string[];
}

export interface AuthorListOptions extends PaginationOptions {
  include?: string[];
}

export interface RedirectListOptions extends PaginationOptions {}

export interface FormListOptions extends PaginationOptions {}

export interface FormResponseListOptions extends PaginationOptions {
  filter?: {
    form_id?: string;
  };
}
