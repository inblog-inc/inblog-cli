import { createServer, type Server } from 'node:http';

// ── Types ──

export interface BlogChoice {
  id: number;
  title: string;
  subdomain: string;
  permission: string;
  plan?: string;
}

export interface BlogSelection {
  id: number;
  subdomain: string;
  plan?: string;
}

export interface AuthServer {
  readonly port: number;
  waitForCode(): Promise<string>;
  setBlogs(blogs: BlogChoice[]): void;
  setAutoSelectedBlog(blog: BlogSelection): void;
  waitForBlogSelection(): Promise<BlogSelection>;
  close(): void;
}

// ── HTML Templates ──

const ERROR_HTML = `<!DOCTYPE html><html><body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#fafafa"><div style="text-align:center"><h2>Login failed</h2><p style="color:#666">Please close this window and try again.</p></div></body></html>`;

const SUCCESS_HTML = `<!DOCTYPE html><html><body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#fafafa"><div style="text-align:center"><div style="font-size:2rem;margin-bottom:1rem">\u2705</div><h2>Login successful!</h2><p style="color:#666">You can close this window and return to the terminal.</p></div></body></html>`;

const AUTH_PAGE_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>inblog CLI Login</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; background: #fafafa; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
  #app { text-align: center; max-width: 480px; width: 100%; padding: 2rem; }
  .spinner { width: 32px; height: 32px; border: 3px solid #e5e7eb; border-top-color: #2563eb; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 1rem; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .blog-card { display: block; padding: 1rem 1.25rem; margin: 0.5rem 0; border: 1px solid #e5e7eb; border-radius: 10px; text-decoration: none; color: inherit; background: white; text-align: left; transition: border-color 0.15s, box-shadow 0.15s; cursor: pointer; }
  .blog-card:hover { border-color: #2563eb; box-shadow: 0 0 0 1px #2563eb; }
  .blog-card strong { display: block; margin-bottom: 0.25rem; }
  .blog-card .meta { color: #6b7280; font-size: 0.875rem; }
  .success-icon { font-size: 2rem; margin-bottom: 1rem; }
  h2 { margin-bottom: 0.5rem; }
  .subtitle { color: #6b7280; margin-bottom: 1.5rem; }
</style></head>
<body><div id="app">
  <div id="loading">
    <div class="spinner"></div>
    <h2>Authenticating...</h2>
    <p class="subtitle">Please wait while we verify your account.</p>
  </div>
</div>
<script>
(async function() {
  var app = document.getElementById('app');
  while (true) {
    try {
      var res = await fetch('/auth/blogs');
      var data = await res.json();

      if (data.status === 'pending') {
        await new Promise(function(r) { setTimeout(r, 500); });
        continue;
      }

      if (data.status === 'auto_selected') {
        app.innerHTML =
          '<div class="success-icon">\u2705</div>' +
          '<h2>Login successful!</h2>' +
          '<p class="subtitle">Active blog: <strong>' + data.blog.subdomain + '</strong></p>' +
          '<p style="color:#9ca3af;margin-top:1rem;font-size:0.875rem">You can close this window.</p>';
        return;
      }

      if (data.status === 'select') {
        var html = '<h2>Select a blog</h2><p class="subtitle">Choose which blog to use with the CLI.</p>';
        data.blogs.forEach(function(b) {
          html +=
            '<a class="blog-card" href="/auth/select-blog?blog_id=' + b.id +
            '&subdomain=' + encodeURIComponent(b.subdomain) +
            '&plan=' + encodeURIComponent(b.plan || '') + '">' +
            '<strong>' + b.title + '</strong>' +
            '<span class="meta">' + b.subdomain + ' &middot; ' + b.permission + (b.plan ? ' &middot; ' + b.plan : '') + '</span>' +
            '</a>';
        });
        app.innerHTML = html;
        return;
      }
    } catch(e) {
      await new Promise(function(r) { setTimeout(r, 1000); });
    }
  }
})();
</script></body></html>`;

// ── Simple callback server (for Search Console, etc.) ──

export function startCallbackServer(
  options: { port?: number; timeout?: number; callbackPath?: string } = {},
): Promise<{ code: string; port: number }> {
  const { port = 54321, timeout = 300_000, callbackPath = '/auth/callback' } = options;

  return new Promise((resolve, reject) => {
    let server: Server;
    let timer: ReturnType<typeof setTimeout>;

    const cleanup = () => {
      clearTimeout(timer);
      server.close();
    };

    server = createServer((req, res) => {
      const url = new URL(req.url || '/', `http://127.0.0.1`);
      if (url.pathname !== callbackPath) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      const errorDescription = url.searchParams.get('error_description');

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(ERROR_HTML);
        cleanup();
        reject(new Error(`OAuth error: ${errorDescription || error}`));
        return;
      }

      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(ERROR_HTML);
        cleanup();
        reject(new Error('Missing authorization code in callback'));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(SUCCESS_HTML);
      cleanup();
      resolve({ code, port: actualPort });
    });

    let actualPort = port;

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        server.listen(0, '127.0.0.1');
      } else {
        reject(err);
      }
    });

    server.on('listening', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        actualPort = addr.port;
      }
    });

    server.listen(port, '127.0.0.1');

    timer = setTimeout(() => {
      cleanup();
      reject(new Error('Login timed out. Please try again.'));
    }, timeout);
  });
}

