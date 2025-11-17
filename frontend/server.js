/**
 * Custom Next.js Server with WebSocket Proxy
 *
 * Handles:
 * - Regular Next.js requests (SSR, static files, API routes)
 * - WebSocket upgrades for /api/ws/* (proxied to backend)
 */

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { WebSocketServer } = require('ws');
const WebSocket = require('ws');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

// Backend URL from environment or default
const backendUrl = process.env.BACKEND_URL || 'http://backend:5167';
const backendWsUrl = backendUrl.replace('http://', 'ws://').replace('https://', 'wss://');

console.log('[Server] Starting Next.js server with WebSocket proxy...');
console.log('[Server] Backend URL:', backendUrl);
console.log('[Server] Backend WebSocket URL:', backendWsUrl);

// Initialize Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('[Server] Error handling request:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  // Handle WebSocket upgrades
  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url);

    console.log('[WebSocket] Upgrade request:', pathname);

    // Only proxy WebSocket requests to /api/ws/*
    if (pathname && pathname.startsWith('/api/ws')) {
      proxyWebSocket(req, socket, head, pathname);
    } else {
      console.log('[WebSocket] Rejecting non-API WebSocket upgrade:', pathname);
      socket.destroy();
    }
  });

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`[Server] Ready on http://${hostname}:${port}`);
    console.log(`[Server] WebSocket proxy ready for /api/ws/*`);
  });
});

/**
 * Proxy WebSocket connection to backend
 */
function proxyWebSocket(req, clientSocket, head, pathname) {
  // Remove /api prefix for backend
  const backendPath = pathname.replace('/api', '');
  const backendWsUrlWithPath = `${backendWsUrl}${backendPath}`;

  console.log(`[WebSocket] Proxying ${pathname} -> ${backendWsUrlWithPath}`);

  // Create WebSocket connection to backend
  const backendWs = new WebSocket(backendWsUrlWithPath, {
    headers: {
      // Forward relevant headers
      'user-agent': req.headers['user-agent'],
      'origin': req.headers['origin'],
    },
  });

  // Handle backend connection open
  backendWs.on('open', () => {
    console.log('[WebSocket] Connected to backend:', backendWsUrlWithPath);

    // Upgrade client socket to WebSocket
    const wss = new WebSocketServer({ noServer: true });
    wss.handleUpgrade(req, clientSocket, head, (clientWs) => {
      console.log('[WebSocket] Client connected');

      // Forward messages: client -> backend
      clientWs.on('message', (data) => {
        console.log('[WebSocket] Client -> Backend:', data.toString().substring(0, 100));
        if (backendWs.readyState === WebSocket.OPEN) {
          backendWs.send(data);
        }
      });

      // Forward messages: backend -> client
      backendWs.on('message', (data) => {
        console.log('[WebSocket] Backend -> Client:', data.toString().substring(0, 100));
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(data);
        }
      });

      // Handle client disconnect
      clientWs.on('close', (code, reason) => {
        console.log('[WebSocket] Client disconnected:', code, reason.toString());
        backendWs.close();
      });

      // Handle backend disconnect
      backendWs.on('close', (code, reason) => {
        console.log('[WebSocket] Backend disconnected:', code, reason.toString());
        clientWs.close();
      });

      // Handle errors
      clientWs.on('error', (err) => {
        console.error('[WebSocket] Client error:', err.message);
        backendWs.close();
      });

      backendWs.on('error', (err) => {
        console.error('[WebSocket] Backend error:', err.message);
        clientWs.close();
      });
    });
  });

  // Handle backend connection errors
  backendWs.on('error', (err) => {
    console.error('[WebSocket] Failed to connect to backend:', err.message);
    clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
    clientSocket.destroy();
  });
}
