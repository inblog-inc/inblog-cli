# Preview Link Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add preview link generation to inblog-cli so Claude Code can visually verify posts before publishing.

**Architecture:** Three repos change: inblog server adds Bearer auth to existing `/api/preview-tokens` endpoint, inblog-cli adds SDK endpoint + `posts preview` commands + auto-preview on create/update, inblog-ai-skills updates 5 skill files with preview verification workflows.

**Tech Stack:** TypeScript, Next.js App Router (server), Commander.js (CLI), Markdown (skills)

**Spec:** `docs/superpowers/specs/2026-03-26-preview-link-design.md`

---

## File Map

### inblog (server)
- Modify: `/app/api/preview-tokens/route.ts` — Add Bearer token auth, change DELETE to accept query param

### inblog-cli
- Create: `src/sdk/endpoints/preview-tokens.ts` — SDK endpoint class
- Modify: `src/sdk/types.ts` — Add `PreviewToken` interface
- Modify: `src/sdk/index.ts` — Re-export new endpoint
- Modify: `src/utils/client-factory.ts` — Add `previewTokens` to `ClientContext`
- Modify: `src/commands/posts.ts` — Add `posts preview` subcommands + auto-preview on create/update

### inblog-ai-skills
- Modify: `content/write-seo-post.md` — Add preview verification step before publishing
- Modify: `content/manage-posts.md` — Add preview section
- Modify: `content/content-quality-checklist.md` — Add visual verification items
- Modify: `content/autopilot.md` — Add preview step between P8 and P9
- Modify: `content/api-reference.md` — Document preview commands

---

## Task 1: Server — Add Bearer auth to preview-tokens endpoint

**Repo:** `/Users/pyungjae/inblog-workspace/inblog`

**Files:**
- Modify: `app/api/preview-tokens/route.ts`

This is an App Router endpoint, so we can't use the Pages Router `withApiAuth` middleware directly. Instead, implement auth inline following the same pattern: extract Bearer token, validate via `supabaseAdmin.auth.getUser()`, check `profiles_blogs` membership using the post's `blog_id`.

- [ ] **Step 1: Add auth helper function**

Add a `resolveUser` helper at the top of `route.ts` (after imports) that extracts and validates the Bearer token:

```typescript
async function resolveUser(req: NextRequest): Promise<string | undefined> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    // Fall back to legacy x-user-id header (dashboard compat)
    return req.headers.get("x-user-id") ?? undefined;
  }
  const token = authHeader.split(" ")[1];
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return undefined;
  return user.id;
}

async function checkMembership(userId: string, blogId: number): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("profiles_blogs")
    .select("profile_id")
    .eq("profile_id", userId)
    .eq("blog_id", blogId)
    .maybeSingle();
  return !!data;
}
```

- [ ] **Step 2: Wire auth into POST handler**

In the `POST` function, after deriving `postRow.blog_id` (line 37), add auth check:

```typescript
const userId = await resolveUser(req);

// If Bearer token was provided, enforce membership
const authHeader = req.headers.get("authorization");
if (authHeader?.startsWith("Bearer ")) {
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "invalid or expired token" },
      { status: 401 }
    );
  }
  const isMember = await checkMembership(userId, postRow.blog_id!);
  if (!isMember) {
    return NextResponse.json(
      { ok: false, error: "access denied" },
      { status: 403 }
    );
  }
}
```

Replace the existing `const createdBy = req.headers.get("x-user-id") ?? undefined;` (line 52) with:

```typescript
const createdBy = userId;
```

- [ ] **Step 3: Wire auth into GET handler**

After `postId` validation in GET, add the same auth pattern. Need to look up post's `blog_id` first:

```typescript
// Auth check
const userId = await resolveUser(req);
const authHeader = req.headers.get("authorization");
if (authHeader?.startsWith("Bearer ")) {
  if (!userId) {
    return NextResponse.json({ ok: false, error: "invalid or expired token" }, { status: 401 });
  }
  const { data: postRow } = await supabaseAdmin
    .from("posts")
    .select("blog_id")
    .eq("id", postId)
    .maybeSingle();
  if (!postRow) {
    return NextResponse.json({ ok: false, error: "post not found" }, { status: 404 });
  }
  const isMember = await checkMembership(userId, postRow.blog_id!);
  if (!isMember) {
    return NextResponse.json({ ok: false, error: "access denied" }, { status: 403 });
  }
}
```

- [ ] **Step 4: Change DELETE to accept query parameter**

