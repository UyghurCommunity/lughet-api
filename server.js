import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import { handleRequest } from './src/api.js';
const root = fileURLToPath(new URL('./', import.meta.url));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
export function createServer() {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      if (url.pathname.startsWith('/v1/') || url.pathname === '/health') {
        const result = handleRequest(new Request(url, { method: request.method }));
        response.writeHead(result.status, Object.fromEntries(result.headers));
        response.end(Buffer.from(await result.arrayBuffer()));
        return;
      }
      if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return; }
      let path;
      try { path = decodeURIComponent(url.pathname); } catch { response.writeHead(400); response.end('Invalid URL.'); return; }
      if (path === '/') path = '/index.html';
      const allowed = path === '/index.html' || path.startsWith('/docs/') || path === '/data/lexicon.json' || path === '/openapi.json' || path === '/src/index.js' || path === '/src/dataset.js';
      const file = resolve(root, '.' + path);
      if (!allowed || !file.startsWith(root.endsWith(sep) ? root : root + sep) || !mime[extname(file)]) { response.writeHead(404); response.end('Not found.'); return; }
      const body = await readFile(file);
      response.writeHead(200, { 'Content-Type': mime[extname(file)], 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch (error) {
      const status = error.code === 'ENOENT' || error.code === 'EISDIR' ? 404 : 500;
      if (status === 500) console.error('Lughet server error:', error);
      response.writeHead(status); response.end(status === 404 ? 'Not found.' : 'Internal error.');
    }
  });
}
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const port = Number(process.env.PORT || 8787);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be an integer from 0 to 65535.');
  const server = createServer();
  server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`Lughet: http://${process.env.HOST || '127.0.0.1'}:${server.address().port}`));
}
