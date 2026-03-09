import { Command } from 'commander';
import { createClientFromCommand, isJsonMode } from '../utils/client-factory.js';
import { printJson, printTable, printDetail, printSuccess, truncate } from '../utils/output.js';
import { handleError } from '../utils/errors.js';

export function registerAuthorsCommands(program: Command): void {
  const authors = program.command('authors').description('List, view, update authors (create not available)');

  authors
    .command('list')
    .description('List authors (only profiles with posts, UUID IDs)')
    .option('-p, --page <number>', 'Page number', '1')
    .option('-l, --limit <number>', 'Items per page', '10')
    .action(async function (this: Command) {
      const json = isJsonMode(this);
      try {
        const opts = this.opts();
        const { authors: endpoint } = createClientFromCommand(this);
        const { data, meta } = await endpoint.list({
          page: parseInt(opts.page, 10),
          limit: parseInt(opts.limit, 10),
        });

        if (json) {
          printJson({ data, meta });
        } else {
          printTable(
            ['ID', 'Name', 'Avatar'],
            data.map((a) => [a.id, a.author_name, truncate(a.avatar_url, 40)]),
          );
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  authors
    .command('get <id>')
    .description('Get an author by ID')
    .action(async function (this: Command, id: string) {
      const json = isJsonMode(this);
      try {
        const { authors: endpoint } = createClientFromCommand(this);
        const { data } = await endpoint.get(id);
        if (json) {
          printJson(data);
        } else {
          printDetail([
            ['ID', data.id],
            ['Name', data.author_name],
            ['Avatar URL', data.avatar_url],
          ]);
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  authors
    .command('update <id>')
    .description('Update an author')
    .option('-n, --name <name>', 'Author name')
    .option('--avatar-url <url>', 'Avatar URL')
    .action(async function (this: Command, id: string) {
      const json = isJsonMode(this);
      try {
        const opts = this.opts();
        const { authors: endpoint } = createClientFromCommand(this);
        const input: Record<string, any> = {};
        if (opts.name) input.author_name = opts.name;
        if (opts.avatarUrl !== undefined) input.avatar_url = opts.avatarUrl || null;

        if (Object.keys(input).length === 0) {
          throw new Error('No fields to update. Provide at least one option.');
        }

        const { data } = await endpoint.update(id, input);
        if (json) {
          printJson(data);
        } else {
          printSuccess(`Author updated: "${data.author_name}" (ID: ${data.id})`);
        }
      } catch (error) {
        handleError(error, json);
      }
    });
}
