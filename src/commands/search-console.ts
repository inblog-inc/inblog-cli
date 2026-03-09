import { Command } from 'commander';
import open from 'open';
import { createClientFromCommand, isJsonMode } from '../utils/client-factory.js';
import { printJson, printTable, printDetail, printSuccess, printWarning } from '../utils/output.js';
import { handleError } from '../utils/errors.js';
import { startCallbackServer } from '../utils/callback-server.js';

export function registerSearchConsoleCommands(program: Command): void {
  const sc = program
    .command('search-console')
    .description('Google Search Console integration');

  sc.command('connect')
    .description('Connect Google Search Console via OAuth')
    .action(async function (this: Command) {
      const json = isJsonMode(this);
      try {
        if (json) {
          throw new Error('Interactive OAuth flow is not available in --json mode.');
        }

        const { searchConsole } = createClientFromCommand(this);

        // Check if already connected
        const statusResult = await searchConsole.status();
        if (statusResult.connected) {
          printWarning('Search Console is already connected.');
          printDetail([
            ['Status', 'Connected'],
            ['Property', statusResult.property || '—'],
          ]);
          return;
        }

        const callbackPath = '/auth/gsc-callback';
        const serverPromise = startCallbackServer({ callbackPath });

        // Wait a tick for the server to start
        await new Promise((r) => setTimeout(r, 100));

        const redirectUri = `http://127.0.0.1:54321${callbackPath}`;
        const oauthResult = await searchConsole.oauthUrl(redirectUri);
        const url = oauthResult.url;

        if (!url) {
          throw new Error('Failed to retrieve OAuth URL from server.');
        }

        console.log('Opening browser for Google Search Console authorization...');
        await open(url);
        console.log('Waiting for authorization...');

        const { code } = await serverPromise;

        await searchConsole.connect(code, redirectUri);
        printSuccess('Google Search Console connected successfully.');
      } catch (error) {
        handleError(error, json);
      }
    });

  sc.command('status')
    .description('Show Search Console connection status')
    .action(async function (this: Command) {
      const json = isJsonMode(this);
      try {
        const { searchConsole } = createClientFromCommand(this);
        const data = await searchConsole.status();

        if (json) {
          printJson(data);
        } else {
          printDetail([
            ['Connected', data.connected ? 'Yes' : 'No'],
            ['Property', data.property || '—'],
          ]);
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  sc.command('disconnect')
    .description('Disconnect Google Search Console')
    .action(async function (this: Command) {
      const json = isJsonMode(this);
      try {
        const { searchConsole } = createClientFromCommand(this);
        await searchConsole.disconnect();

        if (json) {
          printJson({ success: true });
        } else {
          printSuccess('Google Search Console disconnected.');
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  sc.command('keywords')
    .description('Show keyword performance data')
    .option('--start-date <date>', 'Start date (YYYY-MM-DD)')
    .option('--end-date <date>', 'End date (YYYY-MM-DD)')
    .option('--sort <field>', 'Sort by: clicks, impressions, ctr, position', 'clicks')
    .option('--order <dir>', 'Sort order: asc, desc', 'desc')
    .option('-l, --limit <number>', 'Max results', '20')
    .action(async function (this: Command) {
      const json = isJsonMode(this);
      try {
        const opts = this.opts();
        const { searchConsole } = createClientFromCommand(this);
        const data = await searchConsole.keywords({
          start_date: opts.startDate,
          end_date: opts.endDate,
          sort: opts.sort,
          order: opts.order,
          limit: parseInt(opts.limit, 10),
        });

        if (json) {
          printJson(data);
        } else {
          const rows = (data.keywords || data.data || []).map((k: any) => [
            k.keyword || k.key,
            k.clicks,
            k.impressions,
            typeof k.ctr === 'number' ? `${(k.ctr * 100).toFixed(1)}%` : k.ctr,
            typeof k.position === 'number' ? k.position.toFixed(1) : k.position,
          ]);
          printTable(['Keyword', 'Clicks', 'Impressions', 'CTR', 'Position'], rows);
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  sc.command('pages')
    .description('Show page performance data')
    .option('--start-date <date>', 'Start date (YYYY-MM-DD)')
    .option('--end-date <date>', 'End date (YYYY-MM-DD)')
    .option('--sort <field>', 'Sort by: clicks, impressions, ctr, position', 'clicks')
    .option('--order <dir>', 'Sort order: asc, desc', 'desc')
    .option('-l, --limit <number>', 'Max results', '20')
    .action(async function (this: Command) {
      const json = isJsonMode(this);
      try {
        const opts = this.opts();
        const { searchConsole } = createClientFromCommand(this);
        const data = await searchConsole.pages({
          start_date: opts.startDate,
          end_date: opts.endDate,
          sort: opts.sort,
          order: opts.order,
          limit: parseInt(opts.limit, 10),
        });

        if (json) {
          printJson(data);
        } else {
          const rows = (data.pages || data.data || []).map((p: any) => [
            p.page || p.key,
            p.clicks,
            p.impressions,
            typeof p.ctr === 'number' ? `${(p.ctr * 100).toFixed(1)}%` : p.ctr,
            typeof p.position === 'number' ? p.position.toFixed(1) : p.position,
          ]);
          printTable(['Page', 'Clicks', 'Impressions', 'CTR', 'Position'], rows);
        }
      } catch (error) {
        handleError(error, json);
      }
    });
}
