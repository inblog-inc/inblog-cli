import { Command } from 'commander';
import { createClientFromCommand, isJsonMode } from '../utils/client-factory.js';
import { printJson, printTable, printDetail, printSuccess } from '../utils/output.js';
import { handleError } from '../utils/errors.js';

export function registerRedirectsCommands(program: Command): void {
  const redirects = program.command('redirects').description('CRUD URL redirects (307 temporary, 308 permanent)')
    .addHelpText('after', `
Examples:
  $ inblog redirects list --json                         List all redirects
  $ inblog redirects create --from "/old" --to "/new" --type 308 --json
  $ inblog redirects update <id> --to "/newer" --json    Update destination
  $ inblog redirects delete <id> --json                  Remove a redirect`);

  redirects
    .command('list')
    .description('List redirects')
    .option('-p, --page <number>', 'Page number', '1')
    .option('-l, --limit <number>', 'Items per page', '50')
    .action(async function (this: Command) {
      const json = isJsonMode(this);
      try {
        const opts = this.opts();
        const { redirects: endpoint } = createClientFromCommand(this);
        const { data, meta } = await endpoint.list({
          page: parseInt(opts.page, 10),
          limit: parseInt(opts.limit, 10),
        });

        if (json) {
          printJson({ data, meta });
        } else {
          printTable(
            ['ID', 'From', 'To', 'Type'],
            data.map((r) => [r.id, r.from_path, r.to_path, r.redirect_type]),
          );
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  redirects
    .command('get <id>')
    .description('Get a redirect by ID')
    .action(async function (this: Command, id: string) {
      const json = isJsonMode(this);
      try {
        const { redirects: endpoint } = createClientFromCommand(this);
        const { data } = await endpoint.get(id);
        if (json) {
          printJson(data);
        } else {
          printDetail([
            ['ID', data.id],
            ['From', data.from_path],
            ['To', data.to_path],
            ['Type', data.redirect_type],
            ['Created At', data.created_at],
            ['Updated At', data.updated_at],
          ]);
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  redirects
    .command('create')
    .description('Create a redirect (default: 308 permanent)')
    .requiredOption('--from <path>', 'Source path (auto-normalized with /)')
    .requiredOption('--to <path>', 'Destination path')
    .option('--type <type>', 'Redirect type (307 or 308)', '308')
    .action(async function (this: Command) {
      const json = isJsonMode(this);
      try {
        const opts = this.opts();
        const { redirects: endpoint } = createClientFromCommand(this);
        const { data } = await endpoint.create({
          from_path: opts.from,
          to_path: opts.to,
          redirect_type: parseInt(opts.type, 10) as 307 | 308,
        });
        if (json) {
          printJson(data);
        } else {
          printSuccess(`Redirect created: ${data.from_path} → ${data.to_path} (${data.redirect_type})`);
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  redirects
    .command('update <id>')
    .description('Update a redirect')
    .option('--from <path>', 'Source path')
    .option('--to <path>', 'Destination path')
    .option('--type <type>', 'Redirect type (307 or 308)')
    .action(async function (this: Command, id: string) {
      const json = isJsonMode(this);
      try {
        const opts = this.opts();
        const { redirects: endpoint } = createClientFromCommand(this);
        const input: Record<string, any> = {};
        if (opts.from) input.from_path = opts.from;
        if (opts.to) input.to_path = opts.to;
        if (opts.type) input.redirect_type = parseInt(opts.type, 10);

        if (Object.keys(input).length === 0) {
          throw new Error('No fields to update. Provide at least one option.');
        }

        const { data } = await endpoint.update(id, input);
        if (json) {
          printJson(data);
        } else {
          printSuccess(`Redirect updated: ${data.from_path} → ${data.to_path}`);
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  redirects
    .command('delete <id>')
    .description('Delete a redirect')
    .action(async function (this: Command, id: string) {
      const json = isJsonMode(this);
      try {
        const { redirects: endpoint } = createClientFromCommand(this);
        await endpoint.delete(id);
        if (json) {
          printJson({ success: true, id });
        } else {
          printSuccess(`Redirect ${id} deleted.`);
        }
      } catch (error) {
        handleError(error, json);
      }
    });
}
