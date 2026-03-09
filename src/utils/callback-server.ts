import { createServer, type Server } from 'node:http';

const SUCCESS_HTML = `<!DOCTYPE html><html><body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0"><div style="text-align:center"><h1>Login successful!</h1><p>You can close this window and return to the terminal.</p></div></body></html>`;

const ERROR_HTML = `<!DOCTYPE html><html><body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0"><div style="text-align:center"><h1>Login failed</h1><p>Please try again.</p></div></body></html>`;

/**
 * Start a temporary HTTP server to receive the OAuth callback from Supabase.
 * Supabase handles CSRF protection via its own internal state,
 * so we only need to capture the authorization code.
 */
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
        // Fallback: let OS assign a port
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
