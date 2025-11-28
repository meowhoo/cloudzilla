import http from 'http';
import { URL } from 'url';
import { shell } from 'electron';

export class AuthController {
  private server: http.Server | undefined;

  /**
   * Starts a local server to listen for the OAuth callback, opens the user's browser,
   * and returns the authorization code.
   * @param authUrl The URL to open in the user's browser.
   * @param port The port to listen on for the callback.
   * @returns A promise that resolves with the authorization code.
   */
  public getAuthCode(authUrl: string, port: number = 53682): Promise<string> {
    // Port 53682 is rclone's default port, using it helps with consistency
    return new Promise((resolve, reject) => {
      let authCodeReceived = false;

      this.server = http.createServer((req, res) => {
        const url = new URL(req.url || '', `http://localhost:${port}`);
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (url.pathname === '/favicon.ico') {
          res.writeHead(204);
          res.end();
          return;
        }

        if (error) {
             res.writeHead(400, { 'Content-Type': 'text/html' });
             res.end(`<h1>Authentication Failed</h1><p>${error}</p>`);
             if (!authCodeReceived) {
                 authCodeReceived = true; // Prevent multiple calls
                 reject(new Error(`OAuth error: ${error}`));
                 this.gracefulShutdown();
             }
             return;
        }

        if ((url.pathname === '/callback' || url.pathname === '/') && code) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h1>Authentication successful!</h1><p>You can close this window now.</p><script>window.close()</script>');

          if (!authCodeReceived) {
            authCodeReceived = true;
            resolve(code);
            this.gracefulShutdown();
          }
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h1>Please wait...</h1><p>Authentication is being processed.</p>');
        }
      });

      this.server.on('error', (err) => {
        reject(new Error(`Server error: ${err.message}`));
      });

      this.server.listen(port, async () => {
        try {
          console.log(`[AuthController] Listening on http://localhost:${port}`);
          await shell.openExternal(authUrl);
        } catch (error) {
          this.stopServer();
          const message = error instanceof Error ? error.message : String(error);
          reject(new Error(`Failed to open browser: ${message}`));
        }
      });
    });
  }

  private gracefulShutdown() {
      setTimeout(() => {
          this.stopServer();
      }, 2000);
  }

  private stopServer() {
    if (this.server) {
        this.server.close();
        this.server = undefined;
    }
  }
}