Replace the DELETE handler to support both query param (CLI) and body (dashboard backward compat):

```typescript
export async function DELETE(req: NextRequest) {
  try {
    // Support both query param (CLI) and body (dashboard)
    const { searchParams } = new URL(req.url);
    let token: string | undefined = searchParams.get("token") ?? undefined;
    if (!token) {
      try {
        const body = await req.json();
        token = body?.token;
      } catch {
        // No body provided
      }
    }
    if (!token) {
      return NextResponse.json(
        { ok: false, error: "token required" },
        { status: 400 }
      );
    }

    // Auth check (optional — if Bearer provided, validate)
    const userId = await resolveUser(req);
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ") && !userId) {
      return NextResponse.json(
        { ok: false, error: "invalid or expired token" },
        { status: 401 }
      );
    }

    const revoked = await revokeToken(token);
    return NextResponse.json({ ok: true, revoked: Boolean(revoked) });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "unknown" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 5: Test manually**

```bash
# From inblog directory, start dev server
cd /Users/pyungjae/inblog-workspace/inblog
# Test POST with Bearer token (use a valid Supabase JWT):
curl -X POST http://localhost:3000/api/preview-tokens \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"post_id": <valid-id>, "ttl_hours": 1}'

# Test GET
curl "http://localhost:3000/api/preview-tokens?post_id=<id>" \
  -H "Authorization: Bearer <jwt>"

# Test DELETE with query param
curl -X DELETE "http://localhost:3000/api/preview-tokens?token=<token>" \
  -H "Authorization: Bearer <jwt>"
```

- [ ] **Step 6: Commit**

```bash
cd /Users/pyungjae/inblog-workspace/inblog
git add app/api/preview-tokens/route.ts
git commit -m "feat: add Bearer token auth to preview-tokens endpoint

Support JWT auth via Authorization header with profiles_blogs
membership verification. DELETE now also accepts token as query
parameter for CLI compatibility. Legacy x-user-id header still
supported for dashboard backward compatibility."
```

---

## Task 2: CLI — Add PreviewToken type

**Repo:** `/Users/pyungjae/inblog-workspace/inblog-cli`

**Files:**
- Modify: `src/sdk/types.ts`

- [ ] **Step 1: Add PreviewToken interface**

Add at the end of `src/sdk/types.ts`:

```typescript
// ── Preview Tokens ──────────────────────────────────────────

export interface PreviewToken {
  token: string;
  share_url: string;
  expires_at: number | null;
  one_time: boolean;
  consumed: boolean;
  name?: string;
  site?: string;
  ttl_sec_left?: number;
  created_at?: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/sdk/types.ts
git commit -m "feat: add PreviewToken type definition"
```

---

## Task 3: CLI — Create PreviewTokensEndpoint

**Repo:** `/Users/pyungjae/inblog-workspace/inblog-cli`

**Files:**
- Create: `src/sdk/endpoints/preview-tokens.ts`

- [ ] **Step 1: Create endpoint file**

```typescript
import type { InblogClient } from '../client.js';
import type { PreviewToken } from '../types.js';

export class PreviewTokensEndpoint {
  constructor(private client: InblogClient) {}

  async create(
    postId: string,
    options: { ttlHours?: number; oneTime?: boolean; name?: string } = {},
  ): Promise<{ token: string; share_url: string; expires_at: number | null; site: string; name: string | null }> {
    return this.client.rawPost('/preview-tokens', {
      post_id: parseInt(postId, 10),
      ttl_hours: options.ttlHours ?? 24,
      one_time: options.oneTime ?? false,
      name: options.name,
    });
  }

  async list(postId: string): Promise<PreviewToken[]> {
    const res = await this.client.rawGet('/preview-tokens', {
      post_id: postId,
    });
    return res.tokens ?? [];
  }

