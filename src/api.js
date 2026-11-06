import { createLocalLughet, LughetError } from './index.js';
import { lexicon } from './dataset.js';
const dictionary = createLocalLughet(lexicon);
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Accept, Content-Type',
  'X-Content-Type-Options': 'nosniff',
};
function json(payload, status = 200, extra = {}, head = false) {
  const body = JSON.stringify(payload);
  return new Response(head ? null : body, { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': status === 200 ? 'public, max-age=300' : 'no-store', ...extra } });
}
/** Pure Web Request/Response handler used by the Node server and deployment adapter. */
export function handleRequest(request, { now = new Date() } = {}) {
  const method = request.method.toUpperCase();
  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Max-Age': '86400' } });
  if (!['GET', 'HEAD'].includes(method)) return json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Use GET, HEAD, or OPTIONS.' } }, 405, { Allow: 'GET, HEAD, OPTIONS' });
  const head = method === 'HEAD';
  try {
    const url = new URL(request.url);
    const pathname = url.pathname === '/api/index' || url.pathname === '/api' ? url.searchParams.get('__route') || '/health' : url.pathname;
    const limitValue = url.searchParams.get('limit');
    const options = { limit: limitValue === null ? undefined : limitValue };
    let result;
    if (pathname === '/health') result = { status: 'ok', service: 'lughet', version: '0.1.0', datasetVersion: lexicon.metadata.version, totalEntries: lexicon.entries.length, reviewStatus: 'draft' };
    else if (pathname === '/v1/search') result = dictionary.search(url.searchParams.get('q') || '', options);
    else if (pathname === '/v1/suggest') result = dictionary.suggest(url.searchParams.get('q') || '', options);
    else if (pathname === '/v1/word-of-the-day') result = dictionary.wordOfTheDay(now);
    else if (pathname.startsWith('/v1/words/')) {
      let id;
      try { id = decodeURIComponent(pathname.slice('/v1/words/'.length)); }
      catch { throw new LughetError('Malformed word ID.', 400, 'INVALID_ID'); }
      result = dictionary.getWord(id);
    } else return json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found.' } }, 404, {}, head);
    const cache = pathname === '/v1/word-of-the-day' ? { 'Cache-Control': 'public, max-age=' + Math.max(1, Math.min(300, Math.floor((Date.parse(now.toISOString().slice(0, 10) + 'T00:00:00Z') + 86400000 - now.getTime()) / 1000))) } : {};
    return json(result, 200, cache, head);
  } catch (error) {
    if (error instanceof LughetError) return json({ error: { code: error.code, message: error.message } }, error.status, {}, head);
    console.error('Lughet request failed:', error);
    return json({ error: { code: 'INTERNAL_ERROR', message: 'The request could not be completed.' } }, 500, {}, head);
  }
}
