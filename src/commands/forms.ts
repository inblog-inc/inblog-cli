import { Command } from 'commander';
import { createClientFromCommand, isJsonMode } from '../utils/client-factory.js';
import { printJson, printTable, printDetail, truncate } from '../utils/output.js';
import { handleError } from '../utils/errors.js';

export function registerFormsCommands(program: Command): void {
  const forms = program.command('forms').description('View lead-capture forms (read-only)');

  forms
    .command('list')
    .description('List forms')
    .option('-p, --page <number>', 'Page number', '1')
    .option('-l, --limit <number>', 'Items per page', '10')
    .action(async function (this: Command) {
      const json = isJsonMode(this);
      try {
        const opts = this.opts();
        const { forms: endpoint } = createClientFromCommand(this);
        const { data, meta } = await endpoint.list({
          page: parseInt(opts.page, 10),
          limit: parseInt(opts.limit, 10),
        });

        if (json) {
          printJson({ data, meta });
        } else {
          printTable(
            ['ID', 'Title', 'Responses', 'Created At'],
            data.map((f) => [f.id, truncate(f.title, 40), f.response_count, f.created_at]),
          );
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  forms
    .command('get <id>')
    .description('Get a form by ID')
    .action(async function (this: Command, id: string) {
      const json = isJsonMode(this);
      try {
        const { forms: endpoint } = createClientFromCommand(this);
        const { data } = await endpoint.get(id);
        if (json) {
          printJson(data);
        } else {
          printDetail([
            ['ID', data.id],
            ['Title', data.title],
            ['Magnet Type', data.magnet_type],
            ['Responses', data.response_count],
            ['Created At', data.created_at],
          ]);
        }
      } catch (error) {
        handleError(error, json);
      }
    });
}

export function registerFormResponsesCommands(program: Command): void {
  const formResponses = program.command('form-responses').description('View form submission data (read-only)');

  formResponses
    .command('list')
    .description('List form responses')
    .option('-p, --page <number>', 'Page number', '1')
    .option('-l, --limit <number>', 'Items per page', '10')
    .option('--form-id <id>', 'Filter by form ID')
    .action(async function (this: Command) {
      const json = isJsonMode(this);
      try {
        const opts = this.opts();
        const { formResponses: endpoint } = createClientFromCommand(this);
        const filter: Record<string, any> = {};
        if (opts.formId) filter.form_id = opts.formId;

        const { data, meta } = await endpoint.list({
          page: parseInt(opts.page, 10),
          limit: parseInt(opts.limit, 10),
          filter: Object.keys(filter).length > 0 ? filter : undefined,
        });

        if (json) {
          printJson({ data, meta });
        } else {
          printTable(
            ['ID', 'Email', 'Country', 'Created At'],
            data.map((r) => [r.id, r.email, r.country, r.created_at]),
          );
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  formResponses
    .command('get <id>')
    .description('Get a form response by ID')
    .action(async function (this: Command, id: string) {
      const json = isJsonMode(this);
      try {
        const { formResponses: endpoint } = createClientFromCommand(this);
        const { data } = await endpoint.get(id);
        if (json) {
          printJson(data);
        } else {
          printDetail([
            ['ID', data.id],
            ['Email', data.email],
            ['Country', data.country],
            ['City', data.city],
            ['Region', data.region],
            ['Language', data.language],
            ['Created At', data.created_at],
            ['Response', JSON.stringify(data.response)],
          ]);
        }
      } catch (error) {
        handleError(error, json);
      }
    });
}
