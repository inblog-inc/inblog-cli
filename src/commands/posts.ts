import { Command } from 'commander';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createClientFromCommand, isJsonMode } from '../utils/client-factory.js';
import { printJson, printTable, printDetail, printSuccess, printWarning, truncate } from '../utils/output.js';
import { handleError } from '../utils/errors.js';
import { resolveImageUrl, processContentImages } from '../utils/upload.js';
import type { PostCreateInput, CustomScriptsInput } from '../sdk/types.js';
import type { Post } from '../sdk/types.js';

function formatPost(post: Post): [string, any][] {
  return [
    ['ID', post.id],
    ['Title', post.title],
    ['Slug', post.slug],
    ['Published', post.published ? 'Yes' : 'No'],
    ['Published At', post.published_at],
    ['Content Type', post.content_type],
    ['Description', post.description],
    ['Image', post.image?.url],
    ['Canonical URL', post.canonical_url],
    ['Meta Title', post.meta_title],
    ['Meta Description', post.meta_description],
    ['CTA', post.cta_text ? `${post.cta_text} → ${post.cta_link}` : null],
    ['JSON-LD', post.custom_scripts?.json_ld_script ? 'Set' : null],
    ['Custom Scripts', post.custom_scripts ? Object.entries(post.custom_scripts).filter(([k, v]) => k !== 'json_ld_script' && v).map(([k]) => k).join(', ') || null : null],
    ['Tags', post.tags?.map((t) => t.name).join(', ')],
    ['Authors', post.authors?.map((a) => a.author_name).join(', ')],
  ];
}

