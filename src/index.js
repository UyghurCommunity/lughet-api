/** Normalize only a lookup key. Original words and definitions are never changed. */
export function normalizeLookup(value) {
  if (typeof value !== 'string') throw new TypeError('Expected a string.');
  return value.normalize('NFKC').toLowerCase()
    .replace(/[ک]/g, 'ك').replace(/[ی]/g, 'ي')
    .replace(/[\u064b-\u065f\u0670]/g, '')
    .replace(/[öüëé]/g, (letter) => ({ ö: 'o', ü: 'u', ë: 'e', é: 'e' })[letter])
    .replace(/\s+/gu, ' ').trim();
}

export class LughetError extends Error {
  constructor(message, status = 0, code = 'REQUEST_FAILED') {
    super(message); this.name = 'LughetError'; this.status = status; this.code = code;
  }
}
const copy = (value) => JSON.parse(JSON.stringify(value));
const wordIdPattern = /^[a-z0-9-]{1,60}$/;
const isWordId = (value) => typeof value === 'string' && wordIdPattern.test(value);
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function validSource(source) {
  return isRecord(source) && ['id', 'title', 'url', 'license', 'kind', 'attribution'].every((key) => typeof source[key] === 'string');
}
function validMeta(meta) {
  return isRecord(meta) && typeof meta.datasetVersion === 'string' && typeof meta.reviewStatus === 'string'
    && Number.isInteger(meta.totalEntries) && meta.totalEntries >= 0
    && Array.isArray(meta.sources) && meta.sources.every(validSource)
    && (meta.query === undefined || typeof meta.query === 'string')
    && (meta.total === undefined || (Number.isInteger(meta.total) && meta.total >= 0))
    && (meta.limit === undefined || (Number.isInteger(meta.limit) && meta.limit >= 1 && meta.limit <= 50))
    && (meta.date === undefined || typeof meta.date === 'string')
    && (meta.timeZone === undefined || typeof meta.timeZone === 'string');
}
function validSuggestion(entry) {
  return isRecord(entry) && isWordId(entry.id) && typeof entry.word === 'string' && entry.word.length > 0 && typeof entry.latin === 'string';
}
function validEntry(entry, sources) {
  return validSuggestion(entry) && typeof entry.partOfSpeech === 'string' && typeof entry.definition === 'string'
    && (entry.audioUrl === null || typeof entry.audioUrl === 'string')
    && ['draft', 'reviewed'].includes(entry.reviewStatus)
    && Array.isArray(entry.sourceIds) && entry.sourceIds.every((id) => typeof id === 'string' && sources.has(id));
}
function validResponse(body, path) {
  if (!isRecord(body) || !validMeta(body.meta)) return false;
  const sources = new Set(body.meta.sources.map((source) => source.id));
  if (path === 'search') return Array.isArray(body.data) && body.data.every((entry) => validEntry(entry, sources));
  if (path === 'suggest') return Array.isArray(body.data) && body.data.every(validSuggestion);
  if (!validEntry(body.data, sources)) return false;
  return !path.startsWith('words/') || body.data.id === path.slice('words/'.length);
}
function boundedLimit(limit, fallback) {
  if (limit === undefined) return fallback;
  const number = Number(limit);
  if (!Number.isInteger(number) || number < 1 || number > 50) throw new LughetError('limit must be an integer from 1 to 50.', 400, 'INVALID_LIMIT');
  return number;
}
function queryKey(query) {
  if (typeof query !== 'string' || query.length > 80) throw new LughetError('q must be a string of at most 80 characters.', 400, 'INVALID_QUERY');
  return normalizeLookup(query);
}
function utcDay(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) throw new LughetError('Invalid date.', 400, 'INVALID_DATE');
  return value.toISOString().slice(0, 10);
}
/** A browser- and Node-compatible adapter. Every returned object is a defensive copy. */
export function createLocalLughet(dataset) {
  if (!dataset?.metadata || !Array.isArray(dataset.entries) || !dataset.entries.length) throw new TypeError('A non-empty Lughet dataset is required.');
  const snapshot = copy(dataset);
  const ids = new Set();
  for (const entry of snapshot.entries) {
    if (!isRecord(entry) || !isWordId(entry.id) || typeof entry.word !== 'string' || !entry.word || typeof entry.definition !== 'string' || ids.has(entry.id)) throw new TypeError('Entries require unique IDs matching [a-z0-9-]{1,60}, words, and definitions.');
    ids.add(entry.id);
  }
  const entries = snapshot.entries.map((entry) => ({ entry, key: normalizeLookup(entry.word), latin: normalizeLookup(entry.latin || ''), definition: normalizeLookup(entry.definition) }));
  const meta = () => ({ datasetVersion: snapshot.metadata.version, reviewStatus: snapshot.metadata.reviewStatus, totalEntries: entries.length, sources: copy(snapshot.metadata.sources) });
  return {
    metadata: () => copy(snapshot.metadata),
    search(query, options = {}) {
      const key = queryKey(query), limit = boundedLimit(options.limit, 20);
      if (!key) return { data: [], meta: { ...meta(), query, total: 0, limit } };
      const found = entries.filter((row) => row.key.includes(key) || row.latin.includes(key) || row.definition.includes(key));
      found.sort((a, b) => {
        const rank = (row) => row.key === key || row.latin === key ? 0 : row.key.startsWith(key) || row.latin.startsWith(key) ? 1 : 2;
        return rank(a) - rank(b) || a.entry.id.localeCompare(b.entry.id, 'en');
      });
      return { data: copy(found.slice(0, limit).map((row) => row.entry)), meta: { ...meta(), query, total: found.length, limit } };
    },
    suggest(query, options = {}) {
      const key = queryKey(query), limit = boundedLimit(options.limit, 8);
      const found = key ? entries.filter((row) => row.key.startsWith(key) || row.latin.startsWith(key)) : [];
      return { data: copy(found.slice(0, limit).map(({ entry }) => ({ id: entry.id, word: entry.word, latin: entry.latin }))), meta: { ...meta(), query, total: found.length, limit } };
    },
    getWord(id) {
      if (!isWordId(id)) throw new LughetError('Invalid word ID.', 400, 'INVALID_ID');
      const entry = entries.find((row) => row.entry.id === id)?.entry;
      if (!entry) throw new LughetError('Word not found.', 404, 'NOT_FOUND');
      return { data: copy(entry), meta: meta() };
    },
    wordOfTheDay(date = new Date()) {
      const day = utcDay(date);
      let hash = 0;
      for (const char of day) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
      return { data: copy(entries[hash % entries.length].entry), meta: { ...meta(), date: day, timeZone: 'UTC' } };
    },
  };
}

