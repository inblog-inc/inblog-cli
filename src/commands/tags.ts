import { Command } from 'commander';
import { createClientFromCommand, isJsonMode } from '../utils/client-factory.js';
import { printJson, printTable, printDetail, printSuccess } from '../utils/output.js';
import { handleError } from '../utils/errors.js';
import type { TagCreateInput } from '../sdk/types.js';

export function registerTagsCommands(program: Command): void {
  const tags = program.command('tags').description('CRUD tags (no pagination, sorted by priority)');

  tags
    .command('list')
    .description('List all tags (returns all, sorted by priority)')
    .action(async function (this: Command) {
      const json = isJsonMode(this);
      try {
        const { tags: endpoint } = createClientFromCommand(this);
        const { data } = await endpoint.list();
        if (json) {
          printJson(data);
        } else {
          printTable(
            ['ID', 'Name', 'Slug', 'Priority'],
            data.map((t) => [t.id, t.name, t.slug, t.priority]),
          );
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  tags
    .command('get <id>')
    .description('Get a tag by ID')
    .action(async function (this: Command, id: string) {
      const json = isJsonMode(this);
      try {
        const { tags: endpoint } = createClientFromCommand(this);
        const { data } = await endpoint.get(id);
        if (json) {
          printJson(data);
        } else {
          printDetail([
            ['ID', data.id],
            ['Name', data.name],
            ['Slug', data.slug],
            ['Priority', data.priority],
          ]);
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  tags
    .command('create')
    .description('Create a new tag')
    .requiredOption('-n, --name <name>', 'Tag name')
    .option('-s, --slug <slug>', 'Tag slug')
    .option('-p, --priority <number>', 'Tag priority')
    .action(async function (this: Command) {
      const json = isJsonMode(this);
      try {
        const opts = this.opts();
        const { tags: endpoint } = createClientFromCommand(this);
        const input: Record<string, any> = { name: opts.name };
        if (opts.slug) input.slug = opts.slug;
        if (opts.priority !== undefined) input.priority = parseInt(opts.priority, 10);

        const { data } = await endpoint.create(input as TagCreateInput);
        if (json) {
          printJson(data);
        } else {
          printSuccess(`Tag created: "${data.name}" (ID: ${data.id})`);
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  tags
    .command('update <id>')
    .description('Update a tag')
    .option('-n, --name <name>', 'Tag name')
    .option('-s, --slug <slug>', 'Tag slug')
    .option('-p, --priority <number>', 'Tag priority')
    .action(async function (this: Command, id: string) {
      const json = isJsonMode(this);
      try {
        const opts = this.opts();
        const { tags: endpoint } = createClientFromCommand(this);
        const input: Record<string, any> = {};
        if (opts.name) input.name = opts.name;
        if (opts.slug) input.slug = opts.slug;
        if (opts.priority !== undefined) input.priority = parseInt(opts.priority, 10);

        if (Object.keys(input).length === 0) {
          throw new Error('No fields to update. Provide at least one option.');
        }

        const { data } = await endpoint.update(id, input);
        if (json) {
          printJson(data);
        } else {
          printSuccess(`Tag updated: "${data.name}" (ID: ${data.id})`);
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  tags
    .command('delete <id>')
    .description('Delete a tag')
    .action(async function (this: Command, id: string) {
      const json = isJsonMode(this);
      try {
        const { tags: endpoint } = createClientFromCommand(this);
        await endpoint.delete(id);
        if (json) {
          printJson({ success: true, id });
        } else {
          printSuccess(`Tag ${id} deleted.`);
        }
      } catch (error) {
        handleError(error, json);
      }
    });
}