function buildCustomScripts(opts: Record<string, any>): CustomScriptsInput | undefined {
  const scripts: CustomScriptsInput = {};
  let hasAny = false;

  if (opts.jsonLdFile) {
    scripts.json_ld_script = fs.readFileSync(opts.jsonLdFile, 'utf-8');
    hasAny = true;
  }

  if (opts.customScriptsFile) {
    const raw = JSON.parse(fs.readFileSync(opts.customScriptsFile, 'utf-8'));
    Object.assign(scripts, raw);
    hasAny = true;
  }

  return hasAny ? scripts : undefined;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function registerPostsCommands(program: Command): void {
  const posts = program.command('posts').description('CRUD, publish, schedule posts + manage tags/authors')
    .addHelpText('after', `
Examples:
  $ inblog posts list --published --limit 5 --json       List 5 published posts
  $ inblog posts list --draft --tag-id 3 --json          List drafts with tag ID 3
  $ inblog posts create --title "My Post" --content-file ./content.html --tag-ids 1,2 --json
  $ inblog posts update 123 --title "New Title" --json   Update post title
  $ inblog posts update 123 --cta-text "Try free" --cta-link "https://..." --json
  $ inblog posts update 123 --json-ld-file ./schema.json --json
  $ inblog posts publish 123 --json                      Publish a draft
  $ inblog posts schedule 123 --at "2025-06-01T09:00:00+09:00" --json
  $ inblog posts add-tags 123 --tag-ids 4,5 --json       Add tags to a post
  $ inblog posts delete 123 --json                       Delete a post
  $ inblog posts search --query "tutorial" --json        Search posts by keyword
  $ inblog posts bulk-update --ids 1,2,3 --meta-title "New" --json
  $ inblog posts export --published --format md --output ./out
  $ inblog posts sitemap --json                          List published post URLs`);

  posts
    .command('list')
    .description('List posts with pagination, filters, and sorting')
    .option('-p, --page <number>', 'Page number', '1')
    .option('-l, --limit <number>', 'Items per page', '10')
    .option('-s, --sort <field>', 'Sort field (published_at, created_at, title)')
    .option('-o, --order <dir>', 'Sort order (asc, desc)')
    .option('--published', 'Only published posts')
    .option('--draft', 'Only draft posts')
    .option('--tag-id <id>', 'Filter by tag ID')
    .option('--author-id <id>', 'Filter by author ID')
    .option('--include <rels>', 'Include relationships (tags,authors)', 'tags,authors')
    .action(async function (this: Command) {
      const json = isJsonMode(this);
      try {
        const opts = this.opts();
        const { posts: endpoint } = createClientFromCommand(this);

        const filter: Record<string, any> = {};
        if (opts.published) filter.published = true;
        if (opts.draft) filter.published = false;
        if (opts.tagId) filter.tag_id = parseInt(opts.tagId, 10);
        if (opts.authorId) filter.author_id = opts.authorId;

        const { data, meta } = await endpoint.list({
          page: parseInt(opts.page, 10),
          limit: parseInt(opts.limit, 10),
          sort: opts.sort,
          order: opts.order,
          filter: Object.keys(filter).length > 0 ? filter : undefined,
          include: opts.include ? opts.include.split(',') : undefined,
        });

        if (json) {
          printJson({ data, meta });
        } else {
          printTable(
            ['ID', 'Title', 'Slug', 'Published', 'Published At', 'Tags'],
            data.map((p) => [
              p.id,
              truncate(p.title, 40),
              truncate(p.slug, 30),
              p.published ? 'Yes' : 'No',
              p.published_at ? new Date(p.published_at).toLocaleDateString() : '—',
              p.tags?.map((t) => t.name).join(', ') ?? '',
            ]),
          );
          if (meta.total) {
            console.log(`\nShowing page ${meta.page ?? 1} (${data.length} of ${meta.total} posts)`);
          }
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  posts
    .command('get <id>')
    .description('Get post details by ID (integer)')
    .option('--include <rels>', 'Include relationships', 'tags,authors')
    .action(async function (this: Command, id: string) {
      const json = isJsonMode(this);
      try {
        const opts = this.opts();
        const { posts: endpoint } = createClientFromCommand(this);
        const { data } = await endpoint.get(id, opts.include?.split(','));

        if (json) {
          printJson(data);
        } else {
          printDetail(formatPost(data));
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  posts
    .command('create')
    .description('Create post (draft by default, use --published to publish)')
    .requiredOption('-t, --title <title>', 'Post title')
    .option('-s, --slug <slug>', 'Post slug')
    .option('-d, --description <desc>', 'Post description')
    .option('--content <html>', 'HTML content')
    .option('--content-file <path>', 'Read HTML content from file')
    .option('--image <path-or-url>', 'Cover image (local file or URL)')
    .option('--notion-url <url>', 'Notion page URL')
    .option('--published', 'Publish immediately')
    .option('--tag-ids <ids>', 'Comma-separated tag IDs')
    .option('--author-ids <ids>', 'Comma-separated author IDs')
    .option('--canonical-url <url>', 'Canonical URL')
    .option('--meta-title <title>', 'Meta title')
    .option('--meta-description <desc>', 'Meta description')
    .option('--cta-text <text>', 'CTA button text')
    .option('--cta-link <url>', 'CTA button URL')
    .option('--cta-color <hex>', 'CTA button background color')
    .option('--cta-text-color <hex>', 'CTA button text color')
    .option('--json-ld-file <path>', 'JSON-LD script from file')
    .option('--custom-scripts-file <path>', 'Custom scripts JSON file (head/body scripts)')
    .option('--skip-preview', 'Skip automatic preview link generation')
    .action(async function (this: Command) {
      const json = isJsonMode(this);
      try {
        const opts = this.opts();
        const { posts: endpoint, previewTokens } = createClientFromCommand(this);

        let contentHtml = opts.content;
        if (opts.contentFile) {
          contentHtml = fs.readFileSync(opts.contentFile, 'utf-8');
        }

        // Upload local/base64 images in content
        if (contentHtml) {
          const { html, uploadCount } = await processContentImages(contentHtml);
          contentHtml = html;
          if (uploadCount > 0 && !json) {
            printWarning(`Uploaded ${uploadCount} image(s) to CDN.`);
          }
        }

        const input: Record<string, any> = { title: opts.title };
        if (opts.slug) input.slug = opts.slug;
        if (opts.description) input.description = opts.description;
        if (contentHtml) input.content_html = contentHtml;
        if (opts.image) input.image = { url: await resolveImageUrl(opts.image, 'featured_image') };
        if (opts.notionUrl) input.notion_url = opts.notionUrl;
        if (opts.published) input.published = true;
        if (opts.canonicalUrl) input.canonical_url = opts.canonicalUrl;
        if (opts.metaTitle) input.meta_title = opts.metaTitle;
        if (opts.metaDescription) input.meta_description = opts.metaDescription;
        if (opts.ctaText) input.cta_text = opts.ctaText;
        if (opts.ctaLink) input.cta_link = opts.ctaLink;
        if (opts.ctaColor) input.cta_color = opts.ctaColor;
        if (opts.ctaTextColor) input.cta_text_color = opts.ctaTextColor;
        const customScripts = buildCustomScripts(opts);
        if (customScripts) input.custom_scripts = customScripts;
        if (opts.tagIds) input.tag_ids = opts.tagIds.split(',').map(Number);
        if (opts.authorIds) input.author_ids = opts.authorIds.split(',');

        const { data } = await endpoint.create(input as PostCreateInput);

        if (json) {
          let output: Record<string, any> = { ...data };
          if (!opts.skipPreview) {
            try {
              const pv = await previewTokens.create(data.id, { ttlHours: 24, name: 'cli-auto' });
              output.preview = { url: pv.share_url, token: pv.token, expires_at: pv.expires_at };
            } catch { /* non-blocking */ }
          }
          printJson(output);
        } else {
          printSuccess(`Post created: "${data.title}" (ID: ${data.id})`);
          printDetail(formatPost(data));
          if (!opts.skipPreview) {
            try {
              const pv = await previewTokens.create(data.id, { ttlHours: 24, name: 'cli-auto' });
              console.log(`\n  Preview: ${pv.share_url}  (expires in 24h)`);
            } catch {
              printWarning('Could not generate preview link.');
            }
          }
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  posts
    .command('update <id>')
    .description('Update post fields (title, slug, content, SEO metadata)')
    .option('-t, --title <title>', 'Post title')
    .option('-s, --slug <slug>', 'Post slug')
    .option('-d, --description <desc>', 'Post description')
    .option('--content <html>', 'HTML content')
    .option('--content-file <path>', 'Read HTML content from file')
    .option('--image <path-or-url>', 'Cover image (local file or URL)')
    .option('--canonical-url <url>', 'Canonical URL')
    .option('--meta-title <title>', 'Meta title')
    .option('--meta-description <desc>', 'Meta description')
    .option('--cta-text <text>', 'CTA button text (empty to remove)')
    .option('--cta-link <url>', 'CTA button URL (empty to remove)')
    .option('--cta-color <hex>', 'CTA button background color (empty to remove)')
    .option('--cta-text-color <hex>', 'CTA button text color (empty to remove)')
    .option('--json-ld-file <path>', 'JSON-LD script from file')
    .option('--custom-scripts-file <path>', 'Custom scripts JSON file (head/body scripts)')
    .option('--remove-custom-scripts', 'Remove all custom scripts')
    .option('--skip-preview', 'Skip automatic preview link generation')
    .action(async function (this: Command, id: string) {
      const json = isJsonMode(this);
      try {
        const opts = this.opts();
        const { posts: endpoint, previewTokens } = createClientFromCommand(this);

        let contentHtml = opts.content;
        if (opts.contentFile) {
          contentHtml = fs.readFileSync(opts.contentFile, 'utf-8');
        }

        // Upload local/base64 images in content
        if (contentHtml) {
          const { html, uploadCount } = await processContentImages(contentHtml);
          contentHtml = html;
          if (uploadCount > 0 && !json) {
            printWarning(`Uploaded ${uploadCount} image(s) to CDN.`);
          }
        }

        const input: Record<string, any> = {};
        if (opts.title) input.title = opts.title;
        if (opts.slug) input.slug = opts.slug;
        if (opts.description) input.description = opts.description;
        if (contentHtml) input.content_html = contentHtml;
        if (opts.image) input.image = { url: await resolveImageUrl(opts.image, 'featured_image') };
        if (opts.canonicalUrl !== undefined) input.canonical_url = opts.canonicalUrl || null;
        if (opts.metaTitle !== undefined) input.meta_title = opts.metaTitle || null;
        if (opts.metaDescription !== undefined) input.meta_description = opts.metaDescription || null;
        if (opts.ctaText !== undefined) input.cta_text = opts.ctaText || null;
        if (opts.ctaLink !== undefined) input.cta_link = opts.ctaLink || null;
        if (opts.ctaColor !== undefined) input.cta_color = opts.ctaColor || null;
        if (opts.ctaTextColor !== undefined) input.cta_text_color = opts.ctaTextColor || null;
        if (opts.removeCustomScripts) {
          input.custom_scripts = null;
        } else {
          const customScripts = buildCustomScripts(opts);
          if (customScripts) input.custom_scripts = customScripts;
        }

        if (Object.keys(input).length === 0) {
          throw new Error('No fields to update. Provide at least one option.');
        }

        const { data } = await endpoint.update(id, input);

        if (json) {
          let output: Record<string, any> = { ...data };
          if (!opts.skipPreview) {
            try {
              const pv = await previewTokens.create(id, { ttlHours: 24, name: 'cli-auto' });
              output.preview = { url: pv.share_url, token: pv.token, expires_at: pv.expires_at };
            } catch { /* non-blocking */ }
          }
          printJson(output);
        } else {
          printSuccess(`Post updated: "${data.title}" (ID: ${data.id})`);
          if (!opts.skipPreview) {
            try {
              const pv = await previewTokens.create(id, { ttlHours: 24, name: 'cli-auto' });
              console.log(`\n  Preview: ${pv.share_url}  (expires in 24h)`);
            } catch {
              printWarning('Could not generate preview link.');
            }
          }
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  posts
    .command('delete <id>')
    .description('Permanently delete a post')
    .action(async function (this: Command, id: string) {
      const json = isJsonMode(this);
      try {
        const { posts: endpoint } = createClientFromCommand(this);
        await endpoint.delete(id);
        if (json) {
          printJson({ success: true, id });
        } else {
          printSuccess(`Post ${id} deleted.`);
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  posts
    .command('publish <id>')
    .description('Set post as published (immediately visible)')
    .action(async function (this: Command, id: string) {
      const json = isJsonMode(this);
      try {
        const { posts: endpoint } = createClientFromCommand(this);
        const { data } = await endpoint.publish(id);
        if (json) {
          printJson(data);
        } else {
          printSuccess(`Post "${data.title}" published.`);
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  posts
    .command('unpublish <id>')
    .description('Revert published post to draft')
    .action(async function (this: Command, id: string) {
      const json = isJsonMode(this);
      try {
        const { posts: endpoint } = createClientFromCommand(this);
        const { data } = await endpoint.unpublish(id);
        if (json) {
          printJson(data);
        } else {
          printSuccess(`Post "${data.title}" unpublished.`);
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  posts
    .command('schedule <id>')
    .description('Schedule post for future publishing (ISO 8601 date)')
    .requiredOption('--at <iso-date>', 'ISO 8601 date for scheduled publish')
    .action(async function (this: Command, id: string) {
      const json = isJsonMode(this);
      try {
        const opts = this.opts();
        const { posts: endpoint } = createClientFromCommand(this);
        const { data } = await endpoint.schedule(id, opts.at);
        if (json) {
          printJson(data);
        } else {
          printSuccess(`Post "${data.title}" scheduled for ${opts.at}.`);
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  // ── Relationship sub-commands ──

  posts
    .command('tags <id>')
    .description('List tags for a post')
    .action(async function (this: Command, id: string) {
      const json = isJsonMode(this);
      try {
        const { posts: endpoint } = createClientFromCommand(this);
        const { data } = await endpoint.listTags(id);
        if (json) {
          printJson(data);
        } else {
          printTable(['ID', 'Name', 'Slug'], data.map((t) => [t.id, t.name, t.slug]));
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  posts
    .command('add-tags <id>')
    .description('Add tags to a post')
    .requiredOption('--tag-ids <ids>', 'Comma-separated tag IDs')
    .action(async function (this: Command, id: string) {
      const json = isJsonMode(this);
      try {
        const opts = this.opts();
        const { posts: endpoint } = createClientFromCommand(this);
        const tagIds = opts.tagIds.split(',').map(Number);
        const { data } = await endpoint.addTags(id, tagIds);
        if (json) {
          printJson(data);
        } else {
          printSuccess(`Tags added to post ${id}.`);
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  posts
    .command('remove-tag <postId> <tagId>')
    .description('Remove a tag from a post')
    .action(async function (this: Command, postId: string, tagId: string) {
      const json = isJsonMode(this);
      try {
        const { posts: endpoint } = createClientFromCommand(this);
        await endpoint.removeTag(postId, tagId);
        if (json) {
          printJson({ success: true, postId, tagId });
        } else {
          printSuccess(`Tag ${tagId} removed from post ${postId}.`);
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  posts
    .command('authors <id>')
    .description('List authors for a post')
    .action(async function (this: Command, id: string) {
      const json = isJsonMode(this);
      try {
        const { posts: endpoint } = createClientFromCommand(this);
        const { data } = await endpoint.listAuthors(id);
        if (json) {
          printJson(data);
        } else {
          printTable(
            ['ID', 'Name', 'Avatar URL'],
            data.map((a) => [a.id, a.author_name, truncate(a.avatar_url, 40)]),
          );
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  posts
    .command('add-authors <id>')
    .description('Add authors to a post')
    .requiredOption('--author-ids <ids>', 'Comma-separated author IDs')
    .action(async function (this: Command, id: string) {
      const json = isJsonMode(this);
      try {
        const opts = this.opts();
        const { posts: endpoint } = createClientFromCommand(this);
        const authorIds = opts.authorIds.split(',');
        const { data } = await endpoint.addAuthors(id, authorIds);
        if (json) {
          printJson(data);
        } else {
          printSuccess(`Authors added to post ${id}.`);
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  posts
    .command('remove-author <postId> <authorId>')
    .description('Remove an author from a post')
    .action(async function (this: Command, postId: string, authorId: string) {
      const json = isJsonMode(this);
      try {
        const { posts: endpoint } = createClientFromCommand(this);
        await endpoint.removeAuthor(postId, authorId);
        if (json) {
          printJson({ success: true, postId, authorId });
        } else {
          printSuccess(`Author ${authorId} removed from post ${postId}.`);
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  // ── Search ──

  posts
    .command('search')
    .description('Search posts by title, slug, or description')
    .requiredOption('-q, --query <string>', 'Search query (case-insensitive substring match)')
    .option('-p, --page <number>', 'Page number', '1')
    .option('-l, --limit <number>', 'Items per page', '20')
    .action(async function (this: Command) {
      const json = isJsonMode(this);
      try {
        const opts = this.opts();
        const { posts: endpoint } = createClientFromCommand(this);
        const query = opts.query.toLowerCase();

        // Fetch all posts (paginate through all pages)
        let allPosts: Post[] = [];
        let page = 1;
        let hasMore = true;
        while (hasMore) {
          const { data, meta } = await endpoint.list({
            page,
            limit: 100,
            include: ['tags', 'authors'],
          });
          allPosts = allPosts.concat(data);
          hasMore = meta.total ? allPosts.length < meta.total : data.length === 100;
          page++;
        }

        // Client-side filter
        const matched = allPosts.filter((p) => {
          const title = (p.title || '').toLowerCase();
          const slug = (p.slug || '').toLowerCase();
          const desc = (p.description || '').toLowerCase();
          return title.includes(query) || slug.includes(query) || desc.includes(query);
        });

        // Paginate results
        const pageNum = parseInt(opts.page, 10);
        const limit = parseInt(opts.limit, 10);
        const start = (pageNum - 1) * limit;
        const paged = matched.slice(start, start + limit);

        if (json) {
          printJson({ data: paged, meta: { total: matched.length, page: pageNum, limit } });
        } else {
          if (paged.length === 0) {
            printWarning(`No posts matching "${opts.query}".`);
          } else {
            printTable(
              ['ID', 'Title', 'Slug', 'Published'],
              paged.map((p) => [
                p.id,
                truncate(p.title, 40),
                truncate(p.slug, 30),
                p.published ? 'Yes' : 'No',
              ]),
            );
            console.log(`\nShowing page ${pageNum} (${paged.length} of ${matched.length} matches)`);
          }
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  // ── Bulk Update ──

  posts
    .command('bulk-update')
    .description('Update multiple posts at once by IDs')
    .requiredOption('--ids <ids>', 'Comma-separated post IDs')
    .option('--meta-title <title>', 'Meta title')
    .option('--meta-description <desc>', 'Meta description')
    .option('--cta-text <text>', 'CTA button text (empty to remove)')
    .option('--cta-link <url>', 'CTA button URL (empty to remove)')
    .option('--cta-color <hex>', 'CTA button background color (empty to remove)')
    .option('--cta-text-color <hex>', 'CTA button text color (empty to remove)')
    .option('--canonical-url <url>', 'Canonical URL (empty to remove)')
    .option('--json-ld-file <path>', 'JSON-LD script from file')
    .option('--custom-scripts-file <path>', 'Custom scripts JSON file')
    .option('--remove-custom-scripts', 'Remove all custom scripts')
    .action(async function (this: Command) {
      const json = isJsonMode(this);
      try {
        const opts = this.opts();
        const { posts: endpoint } = createClientFromCommand(this);
        const ids = opts.ids.split(',').map((id: string) => id.trim());

        // Build common update input
        const input: Record<string, any> = {};
        if (opts.metaTitle !== undefined) input.meta_title = opts.metaTitle || null;
        if (opts.metaDescription !== undefined) input.meta_description = opts.metaDescription || null;
        if (opts.ctaText !== undefined) input.cta_text = opts.ctaText || null;
        if (opts.ctaLink !== undefined) input.cta_link = opts.ctaLink || null;
        if (opts.ctaColor !== undefined) input.cta_color = opts.ctaColor || null;
        if (opts.ctaTextColor !== undefined) input.cta_text_color = opts.ctaTextColor || null;
        if (opts.canonicalUrl !== undefined) input.canonical_url = opts.canonicalUrl || null;
        if (opts.removeCustomScripts) {
          input.custom_scripts = null;
        } else {
          const customScripts = buildCustomScripts(opts);
          if (customScripts) input.custom_scripts = customScripts;
        }

        if (Object.keys(input).length === 0) {
          throw new Error('No fields to update. Provide at least one update option.');
        }

        const results: { id: string; success: boolean; title?: string; error?: string }[] = [];

        for (const id of ids) {
          try {
            const { data } = await endpoint.update(id, input);
            results.push({ id, success: true, title: data.title });
            if (!json) {
              printSuccess(`  [${results.length}/${ids.length}] Updated post ${id}: "${data.title}"`);
            }
          } catch (err: any) {
            const msg = err?.message || 'Unknown error';
            results.push({ id, success: false, error: msg });
            if (!json) {
              printWarning(`  [${results.length}/${ids.length}] Failed post ${id}: ${msg}`);
            }
          }
        }

        const succeeded = results.filter((r) => r.success).length;
        const failed = results.filter((r) => !r.success).length;

        if (json) {
          printJson({ results, summary: { total: ids.length, succeeded, failed } });
        } else {
          console.log(`\nBulk update complete: ${succeeded} succeeded, ${failed} failed out of ${ids.length}.`);
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  // ── Export ──

  posts
    .command('export')
    .description('Export posts to files (JSON, HTML, or Markdown)')
    .option('--published', 'Only published posts')
    .option('--format <format>', 'Output format: json, html, md', 'json')
    .option('--output <dir>', 'Output directory', './export')
    .action(async function (this: Command) {
      const json = isJsonMode(this);
      try {
        const opts = this.opts();
        const { posts: endpoint } = createClientFromCommand(this);
        const format = opts.format as 'json' | 'html' | 'md';
        const outputDir = path.resolve(opts.output);

        if (!['json', 'html', 'md'].includes(format)) {
          throw new Error('Invalid format. Choose: json, html, md');
        }

        // Fetch all matching posts
        let allPosts: Post[] = [];
        let page = 1;
        let hasMore = true;
        const filter: Record<string, any> = {};
        if (opts.published) filter.published = true;

        while (hasMore) {
          const { data, meta } = await endpoint.list({
            page,
            limit: 100,
            filter: Object.keys(filter).length > 0 ? filter : undefined,
            include: ['tags', 'authors'],
          });
          allPosts = allPosts.concat(data);
          hasMore = meta.total ? allPosts.length < meta.total : data.length === 100;
          page++;
        }

        if (allPosts.length === 0) {
          if (json) {
            printJson({ exported: 0, message: 'No posts to export.' });
          } else {
            printWarning('No posts found to export.');
          }
          return;
        }

        // Create output directory
        fs.mkdirSync(outputDir, { recursive: true });

        if (!json) {
          console.log(`Exporting ${allPosts.length} post(s) to ${outputDir}...`);
        }

        let exported = 0;
        for (const post of allPosts) {
          const slug = post.slug || post.id;
          let filename: string;
          let content: string;

          if (format === 'json') {
            filename = `${slug}.json`;
            content = JSON.stringify(post, null, 2);
          } else if (format === 'html') {
            filename = `${slug}.html`;
            content = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(post.title)}</title>
  ${post.meta_description ? `<meta name="description" content="${escapeHtml(post.meta_description)}">` : ''}
</head>
<body>
  <h1>${escapeHtml(post.title)}</h1>
  ${post.content_html || ''}
</body>
</html>`;
          } else {
            filename = `${slug}.md`;
            const frontmatter = [
              '---',
              `title: "${post.title.replace(/"/g, '\\"')}"`,
              `slug: "${post.slug}"`,
              `published: ${post.published}`,
              post.published_at ? `published_at: "${post.published_at}"` : null,
              post.description ? `description: "${post.description.replace(/"/g, '\\"')}"` : null,
              post.tags?.length ? `tags: [${post.tags.map((t) => `"${t.name}"`).join(', ')}]` : null,
              '---',
            ].filter(Boolean).join('\n');

            // Basic HTML to markdown conversion
            let body = post.content_html || '';
            body = body.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
            body = body.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
            body = body.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
            body = body.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
            body = body.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
            body = body.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
            body = body.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
            body = body.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)');
            body = body.replace(/<br\s*\/?>/gi, '\n');
            body = body.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
            body = body.replace(/<\/?[^>]+(>|$)/g, '');
            body = body.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
            body = body.trim();

            content = `${frontmatter}\n\n${body}\n`;
          }

          fs.writeFileSync(path.join(outputDir, filename), content, 'utf-8');
          exported++;

          if (!json) {
            process.stdout.write(`  [${exported}/${allPosts.length}] ${filename}\n`);
          }
        }

        if (json) {
          printJson({ exported, directory: outputDir, format });
        } else {
          printSuccess(`\nExported ${exported} post(s) to ${outputDir}/`);
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  // ── Sitemap ──

  posts
    .command('sitemap')
    .description('List all published posts with URL and last modified date')
    .action(async function (this: Command) {
      const json = isJsonMode(this);
      try {
        const { posts: endpoint, blogs } = createClientFromCommand(this);

        // Get blog info for base URL
        let baseUrl = '';
        try {
          const blogData = await blogs.me();
          const blog = blogData.data;
          if (blog.custom_domain) {
            baseUrl = `https://${blog.custom_domain}`;
          } else if (blog.custom_subdirectory) {
            baseUrl = blog.custom_subdirectory;
          } else {
            baseUrl = `https://${blog.subdomain}.inblog.ai`;
          }
        } catch {
          baseUrl = '';
        }

        // Fetch all published posts
        let allPosts: Post[] = [];
        let page = 1;
        let hasMore = true;
        while (hasMore) {
          const { data, meta } = await endpoint.list({
            page,
            limit: 100,
            filter: { published: true },
          });
          allPosts = allPosts.concat(data);
          hasMore = meta.total ? allPosts.length < meta.total : data.length === 100;
          page++;
        }

        const entries = allPosts.map((p) => ({
          url: baseUrl ? `${baseUrl}/${p.slug}` : `/${p.slug}`,
          lastmod: p.published_at || null,
        }));

        if (json) {
          printJson(entries);
        } else {
          if (entries.length === 0) {
            printWarning('No published posts found.');
          } else {
            printTable(
              ['URL', 'Last Modified'],
              entries.map((e) => [
                e.url,
                e.lastmod ? new Date(e.lastmod).toLocaleDateString() : '—',
              ]),
            );
            console.log(`\n${entries.length} published post(s)`);
          }
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  // ── Preview sub-commands ──

  const preview = posts
    .command('preview <id>')
    .description('Generate a preview link for a post')
    .option('--ttl <hours>', 'Token TTL in hours (1, 24, 72, 168, 720, 0=never)', '24')
    .option('--one-time', 'Token can only be used once')
    .option('--name <name>', 'Name for this preview link')
    .action(async function (this: Command, id: string) {
      const json = isJsonMode(this);
      try {
        const opts = this.opts();
        const { previewTokens } = createClientFromCommand(this);

        const result = await previewTokens.create(id, {
          ttlHours: parseInt(opts.ttl, 10),
          oneTime: opts.oneTime ?? false,
          name: opts.name,
        });

        if (json) {
          printJson(result);
        } else {
          printSuccess('Preview link created');
          printDetail([
            ['URL', result.share_url],
            ['Token', result.token],
            ['Site', result.site],
            ['Expires', result.expires_at
              ? new Date(result.expires_at).toLocaleString()
              : 'never'],
          ]);
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  preview
    .command('list <id>')
    .description('List active preview tokens for a post')
    .action(async function (this: Command, id: string) {
      const json = isJsonMode(this);
      try {
        const { previewTokens } = createClientFromCommand(this);
        const tokens = await previewTokens.list(id);

        if (json) {
          printJson(tokens);
        } else if (tokens.length === 0) {
          printWarning('No active preview tokens for this post.');
        } else {
          printTable(
            ['Token', 'Name', 'Expires', 'One-time', 'Used', 'URL'],
            tokens.map((t) => [
              truncate(t.token, 12),
              t.name ?? '—',
              t.expires_at ? new Date(t.expires_at).toLocaleString() : 'never',
              t.one_time ? 'yes' : 'no',
              t.consumed ? 'yes' : 'no',
              t.share_url,
            ]),
          );
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  preview
    .command('revoke <token>')
    .description('Revoke a preview token')
    .action(async function (this: Command, token: string) {
      const json = isJsonMode(this);
      try {
        const { previewTokens } = createClientFromCommand(this);
        const result = await previewTokens.revoke(token);

        if (json) {
          printJson(result);
        } else if (result.revoked) {
          printSuccess('Preview token revoked.');
        } else {
          printWarning('Token not found or already revoked.');
        }
      } catch (error) {
        handleError(error, json);
      }
    });
}
