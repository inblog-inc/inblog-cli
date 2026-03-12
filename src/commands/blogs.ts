import { Command } from 'commander';
import { select } from '@inquirer/prompts';
import open from 'open';
import { createClientFromCommand, isJsonMode } from '../utils/client-factory.js';
import { readSession, setActiveBlog } from '../utils/token-store.js';
import { getValidAccessToken } from '../utils/token-refresh.js';
import { printJson, printDetail, printSuccess, printTable, printWarning } from '../utils/output.js';
import { handleError } from '../utils/errors.js';
import { readConfig } from '../utils/config.js';
import { lookupNameservers, detectDnsProvider, getDnsProviderGuide, isSubdomain } from '../utils/domain.js';
import { resolveImageUrl } from '../utils/upload.js';

export function registerBlogsCommands(program: Command): void {
  const blogs = program.command('blogs').description('Manage blogs — list, switch, view, and update blog settings');

  blogs
    .command('me')
    .description('Show blog info (title, subdomain, plan, domain)')
    .action(async function (this: Command) {
      const json = isJsonMode(this);
      try {
        const { blogs: endpoint } = createClientFromCommand(this);
        const { data } = await endpoint.me();
        if (json) {
          printJson(data);
        } else {
          printDetail([
            ['ID', data.id],
            ['Title', data.title],
            ['Subdomain', data.subdomain],
            ['Description', data.description],
            ['Plan', data.plan],
            ['Language', data.blog_language],
            ['Custom Domain', data.custom_domain],
            ['Domain Verified', data.custom_domain_verified],
            ['Logo', data.logo_url],
            ['Favicon', data.favicon],
            ['OG Image', data.og_image],
            ['GA ID', data.ga_measurement_id],
            ['Search Console', data.is_search_console_connected ? `Connected (${data.search_console_url})` : 'Not connected'],
            ['Created At', data.created_at],
          ]);
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  blogs
    .command('create')
    .description('Create a new blog (opens inblog.ai in your browser)')
    .action(async function (this: Command) {
      const json = isJsonMode(this);
      try {
        const url = 'https://inblog.ai/dashboard/create?utm_source=cli';
        if (json) {
          printJson({ url });
        } else {
          printSuccess('Opening inblog.ai to create a new blog...');
          await open(url);
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  blogs
    .command('list')
    .description('List all blogs you have access to (OAuth only)')
    .action(async function (this: Command) {
      const json = isJsonMode(this);
      try {
        const session = readSession();
        if (!session) {
          throw new Error('OAuth session required. Run `inblog auth login` first.');
        }

        const accessToken = await getValidAccessToken();
        if (!accessToken) {
          throw new Error('Session expired. Run `inblog auth login` to re-authenticate.');
        }

        const config = readConfig();
        const baseUrl = this.optsWithGlobals().baseUrl || config.baseUrl || 'https://inblog.ai';

        const response = await fetch(`${baseUrl}/api/v1/user/blogs`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Blog-Id': '0',
            Accept: 'application/vnd.api+json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch blogs: HTTP ${response.status}`);
        }

        const blogsData: any = await response.json();
        const blogsList = blogsData.data || [];

        if (json) {
          printJson(blogsList.map((b: any) => ({
            id: parseInt(b.id, 10),
            ...b.attributes,
          })));
          return;
        }

        if (blogsList.length === 0) {
          printWarning('No blogs found.');
          return;
        }

        const activeBlogId = session.activeBlogId;

        printTable(
          ['', 'ID', 'Title', 'Subdomain', 'Permission', 'Plan'],
          blogsList.map((b: any) => {
            const id = parseInt(b.id, 10);
            const active = id === activeBlogId ? '*' : '';
            return [active, id, b.attributes.title, b.attributes.subdomain, b.attributes.permission, b.attributes.plan];
          }),
        );
      } catch (error) {
        handleError(error, json);
      }
    });

  blogs
    .command('switch [blog-id]')
    .description('Switch active blog (OAuth only)')
    .action(async function (this: Command, blogIdArg?: string) {
      const json = isJsonMode(this);
      try {
        const session = readSession();
        if (!session) {
          throw new Error('OAuth session required. Run `inblog auth login` first.');
        }

        const accessToken = await getValidAccessToken();
        if (!accessToken) {
          throw new Error('Session expired. Run `inblog auth login` to re-authenticate.');
        }

        const config = readConfig();
        const baseUrl = this.optsWithGlobals().baseUrl || config.baseUrl || 'https://inblog.ai';

        const response = await fetch(`${baseUrl}/api/v1/user/blogs`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Blog-Id': '0',
            Accept: 'application/vnd.api+json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch blogs: HTTP ${response.status}`);
        }

        const blogsData: any = await response.json();
        const blogsList = blogsData.data || [];

        if (blogsList.length === 0) {
          throw new Error('No blogs found for your account.');
        }

        let selectedBlogId: number;
        let selectedSubdomain: string;

        if (blogIdArg) {
          const target = blogsList.find((b: any) => b.id === blogIdArg || b.attributes.subdomain === blogIdArg);
          if (!target) {
            throw new Error(`Blog not found: ${blogIdArg}`);
          }
          selectedBlogId = parseInt(target.id, 10);
          selectedSubdomain = target.attributes.subdomain;
        } else {
          if (json) {
            throw new Error('Blog ID is required in --json mode. Usage: inblog blogs switch <blog-id>');
          }

          const choices = blogsList.map((b: any) => ({
            name: `${b.attributes.title} (${b.attributes.subdomain}) [${b.attributes.permission}]`,
            value: { id: parseInt(b.id, 10), subdomain: b.attributes.subdomain },
          }));

          const selected = await select<{ id: number; subdomain: string }>({
            message: 'Select a blog:',
            choices,
          });

          selectedBlogId = selected.id;
          selectedSubdomain = selected.subdomain;
        }

        const targetBlog = blogsList.find((b: any) => b.id === String(selectedBlogId));
        const activeBlogPlan = targetBlog?.attributes.plan;

        setActiveBlog(selectedBlogId, selectedSubdomain, activeBlogPlan);

        if (json) {
          printJson({ success: true, blogId: selectedBlogId, subdomain: selectedSubdomain });
        } else {
          printSuccess(`Switched to blog: ${selectedSubdomain}`);
        }

        if (activeBlogPlan !== 'team' && activeBlogPlan !== 'enterprise') {
          printWarning(`Blog "${selectedSubdomain}" is on the ${activeBlogPlan || 'free'} plan.`);
          printWarning('  CLI features require a Team plan or above.');
          printWarning(`  Upgrade: https://inblog.ai/dashboard/${selectedSubdomain}/settings/billing`);
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  blogs
    .command('update')
    .description('Update blog title, description, language, or timezone')
    .option('-t, --title <title>', 'Blog title')
    .option('-d, --description <desc>', 'Blog description')
    .option('--language <lang>', 'Blog language')
    .option('--timezone-diff <hours>', 'Timezone offset in hours')
    .option('--logo <path-or-url>', 'Blog logo image (local file or URL)')
    .option('--favicon <path-or-url>', 'Blog favicon image (local file or URL)')
    .option('--og-image <path-or-url>', 'Blog OG image (local file or URL)')
    .option('--ga-id <id>', 'Google Analytics measurement ID')
    .action(async function (this: Command) {
      const json = isJsonMode(this);
      try {
        const opts = this.opts();
        const ctx = createClientFromCommand(this);

        const input: Record<string, any> = {};
        if (opts.title) input.title = opts.title;
        if (opts.description) input.description = opts.description;
        if (opts.language) input.blog_language = opts.language;
        if (opts.timezoneDiff !== undefined) input.timezone_diff = parseInt(opts.timezoneDiff, 10);
        if (opts.logo) input.logo = await resolveImageUrl(opts.logo, 'logo');
        if (opts.favicon) input.favicon = await resolveImageUrl(opts.favicon, 'favicon');
        if (opts.ogImage) input.og_image = await resolveImageUrl(opts.ogImage, 'og_image');
        if (opts.gaId) input.ga_measurement_id = opts.gaId;

        if (Object.keys(input).length === 0) {
          throw new Error('No fields to update. Provide at least one option.');
        }

        const { data } = await ctx.blogs.update(input);
        if (json) {
          printJson(data);
        } else {
          printSuccess(`Blog updated: "${data.title}"`);
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  // ── Domain subcommands ──

  const domain = blogs.command('domain').description('Manage custom domain');

  domain
    .command('connect <domain>')
    .description('Connect a custom domain (with DNS provider detection)')
    .action(async function (this: Command, domainArg: string) {
      const json = isJsonMode(this);
      try {
        const ctx = createClientFromCommand(this);
        const result = await ctx.blogs.domainConnect(domainArg);

        // NS lookup for provider detection
        const nameservers = await lookupNameservers(domainArg);
        const provider = detectDnsProvider(nameservers);
        const guide = provider ? getDnsProviderGuide(provider) : null;
        const isSub = isSubdomain(domainArg);

        if (json) {
          printJson({
            ...result,
            nameservers,
            dns_provider: provider,
            dns_provider_guide: guide,
            is_subdomain: isSub,
          });
        } else {
          printSuccess(`Custom domain requested: ${domainArg}`);

          // DNS provider info
          if (provider) {
            console.log(`\n  DNS Provider: ${provider}`);
            if (nameservers.length > 0) {
              console.log(`  Nameservers: ${nameservers.join(', ')}`);
            }
          } else if (nameservers.length > 0) {
            console.log(`\n  Nameservers: ${nameservers.join(', ')}`);
          }

          // DNS records to set
          console.log('\n  DNS 설정:');
          if (isSub) {
            console.log(`  → CNAME ${domainArg} → cname.inblog.ai`);
          } else {
            console.log(`  → A ${domainArg} → 76.76.21.21`);
          }

          if (result.dns_records && result.dns_records.length > 0) {
            console.log('');
            printTable(
              ['Type', 'Name', 'Value'],
              result.dns_records.map((r: any) => [r.type, r.name, r.value]),
            );
          }

          // Provider-specific guide
          if (guide) {
            console.log(`\n  ${provider} DNS 설정 가이드: ${guide}`);
          }

          printWarning('\nDNS 전파 후 `inblog blogs domain status`로 확인하세요.');
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  domain
    .command('status')
    .description('Check custom domain verification status')
    .action(async function (this: Command) {
      const json = isJsonMode(this);
      try {
        const ctx = createClientFromCommand(this);
        const result = await ctx.blogs.domainStatus();

        if (json) {
          printJson(result);
        } else {
          if (!result.custom_domain) {
            printWarning('No custom domain configured.');
            return;
          }
          printDetail([
            ['Domain', result.custom_domain],
            ['Verified', result.verified],
            ['SSL Status', result.ssl_status],
          ]);
          if (result.dns_records && result.dns_records.length > 0) {
            printTable(
              ['Type', 'Name', 'Value'],
              result.dns_records.map((r: any) => [r.type, r.name, r.value]),
            );
          }
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  domain
    .command('disconnect')
    .description('Disconnect custom domain')
    .action(async function (this: Command) {
      const json = isJsonMode(this);
      try {
        const ctx = createClientFromCommand(this);
        await ctx.blogs.domainDisconnect();

        if (json) {
          printJson({ success: true });
        } else {
          printSuccess('Custom domain disconnected.');
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  // ── Banner subcommands ──

  const banner = blogs.command('banner').description('Manage blog banner settings');

  banner
    .command('get')
    .description('Show current banner settings')
    .action(async function (this: Command) {
      const json = isJsonMode(this);
      try {
        const ctx = createClientFromCommand(this);
        const result = await ctx.blogs.getCustomUi();

        if (json) {
          printJson(result);
        } else {
          printDetail([
            ['Banner Image', result.banner_url],
            ['Title', result.banner_title],
            ['Subtext', result.banner_subtext],
            ['Title Color', result.banner_title_color],
            ['Background Color', result.banner_bg_color],
          ]);
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  banner
    .command('set')
    .description('Update banner settings')
    .option('--image <path-or-url>', 'Banner image (local file or URL)')
    .option('--title <text>', 'Banner title text')
    .option('--subtext <text>', 'Banner subtext')
    .option('--title-color <hex>', 'Banner title color (hex)')
    .option('--bg-color <hex>', 'Banner background color (hex)')
    .action(async function (this: Command) {
      const json = isJsonMode(this);
      try {
        const opts = this.opts();
        const input: Record<string, any> = {};
        if (opts.image) input.banner_url = await resolveImageUrl(opts.image, 'banner');
        if (opts.title) input.banner_title = opts.title;
        if (opts.subtext) input.banner_subtext = opts.subtext;
        if (opts.titleColor) input.banner_title_color = opts.titleColor;
        if (opts.bgColor) input.banner_bg_color = opts.bgColor;

        if (Object.keys(input).length === 0) {
          throw new Error('No fields to update. Provide at least one option (--image, --title, --subtext, --title-color, --bg-color).');
        }

        const ctx = createClientFromCommand(this);
        const result = await ctx.blogs.updateCustomUi(input);

        if (json) {
          printJson(result);
        } else {
          printSuccess('Banner updated.');
          printDetail([
            ['Banner Image', result.banner_url],
            ['Title', result.banner_title],
            ['Subtext', result.banner_subtext],
            ['Title Color', result.banner_title_color],
            ['Background Color', result.banner_bg_color],
          ]);
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  banner
    .command('remove')
    .description('Remove banner settings')
    .action(async function (this: Command) {
      const json = isJsonMode(this);
      try {
        const ctx = createClientFromCommand(this);
        await ctx.blogs.updateCustomUi({
          banner_url: null,
          banner_title: null,
          banner_subtext: null,
        });

        if (json) {
          printJson({ success: true });
        } else {
          printSuccess('Banner removed.');
        }
      } catch (error) {
        handleError(error, json);
      }
    });
}