// ── Auth server (OAuth + browser blog selection) ──

export async function createAuthServer(
  options: { port?: number; timeout?: number } = {},
): Promise<AuthServer> {
  const { port = 54321, timeout = 300_000 } = options;

  return new Promise((resolveServer, rejectServer) => {
    // State
    let blogState: { status: 'pending' } | { status: 'auto_selected'; blog: BlogSelection } | { status: 'select'; blogs: BlogChoice[] } = { status: 'pending' };

    // Code promise
    let resolveCode: (code: string) => void;
    let rejectCode: (err: Error) => void;
    const codePromise = new Promise<string>((res, rej) => { resolveCode = res; rejectCode = rej; });

    // Blog selection promise
    let resolveBlog: (blog: BlogSelection) => void;
    let rejectBlog: (err: Error) => void;
    const blogPromise = new Promise<BlogSelection>((res, rej) => { resolveBlog = res; rejectBlog = rej; });

    let timer: ReturnType<typeof setTimeout>;
    let actualPort = port;

    const server: Server = createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://127.0.0.1');

      // 1) OAuth callback — receives auth code from Supabase
      if (url.pathname === '/auth/callback') {
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');
        const errorDescription = url.searchParams.get('error_description');

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(ERROR_HTML);
          rejectCode(new Error(`OAuth error: ${errorDescription || error}`));
          return;
        }

        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(ERROR_HTML);
          rejectCode(new Error('Missing authorization code in callback'));
          return;
        }

        // Serve the auth page (shows spinner, then blog selection or success)
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(AUTH_PAGE_HTML);
        resolveCode(code);
        return;
      }

      // 2) Blog status — polled by the auth page JS
      if (url.pathname === '/auth/blogs') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
        res.end(JSON.stringify(blogState));
        return;
      }

      // 3) Blog selection — user clicked a blog card
      if (url.pathname === '/auth/select-blog') {
        const blogId = url.searchParams.get('blog_id');
        const subdomain = url.searchParams.get('subdomain');
        const plan = url.searchParams.get('plan') || undefined;

        if (!blogId || !subdomain) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(ERROR_HTML);
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(SUCCESS_HTML);
        resolveBlog({ id: parseInt(blogId, 10), subdomain, plan });
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        server.listen(0, '127.0.0.1');
      } else {
        rejectServer(err);
      }
    });

    server.on('listening', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        actualPort = addr.port;
      }

      timer = setTimeout(() => {
        server.close();
        const timeoutErr = new Error('Login timed out. Please try again.');
        rejectCode(timeoutErr);
        rejectBlog(timeoutErr);
      }, timeout);

      resolveServer({
        get port() { return actualPort; },

        waitForCode: () => codePromise,

        setBlogs(blogs: BlogChoice[]) {
          blogState = { status: 'select', blogs };
        },

        setAutoSelectedBlog(blog: BlogSelection) {
          blogState = { status: 'auto_selected', blog };
          resolveBlog(blog);
        },

        waitForBlogSelection: () => blogPromise,

        close() {
          clearTimeout(timer);
          server.close();
        },
      });
    });

    server.listen(port, '127.0.0.1');
  });
}