/** Use this only with an actual HTTP API deployment, not the GitHub Pages demo URL. */
export function createLughetClient({ baseUrl, fetch: fetchImplementation = globalThis.fetch, signal } = {}) {
  if (typeof baseUrl !== 'string') throw new TypeError('baseUrl is required.');
  const base = new URL(baseUrl);
  if (!['http:', 'https:'].includes(base.protocol)) throw new TypeError('An HTTP(S) base URL is required.');
  if (base.username || base.password) throw new TypeError('Credentials in baseUrl are not supported.');
  if (typeof fetchImplementation !== 'function') throw new TypeError('A fetch implementation is required.');
  const prefix = base.pathname.replace(/\/+$/, '');
  base.search = ''; base.hash = '';
  async function request(path, params = {}) {
    const url = new URL(base.href);
    url.pathname = prefix + '/v1/' + path;
    for (const [key, value] of Object.entries(params)) if (value !== undefined) url.searchParams.set(key, String(value));
    const response = await fetchImplementation(url, { headers: { Accept: 'application/json' }, signal });
    let body;
    try { body = await response.json(); } catch { throw new LughetError('The API did not return JSON.', response.status, 'INVALID_RESPONSE'); }
    if (!response.ok) throw new LughetError(body?.error?.message || 'Request failed.', response.status, body?.error?.code || 'REQUEST_FAILED');
    if (!validResponse(body, path)) throw new LughetError('The API returned an invalid Lughet response.', response.status, 'INVALID_RESPONSE');
    return body;
  }
  return {
    search(query, options = {}) { queryKey(query); boundedLimit(options.limit, 20); return request('search', { q: query, limit: options.limit }); },
    suggest(query, options = {}) { queryKey(query); boundedLimit(options.limit, 8); return request('suggest', { q: query, limit: options.limit }); },
    getWord(id) { if (!isWordId(id)) throw new LughetError('Invalid word ID.', 400, 'INVALID_ID'); return request('words/' + encodeURIComponent(id)); },
    wordOfTheDay() { return request('word-of-the-day'); },
  };
}
