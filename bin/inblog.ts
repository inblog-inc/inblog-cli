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
import { registerImagesCommands } from '../src/commands/images.js';
import { registerUpdateCommand } from '../src/commands/update.js';

declare const __PKG_VERSION__: string;

const program = new Command();

program
  .name('inblog')
  .description('CLI for managing inblog.ai blog content (posts, tags, authors, redirects, forms)')
  .version(__PKG_VERSION__)
  .option('--json', 'Output as JSON (for programmatic use)')
  .option('--no-input', 'Disable interactive prompts (fail instead of prompting)')
  .option('--base-url <url>', 'API base URL')
  .option('--no-color', 'Disable colored output')
  .addHelpText('after', `
Examples:
  $ inblog auth login                          Log in with Google OAuth
  $ inblog posts list --published --json       List published posts as JSON
  $ inblog posts create --title "Hello" --content-file ./post.html --json
  $ inblog tags list --json                    List all tags
  $ inblog analytics traffic --start-date 2025-01-01 --json

Environment:
  Config: ~/.config/inblog/config.json
  Docs:   https://inblog.ai/docs/api`);

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
registerImagesCommands(program);
registerUpdateCommand(program);
program.parse();