  async revoke(token: string): Promise<{ ok: boolean; revoked: boolean }> {
    return this.client.rawDelete(`/preview-tokens?token=${encodeURIComponent(token)}`);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/sdk/endpoints/preview-tokens.ts
git commit -m "feat: add PreviewTokensEndpoint SDK class"
```

---

## Task 4: CLI — Wire endpoint into SDK exports and client factory

**Repo:** `/Users/pyungjae/inblog-workspace/inblog-cli`

**Files:**
- Modify: `src/sdk/index.ts`
- Modify: `src/utils/client-factory.ts`

- [ ] **Step 1: Add re-export in sdk/index.ts**

Add after the `FormResponsesEndpoint` line:

```typescript
export { PreviewTokensEndpoint } from './endpoints/preview-tokens.js';
```

- [ ] **Step 2: Add to ClientContext interface and factory**

In `src/utils/client-factory.ts`:

Add import:
```typescript
import { PreviewTokensEndpoint } from '../sdk/endpoints/preview-tokens.js';
```

Add to `ClientContext` interface:
```typescript
previewTokens: PreviewTokensEndpoint;
```

Add to the return object in `createClientFromCommand()`:
```typescript
previewTokens: new PreviewTokensEndpoint(client),
```

- [ ] **Step 3: Commit**

```bash
git add src/sdk/index.ts src/utils/client-factory.ts
git commit -m "feat: wire PreviewTokensEndpoint into SDK exports and client factory"
```

---

## Task 5: CLI — Add `posts preview` subcommands

**Repo:** `/Users/pyungjae/inblog-workspace/inblog-cli`

**Files:**
- Modify: `src/commands/posts.ts`

- [ ] **Step 1: Add `posts preview` subcommand (create token)**

After the last subcommand registration (around line 429, after `remove-author`), add:

```typescript
  const preview = posts
    .command('preview <id>')
    .description('Generate a preview link for a post')
    .option('--ttl <hours>', 'Token TTL in hours (1, 24, 72, 168, 720, 0=never)', '24')
    .option('--one-time', 'Token can only be used once')
    .option('--name <name>', 'Name for this preview link')
    .action(async function (this: Command, id: string) {
      const json = isJsonMode(this);
      try {
        const opts = this.opts();
        const { previewTokens } = createClientFromCommand(this);

        const result = await previewTokens.create(id, {
          ttlHours: parseInt(opts.ttl, 10),
          oneTime: opts.oneTime ?? false,
          name: opts.name,
        });

        if (json) {
          printJson(result);
        } else {
          printSuccess('Preview link created');
          printDetail([
            ['URL', result.share_url],
            ['Token', result.token],
            ['Site', result.site],
            ['Expires', result.expires_at
              ? new Date(result.expires_at).toLocaleString()
              : 'never'],
          ]);
        }
      } catch (error) {
        handleError(error, json);
      }
    });
```

- [ ] **Step 2: Add `posts preview list` subcommand**

```typescript
  preview
    .command('list <id>')
    .description('List active preview tokens for a post')
    .action(async function (this: Command, id: string) {
      const json = isJsonMode(this);
      try {
        const { previewTokens } = createClientFromCommand(this);
        const tokens = await previewTokens.list(id);

        if (json) {
          printJson(tokens);
        } else if (tokens.length === 0) {
          printWarning('No active preview tokens for this post.');
        } else {
          printTable(
            ['Token', 'Name', 'Expires', 'One-time', 'Used', 'URL'],
            tokens.map((t) => [
              truncate(t.token, 12),
              t.name ?? '—',
              t.expires_at ? new Date(t.expires_at).toLocaleString() : 'never',
              t.one_time ? 'yes' : 'no',
              t.consumed ? 'yes' : 'no',
              t.share_url,
            ]),
          );
        }
      } catch (error) {
        handleError(error, json);
      }
    });
```

- [ ] **Step 3: Add `posts preview revoke` subcommand**

```typescript
  preview
    .command('revoke <token>')
    .description('Revoke a preview token')
    .action(async function (this: Command, token: string) {
      const json = isJsonMode(this);
      try {
        const { previewTokens } = createClientFromCommand(this);
        const result = await previewTokens.revoke(token);

        if (json) {
          printJson(result);
        } else if (result.revoked) {
          printSuccess('Preview token revoked.');
        } else {
          printWarning('Token not found or already revoked.');
        }
      } catch (error) {
        handleError(error, json);
      }
    });
```

- [ ] **Step 4: Commit**

```bash
git add src/commands/posts.ts
git commit -m "feat: add posts preview, preview list, preview revoke commands"
```

---

## Task 6: CLI — Auto-preview on create/update

**Repo:** `/Users/pyungjae/inblog-workspace/inblog-cli`

**Files:**
- Modify: `src/commands/posts.ts`

- [ ] **Step 1: Add `--no-preview` option to create command**

Add option to the `create` command (after line 133, the `--meta-description` option):

```typescript
    .option('--no-preview', 'Skip automatic preview link generation')
```

- [ ] **Step 2: Add auto-preview logic to create action**

After the successful create output (after `printDetail(formatPost(data));` around line 173), add preview token generation:

```typescript
        // Auto-generate preview link
        if (!opts.noPreview) {
          try {
            const { previewTokens } = createClientFromCommand(this);
            const preview = await previewTokens.create(data.id, {
              ttlHours: 24,
              name: 'cli-auto',
            });
            if (json) {
              printJson({ ...data, preview: { url: preview.share_url, token: preview.token, expires_at: preview.expires_at } });
            } else {
              console.log(`\n  Preview: ${preview.share_url}  (expires in 24h)`);
            }
          } catch {
            if (!json) printWarning('Could not generate preview link.');
          }
        }
```

Note: For JSON mode, we need to restructure slightly — the original `printJson(data)` on line 170 should be deferred. Wrap the JSON output:

Replace the existing JSON/table output block (lines 169-174):

```typescript
        if (json) {
          // Preview will be appended below if available
          let output: Record<string, any> = { ...data };
          if (!opts.noPreview) {
            try {
              const { previewTokens } = createClientFromCommand(this);
              const pv = await previewTokens.create(data.id, { ttlHours: 24, name: 'cli-auto' });
              output.preview = { url: pv.share_url, token: pv.token, expires_at: pv.expires_at };
            } catch { /* non-blocking */ }
          }
          printJson(output);
        } else {
          printSuccess(`Post created: "${data.title}" (ID: ${data.id})`);
          printDetail(formatPost(data));
          if (!opts.noPreview) {
            try {
              const { previewTokens } = createClientFromCommand(this);
              const pv = await previewTokens.create(data.id, { ttlHours: 24, name: 'cli-auto' });
              console.log(`\n  Preview: ${pv.share_url}  (expires in 24h)`);
            } catch {
              printWarning('Could not generate preview link.');
            }
          }
        }
```

- [ ] **Step 3: Add `--no-preview` option and auto-preview to update command**

Same pattern for update. Add option:

```typescript
    .option('--no-preview', 'Skip automatic preview link generation')
```

Replace the output block (lines 228-232):

```typescript
        if (json) {
          let output: Record<string, any> = { ...data };
          if (!opts.noPreview) {
            try {
              const { previewTokens } = createClientFromCommand(this);
              const pv = await previewTokens.create(id, { ttlHours: 24, name: 'cli-auto' });
              output.preview = { url: pv.share_url, token: pv.token, expires_at: pv.expires_at };
            } catch { /* non-blocking */ }
          }
          printJson(output);
        } else {
          printSuccess(`Post updated: "${data.title}" (ID: ${data.id})`);
          if (!opts.noPreview) {
            try {
              const { previewTokens } = createClientFromCommand(this);
              const pv = await previewTokens.create(id, { ttlHours: 24, name: 'cli-auto' });
              console.log(`\n  Preview: ${pv.share_url}  (expires in 24h)`);
            } catch {
              printWarning('Could not generate preview link.');
            }
          }
        }
```

- [ ] **Step 4: Verify build**

```bash
cd /Users/pyungjae/inblog-workspace/inblog-cli
npm run build
```

Expected: Clean build with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/commands/posts.ts
git commit -m "feat: auto-generate preview link on posts create/update

Preview token (24h TTL) is automatically created after successful
post creation or update. Use --no-preview to skip. Preview failure
is non-blocking — the main operation still succeeds."
```

---

## Task 7: Skills — Update write-seo-post.md

**Repo:** `/Users/pyungjae/inblog-workspace/inblog-ai-skills`

**Files:**
- Modify: `content/write-seo-post.md`

- [ ] **Step 1: Insert preview verification step**

Between Phase 3 publish commands (line 128) and Phase 4 heading (line 131), insert:

```markdown

### Phase 3.5: Preview Verification

Before publishing, verify the post visually:

1. The `posts create` output includes a preview link (`Preview: https://inblog.io/p/...`)
2. Open the preview URL using `claude-in-chrome` tools:
   - Navigate to the preview URL
   - Take a screenshot of the full page
3. Check the following:
   - **Readability:** Title, body text, paragraph spacing are clear
   - **Images:** All images load correctly, no broken images
   - **Layout:** No layout issues, proper content flow
   - **Missing elements:** Cover image present, tags displayed, author shown
4. If issues found:
   - Fix content with `inblog posts update <id> --content-file ./fixed.html`
   - New preview link is generated automatically — verify again
5. If everything looks good, proceed to publish

```

- [ ] **Step 2: Commit**

```bash
cd /Users/pyungjae/inblog-workspace/inblog-ai-skills
git add content/write-seo-post.md
git commit -m "feat: add preview verification step to write-seo-post skill"
```

---

## Task 8: Skills — Update manage-posts.md

**Repo:** `/Users/pyungjae/inblog-workspace/inblog-ai-skills`

**Files:**
- Modify: `content/manage-posts.md`

- [ ] **Step 1: Insert preview section**

Between the update section (line 55) and publish section (line 57), insert:

```markdown

## Preview Before Publishing

After editing a post, verify changes visually before publishing:

```bash
# Generate a preview link (24h TTL by default)
inblog posts preview <id>

# List active preview links
inblog posts preview list <id>

# Revoke a preview link
inblog posts preview revoke <token>
```

Use `claude-in-chrome` to open the preview URL, take a screenshot, and check for readability, broken images, and layout issues. The `posts create` and `posts update` commands also output a preview link automatically.

```

- [ ] **Step 2: Commit**

```bash
git add content/manage-posts.md
git commit -m "feat: add preview section to manage-posts skill"
```

---

## Task 9: Skills — Update content-quality-checklist.md

**Repo:** `/Users/pyungjae/inblog-workspace/inblog-ai-skills`

**Files:**
- Modify: `content/content-quality-checklist.md`

- [ ] **Step 1: Add visual verification section**

After section 8 (Post Metadata Final Check, after line 109), insert:

```markdown

## 9. Visual Preview Verification

Use the preview link from `inblog posts preview <id>` or the auto-generated link from create/update.

- [ ] Open preview URL with `claude-in-chrome` and screenshot
- [ ] All images load (no broken image icons)
- [ ] Cover image displays correctly
- [ ] Code blocks and tables render properly
- [ ] Callout blocks and special elements display correctly
- [ ] Text is readable (font size, line spacing, contrast)
- [ ] No layout overflow or misalignment
```

Update the existing section 9 numbering (Series Post Repetition Prevention) to section 10.

- [ ] **Step 2: Commit**

```bash
git add content/content-quality-checklist.md
git commit -m "feat: add visual preview verification to quality checklist"
```

---

## Task 10: Skills — Update autopilot.md and api-reference.md

**Repo:** `/Users/pyungjae/inblog-workspace/inblog-ai-skills`

**Files:**
- Modify: `content/autopilot.md`
- Modify: `content/api-reference.md`

- [ ] **Step 1: Update autopilot priority table**

In the priority table (around line 63), insert a new row between P8 and P9, shifting subsequent priorities:

```markdown
| P9 | Reviewed drafts ready to publish | Preview verify | `inblog-manage-posts` (preview) |
```

The existing P9 (publish) becomes P10, and all subsequent priorities shift by 1.

- [ ] **Step 2: Update api-reference.md**

After the schedule command (line 77), add:

```markdown

# Preview
inblog posts preview <id> --json                              # Generate preview link
inblog posts preview <id> --ttl 72 --json                     # Custom TTL (hours)
inblog posts preview <id> --one-time --json                   # One-time use link
inblog posts preview <id> --name "for-review" --json          # Named link
inblog posts preview list <id> --json                         # List active tokens
inblog posts preview revoke <token> --json                    # Revoke token
```

- [ ] **Step 3: Commit**

```bash
git add content/autopilot.md content/api-reference.md
git commit -m "feat: add preview commands to autopilot and api-reference skills"
```

---

## Task 11: End-to-end verification

- [ ] **Step 1: Build CLI**

```bash
cd /Users/pyungjae/inblog-workspace/inblog-cli
npm run build
```

- [ ] **Step 2: Test preview commands**

```bash
# Login and select a blog
node dist/inblog.js auth status

# Create a test post and verify preview link appears
node dist/inblog.js posts create --title "Preview Test" --content "<p>Hello</p>"

# Generate additional preview link
node dist/inblog.js posts preview <id>

# List preview tokens
node dist/inblog.js posts preview list <id>

# Revoke a token
node dist/inblog.js posts preview revoke <token>

# Test --no-preview flag
node dist/inblog.js posts create --title "No Preview Test" --content "<p>Test</p>" --no-preview

# Test JSON mode
node dist/inblog.js posts create --title "JSON Test" --content "<p>Test</p>" --json

# Clean up test posts
node dist/inblog.js posts delete <id>
```

- [ ] **Step 3: Verify help text**

```bash
node dist/inblog.js posts preview --help
node dist/inblog.js posts preview list --help
node dist/inblog.js posts preview revoke --help
```

- [ ] **Step 4: Clean up test posts and commit any fixes**
