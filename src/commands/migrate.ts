import { Command } from 'commander';
import * as fs from 'node:fs';
import * as path from 'node:path';
import matter from 'gray-matter';
import { marked } from 'marked';
import { createClientFromCommand, isJsonMode } from '../utils/client-factory.js';
import { printJson, printSuccess, printWarning, printTable } from '../utils/output.js';
import { handleError } from '../utils/errors.js';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

interface MigrationItem {
  filePath: string;
  title: string;
  slug: string;
  description?: string;
  contentHtml: string;
  published: boolean;
  publishedAt?: string;
  tags?: string[];
  image?: string;
  canonicalUrl?: string;
}

function parseMarkdownFile(filePath: string): MigrationItem {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data: frontmatter, content } = matter(raw);
  const contentHtml = marked.parse(content, { async: false }) as string;

  const title = frontmatter.title || path.basename(filePath, path.extname(filePath));
  const slug = frontmatter.slug || slugify(title);

  return {
    filePath,
    title,
    slug,
    description: frontmatter.description,
    contentHtml,
    published: frontmatter.published ?? false,
    publishedAt: frontmatter.date ? new Date(frontmatter.date).toISOString() : undefined,
    tags: frontmatter.tags,
    image: frontmatter.image,
    canonicalUrl: frontmatter.canonical_url,
  };
}

function collectMarkdownFiles(inputPath: string): string[] {
  const stat = fs.statSync(inputPath);
  if (stat.isFile()) {
    return [inputPath];
  }
  if (stat.isDirectory()) {
    return fs.readdirSync(inputPath)
      .filter((f) => /\.mdx?$/.test(f))
      .map((f) => path.join(inputPath, f))
      .sort();
  }
  throw new Error(`Path is not a file or directory: ${inputPath}`);
}

export function registerMigrateCommands(program: Command): void {
  const migrate = program.command('migrate').description('Import content from external sources');

  migrate
    .command('markdown <path>')
    .description('Import .md/.mdx files as posts (frontmatter + content)')
    .option('--dry-run', 'Preview without creating posts')
    .option('--publish', 'Publish imported posts immediately')
    .option('--preserve-images', 'Keep external image URLs (default: upload to inblog)')
    .action(async function (this: Command, inputPath: string) {
      const json = isJsonMode(this);
      try {
        const opts = this.opts();
        const files = collectMarkdownFiles(path.resolve(inputPath));

        if (files.length === 0) {
          throw new Error('No markdown files found at the specified path.');
        }

        const items = files.map(parseMarkdownFile);

        if (opts.dryRun) {
          if (json) {
            printJson(items.map((item) => ({
              file: item.filePath,
              title: item.title,
              slug: item.slug,
              description: item.description,
              published: opts.publish || item.published,
              tags: item.tags,
              contentLength: item.contentHtml.length,
            })));
          } else {
            console.log(`\nDry run: ${items.length} file(s) to import\n`);
            printTable(
              ['File', 'Title', 'Slug', 'Publish', 'Tags'],
              items.map((item) => [
                path.basename(item.filePath),
                item.title,
                item.slug,
                (opts.publish || item.published) ? 'Yes' : 'No',
                item.tags?.join(', ') ?? '',
              ]),
            );
          }
          return;
        }

        const { posts: endpoint, tags: tagsEndpoint } = createClientFromCommand(this);

        // If any items have tags, resolve tag names → IDs
        let tagMap: Map<string, number> | undefined;
        const allTagNames = new Set(items.flatMap((i) => i.tags ?? []));
        if (allTagNames.size > 0) {
          const { data: existingTags } = await tagsEndpoint.list();
          tagMap = new Map(existingTags.map((t) => [t.name.toLowerCase(), parseInt(t.id, 10)]));
        }

        const results: any[] = [];
        let successCount = 0;

        for (const item of items) {
          try {
            const input: Record<string, any> = {
              title: item.title,
              slug: item.slug,
              content_html: item.contentHtml,
              published: opts.publish || item.published,
            };

            if (item.description) input.description = item.description;
            if (item.publishedAt) input.published_at = item.publishedAt;
            if (item.canonicalUrl) input.canonical_url = item.canonicalUrl;
            if (item.image) input.image = { url: item.image };

            // Resolve tag IDs
            if (item.tags && tagMap) {
              const tagIds = item.tags
                .map((name) => tagMap!.get(name.toLowerCase()))
                .filter((id): id is number => id !== undefined);
              if (tagIds.length > 0) input.tag_ids = tagIds;
            }

            const params: Record<string, any> = {};
            if (opts.preserveImages) params.preserve_external_images = true;

            const { data } = await endpoint.create(input);
            results.push({ file: item.filePath, id: data.id, title: data.title, status: 'ok' });
            successCount++;

            if (!json) {
              printSuccess(`  [${successCount}/${items.length}] Created: "${data.title}" (ID: ${data.id})`);
            }
          } catch (error: any) {
            const errorMsg = error.message || 'Unknown error';
            results.push({ file: item.filePath, title: item.title, status: 'error', error: errorMsg });
            if (!json) {
              printWarning(`  [${successCount + 1}/${items.length}] Failed: "${item.title}" — ${errorMsg}`);
            }
          }
        }

        if (json) {
          printJson({ total: items.length, success: successCount, results });
        } else {
          console.log(`\nMigration complete: ${successCount}/${items.length} posts created.`);
        }
      } catch (error) {
        handleError(error, json);
      }
    });
}
