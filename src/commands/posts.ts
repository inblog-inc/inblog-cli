import { Command } from 'commander';
import * as fs from 'node:fs';
import { createClientFromCommand, isJsonMode } from '../utils/client-factory.js';
import { printJson, printTable, printDetail, printSuccess, printWarning, truncate } from '../utils/output.js';
import { handleError } from '../utils/errors.js';
import { resolveImageUrl, processContentImages } from '../utils/upload.js';
import type { PostCreateInput } from '../sdk/types.js';
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
    ['Tags', post.tags?.map((t) => t.name).join(', ')],
    ['Authors', post.authors?.map((a) => a.author_name).join(', ')],
  ];
}

export function registerPostsCommands(program: Command): void {
  const posts = program.command('posts').description('CRUD, publish, schedule posts + manage tags/authors')
    .addHelpText('after', `
Examples:
  $ inblog posts list --published --limit 5 --json       List 5 published posts
  $ inblog posts list --draft --tag-id 3 --json          List drafts with tag ID 3
  $ inblog posts create --title "My Post" --content-file ./content.html --tag-ids 1,2 --json
  $ inblog posts update 123 --title "New Title" --json   Update post title
  $ inblog posts publish 123 --json                      Publish a draft
  $ inblog posts schedule 123 --at "2025-06-01T09:00:00+09:00" --json
  $ inblog posts add-tags 123 --tag-ids 4,5 --json       Add tags to a post
  $ inblog posts delete 123 --json                       Delete a post`);

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
    .action(async function (this: Command) {
      const json = isJsonMode(this);
      try {
        const opts = this.opts();
        const { posts: endpoint } = createClientFromCommand(this);

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
        if (opts.tagIds) input.tag_ids = opts.tagIds.split(',').map(Number);
        if (opts.authorIds) input.author_ids = opts.authorIds.split(',');

        const { data } = await endpoint.create(input as PostCreateInput);

        if (json) {
          printJson(data);
        } else {
          printSuccess(`Post created: "${data.title}" (ID: ${data.id})`);
          printDetail(formatPost(data));
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
    .action(async function (this: Command, id: string) {
      const json = isJsonMode(this);
      try {
        const opts = this.opts();
        const { posts: endpoint } = createClientFromCommand(this);

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

        if (Object.keys(input).length === 0) {
          throw new Error('No fields to update. Provide at least one option.');
        }

        const { data } = await endpoint.update(id, input);

        if (json) {
          printJson(data);
        } else {
          printSuccess(`Post updated: "${data.title}" (ID: ${data.id})`);
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
}
