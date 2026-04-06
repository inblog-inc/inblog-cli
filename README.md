# @inblog/cli

Command-line tool for managing [inblog.ai](https://inblog.ai) blog content. Create, publish, and manage blog posts, tags, authors, images, and more from your terminal.

## Installation

```bash
npm install -g @inblog/cli
```

Requires Node.js 18+.

## Quick Start

```bash
# Authenticate with your API key
inblog auth login

# Check current blog
inblog auth status

# List posts
inblog posts list

# Create a post (preview link auto-generated)
inblog posts create --title "My Post" --slug "my-post" --content-file ./content.html

# Preview before publishing
# → Preview: https://inblog.io/p/abc123  (expires in 24h)

inblog posts publish <id>
```

## Commands

### Authentication

```bash
inblog auth login              # Login with API key
inblog auth whoami             # Show current user/blog
inblog auth status             # Check auth status
inblog auth logout             # Remove saved credentials
```

### Blog Management

```bash
inblog blogs me                # Current blog info
inblog blogs list              # List accessible blogs (OAuth)
inblog blogs switch [id]       # Switch active blog
inblog blogs update            # Update blog settings
```

**Blog settings:**

```bash
inblog blogs update --title "Blog Name" --description "About" --language ko
inblog blogs update --logo ./logo.png --favicon ./favicon.ico --og-image ./og.jpg
inblog blogs update --ga-id G-XXXXXXXXXX
```

**Custom domain:**

```bash
inblog blogs domain connect blog.example.com   # Connect + DNS guide
inblog blogs domain status                     # Check verification
inblog blogs domain disconnect                 # Disconnect
```

**Banner:**

```bash
inblog blogs banner get
inblog blogs banner set --image ./banner.png --title "Title" --subtext "Subtitle"
inblog blogs banner remove
```

### Posts

```bash
inblog posts list                          # List all posts
inblog posts list --published              # Published only
inblog posts list --draft                  # Drafts only
inblog posts get <id>                      # Post details

inblog posts create \
  --title "Title" \
  --slug "url-slug" \
  --image ./cover.jpg \
  --content-file ./content.html

inblog posts update <id> --title "New Title" --image ./new-cover.jpg
inblog posts delete <id>

# CTA settings
inblog posts update <id> --cta-text "Try free" --cta-link "https://..." --cta-color "#3B82F6"
inblog posts update <id> --cta-text ""         # Remove CTA

# Custom scripts & JSON-LD
inblog posts update <id> --json-ld-file ./schema.json
inblog posts update <id> --custom-scripts-file ./scripts.json
inblog posts update <id> --remove-custom-scripts

inblog posts publish <id>                  # Publish immediately
inblog posts unpublish <id>                # Unpublish
inblog posts schedule <id> --at "2026-03-15T09:00:00+09:00"
```

**Preview links:**

```bash
inblog posts preview <id>                  # Generate preview link (24h)
inblog posts preview <id> --ttl 72         # Custom TTL in hours
inblog posts preview <id> --one-time       # One-time use link
inblog posts preview list <id>             # List active preview links
inblog posts preview revoke <token>        # Revoke a link
```

Preview links are automatically generated when creating or updating posts. Use `--skip-preview` to disable.

**Tags & Authors on posts:**

```bash
inblog posts add-tags <id> --tag-ids 1,2,3
inblog posts remove-tag <postId> <tagId>
inblog posts add-authors <id> --author-ids uuid1,uuid2
inblog posts remove-author <postId> <authorId>
```

### Images

```bash
# Upload images to CDN
inblog images upload ./photo1.jpg ./photo2.png
inblog images upload ./cover.jpg -b featured_image --json
```

Local image files used with `--image` or `--content-file` are automatically uploaded to the CDN.

### Tags

```bash
inblog tags list
inblog tags create --name "Tag Name" --slug "tag-slug"
inblog tags update <id> --name "New Name"
inblog tags delete <id>
```

### Authors

```bash
inblog authors list
inblog authors get <id>
inblog authors update <id> --name "Name" --avatar-url "https://..."
```

### Redirects

```bash
inblog redirects list
inblog redirects create --from "/old" --to "/new" --type 308
inblog redirects update <id> --to "/newer"
inblog redirects delete <id>
```

### Forms

```bash
inblog forms list
inblog forms get <id>
inblog form-responses list --form-id <id>
```

### Search Console

```bash
inblog search-console connect              # OAuth connect
inblog search-console status               # Connection status
inblog search-console keywords --sort clicks --limit 20
inblog search-console pages --sort clicks --limit 20
```

### Analytics

```bash
inblog analytics traffic --interval day    # Blog traffic
inblog analytics posts --sort visits --limit 20 --include title
inblog analytics sources --limit 20        # Traffic sources
inblog analytics post <id> --interval day  # Single post traffic
inblog analytics post <id> --sources       # Single post sources
```

## Global Options

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |
| `--base-url <url>` | Custom API base URL |
| `--no-color` | Disable colored output |
| `--api-key <key>` | Use specific API key |

## Image Handling

The CLI automatically handles image uploads:

- `--image ./cover.jpg` on `posts create/update` uploads the file to CDN
- `--content-file` scans HTML for local file paths and base64 data URIs, uploads them, and replaces with CDN URLs
- `--logo`, `--favicon`, `--og-image` on `blogs update` accept local files
- `inblog images upload` for standalone CDN uploads

**Note:** Do not embed base64 images directly in `content_html` API calls (causes 413 errors). Use `--content-file` or upload first with `inblog images upload`.

## API Key

Get your API key from [inblog.ai dashboard](https://inblog.ai) > Settings > API Keys. Requires a Team plan or higher.

## AI Skills

For AI-assisted blog management (Claude Code, Cursor, GitHub Copilot), install the companion package:

```bash
npx @inblog/ai-skills
```

## License

MIT
