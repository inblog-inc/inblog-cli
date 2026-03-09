import { Command } from 'commander';
import { registerAuthCommands } from '../src/commands/auth.js';
import { registerPostsCommands } from '../src/commands/posts.js';
import { registerTagsCommands } from '../src/commands/tags.js';
import { registerAuthorsCommands } from '../src/commands/authors.js';
import { registerBlogsCommands } from '../src/commands/blogs.js';
import { registerRedirectsCommands } from '../src/commands/redirects.js';
import { registerFormsCommands, registerFormResponsesCommands } from '../src/commands/forms.js';
import { registerConfigCommands } from '../src/commands/config.js';
import { registerSearchConsoleCommands } from '../src/commands/search-console.js';
import { registerAnalyticsCommands } from '../src/commands/analytics.js';


const program = new Command();

program
  .name('inblog')
  .description('CLI for managing inblog.ai blog content (posts, tags, authors, redirects, forms)')
  .version('0.2.0')
  .option('--json', 'Output as JSON (for programmatic use)')
  .option('--base-url <url>', 'API base URL')
  .option('--no-color', 'Disable colored output');

registerAuthCommands(program);
registerPostsCommands(program);
registerTagsCommands(program);
registerAuthorsCommands(program);
registerBlogsCommands(program);
registerRedirectsCommands(program);
registerFormsCommands(program);
registerFormResponsesCommands(program);
registerConfigCommands(program);
registerSearchConsoleCommands(program);
registerAnalyticsCommands(program);
program.parse();
