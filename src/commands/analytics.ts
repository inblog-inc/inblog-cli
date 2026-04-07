import { Command } from 'commander';
import { createClientFromCommand, isJsonMode } from '../utils/client-factory.js';
import { printJson, printTable, printWarning, truncate } from '../utils/output.js';
import { handleError } from '../utils/errors.js';

export function registerAnalyticsCommands(program: Command): void {
  const analytics = program
    .command('analytics')
    .description('Blog analytics: traffic, post metrics, referrer sources')
    .addHelpText('after', `
Examples:
  $ inblog analytics traffic --start-date 2025-01-01 --end-date 2025-01-31 --json
  $ inblog analytics posts --sort visits --limit 10 --include title --json
  $ inblog analytics sources --limit 20 --json
  $ inblog analytics post 123 --start-date 2025-01-01 --json
  $ inblog analytics post 123 --sources --json     Show referrer sources for a post
  $ inblog analytics compare --start-date 2025-03-01 --end-date 2025-03-31 --json`);


  analytics
    .command('traffic')
    .description('Show blog overall traffic')
    .option('--start-date <date>', 'Start date (YYYY-MM-DD)')
    .option('--end-date <date>', 'End date (YYYY-MM-DD)')
    .option('--interval <interval>', 'Interval: day, hour', 'day')
    .option('--type <type>', 'Page type: all, home, post, category, author', 'all')
    .action(async function (this: Command) {
      const json = isJsonMode(this);
      try {
        const opts = this.opts();
        const { analytics: endpoint } = createClientFromCommand(this);
        const data = await endpoint.traffic({
          start_date: opts.startDate,
          end_date: opts.endDate,
          interval: opts.interval,
          type: opts.type,
        });

        if (json) {
          printJson(data);
        } else {
          const rows = (data.data || []).map((r: any) => [
            r.date || r.period,
            r.visits,
            r.clicks,
            r.organic,
          ]);
          printTable(['Date', 'Visits', 'Clicks', 'Organic'], rows);
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  analytics
    .command('posts')
    .description('Show post-level metrics')
    .option('--start-date <date>', 'Start date (YYYY-MM-DD)')
    .option('--end-date <date>', 'End date (YYYY-MM-DD)')
    .option('--sort <field>', 'Sort by: visits, clicks, organic, cvr', 'visits')
    .option('--order <dir>', 'Sort order: asc, desc', 'desc')
    .option('-l, --limit <number>', 'Max results', '20')
    .option('--include <fields>', 'Include extra fields (e.g. title)')
    .action(async function (this: Command) {
      const json = isJsonMode(this);
      try {
        const opts = this.opts();
        const { analytics: endpoint } = createClientFromCommand(this);
        const data = await endpoint.posts({
          start_date: opts.startDate,
          end_date: opts.endDate,
          sort: opts.sort,
          order: opts.order,
          limit: parseInt(opts.limit, 10),
          include: opts.include,
        });

        if (json) {
          printJson(data);
        } else {
          const hasTitle = opts.include?.includes('title');
          const headers = hasTitle
            ? ['Post ID', 'Title', 'Visits', 'Clicks', 'Organic', 'CVR']
            : ['Post ID', 'Visits', 'Clicks', 'Organic', 'CVR'];
          const rows = (data.data || []).map((r: any) => {
            const cvr = typeof r.cvr === 'number' ? `${(r.cvr * 100).toFixed(1)}%` : (r.cvr ?? '—');
            if (hasTitle) {
              return [r.post_id ?? r.id, truncate(r.title, 40), r.visits, r.clicks, r.organic, cvr];
            }
            return [r.post_id ?? r.id, r.visits, r.clicks, r.organic, cvr];
          });
          printTable(headers, rows);
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  analytics
    .command('sources')
    .description('Show referrer sources')
    .option('--start-date <date>', 'Start date (YYYY-MM-DD)')
    .option('--end-date <date>', 'End date (YYYY-MM-DD)')
    .option('-l, --limit <number>', 'Max results', '20')
    .action(async function (this: Command) {
      const json = isJsonMode(this);
      try {
        const opts = this.opts();
        const { analytics: endpoint } = createClientFromCommand(this);
        const data = await endpoint.sources({
          start_date: opts.startDate,
          end_date: opts.endDate,
          limit: parseInt(opts.limit, 10),
        });

        if (json) {
          printJson(data);
        } else {
          const rows = (data.data || []).map((r: any) => [
            r.referrer || r.source,
            r.count ?? r.visits,
          ]);
          printTable(['Referrer', 'Count'], rows);
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  analytics
    .command('post <id>')
    .description('Show traffic or sources for a single post')
    .option('--start-date <date>', 'Start date (YYYY-MM-DD)')
    .option('--end-date <date>', 'End date (YYYY-MM-DD)')
    .option('--interval <interval>', 'Interval: day, hour', 'day')
    .option('--sources', 'Show referrer sources instead of traffic')
    .option('-l, --limit <number>', 'Max results (for --sources)', '20')
    .action(async function (this: Command, id: string) {
      const json = isJsonMode(this);
      try {
        const opts = this.opts();
        const { analytics: endpoint } = createClientFromCommand(this);
        const postId = parseInt(id, 10);

        if (opts.sources) {
          const data = await endpoint.postSources(postId, {
            start_date: opts.startDate,
            end_date: opts.endDate,
            limit: parseInt(opts.limit, 10),
          });

          if (json) {
            printJson(data);
          } else {
            const rows = (data.data || []).map((r: any) => [
              r.referrer || r.source,
              r.count ?? r.visits,
            ]);
            printTable(['Referrer', 'Count'], rows);
          }
        } else {
          const data = await endpoint.postTraffic(postId, {
            start_date: opts.startDate,
            end_date: opts.endDate,
            interval: opts.interval,
          });

          if (json) {
            printJson(data);
          } else {
            const rows = (data.data || []).map((r: any) => [
              r.date || r.period,
              r.visits,
              r.clicks,
              r.organic,
            ]);
            printTable(['Date', 'Visits', 'Clicks', 'Organic'], rows);
          }
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  analytics
    .command('compare')
    .description('Compare analytics between current and previous period')
    .option('--start-date <date>', 'Start date (YYYY-MM-DD)')
    .option('--end-date <date>', 'End date (YYYY-MM-DD)')
    .option('--vs-previous-period', 'Compare with previous period of same length (default)', true)
    .action(async function (this: Command) {
      const json = isJsonMode(this);
      try {
        const opts = this.opts();
        const { analytics: endpoint } = createClientFromCommand(this);

        // Determine current period
        const endDate = opts.endDate ? new Date(opts.endDate) : new Date();
        const startDate = opts.startDate ? new Date(opts.startDate) : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

        const periodLengthMs = endDate.getTime() - startDate.getTime();
        const prevEnd = new Date(startDate.getTime() - 1);  // day before current start
        const prevStart = new Date(prevEnd.getTime() - periodLengthMs);

        const fmt = (d: Date) => d.toISOString().split('T')[0];

        // Fetch both periods
        const [currentData, previousData] = await Promise.all([
          endpoint.traffic({ start_date: fmt(startDate), end_date: fmt(endDate) }),
          endpoint.traffic({ start_date: fmt(prevStart), end_date: fmt(prevEnd) }),
        ]);

        // Sum metrics for each period
        const sumMetrics = (rows: any[]) => {
          const result = { visits: 0, clicks: 0, organic: 0 };
          for (const r of rows) {
            result.visits += r.visits || 0;
            result.clicks += r.clicks || 0;
            result.organic += r.organic || 0;
          }
          return result;
        };

        const current = sumMetrics(currentData.data || []);
        const previous = sumMetrics(previousData.data || []);

        const delta = (cur: number, prev: number) => {
          const abs = cur - prev;
          const pct = prev === 0 ? (cur > 0 ? 100 : 0) : ((abs / prev) * 100);
          return { absolute: abs, percent: pct };
        };

        const comparison = {
          period: { start: fmt(startDate), end: fmt(endDate) },
          previous_period: { start: fmt(prevStart), end: fmt(prevEnd) },
          metrics: {
            visits: { current: current.visits, previous: previous.visits, delta: delta(current.visits, previous.visits) },
            clicks: { current: current.clicks, previous: previous.clicks, delta: delta(current.clicks, previous.clicks) },
            organic: { current: current.organic, previous: previous.organic, delta: delta(current.organic, previous.organic) },
          },
        };

        if (json) {
          printJson(comparison);
        } else {
          console.log(`\nCurrent period:  ${fmt(startDate)} to ${fmt(endDate)}`);
          console.log(`Previous period: ${fmt(prevStart)} to ${fmt(prevEnd)}\n`);

          const fmtDelta = (d: { absolute: number; percent: number }) => {
            const sign = d.absolute >= 0 ? '+' : '';
            return `${sign}${d.absolute} (${sign}${d.percent.toFixed(1)}%)`;
          };

          printTable(
            ['Metric', 'Current', 'Previous', 'Delta'],
            [
              ['Visits', current.visits, previous.visits, fmtDelta(comparison.metrics.visits.delta)],
              ['Clicks', current.clicks, previous.clicks, fmtDelta(comparison.metrics.clicks.delta)],
              ['Organic', current.organic, previous.organic, fmtDelta(comparison.metrics.organic.delta)],
            ],
          );
        }
      } catch (error) {
        handleError(error, json);
      }
    });
}
