import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createLocalLughet, createLughetClient, normalizeLookup, LughetError } from '../src/index.js';
import { lexicon } from '../src/dataset.js';
import { handleRequest } from '../src/api.js';
import { createServer } from '../server.js';
const dictionary = createLocalLughet(lexicon);
const api = (path, method = 'GET', options) => handleRequest(new Request('https://lughet.example' + path, { method }), options);

test('the generated module matches the downloadable original dataset and provenance is complete', async () => {
  const json = JSON.parse(await readFile(new URL('../data/lexicon.json', import.meta.url), 'utf8'));
  assert.deepEqual(lexicon, json);
  assert.equal(lexicon.entries.length, 33);
  assert.equal(lexicon.metadata.license, 'CC0-1.0');
  assert.equal(new Set(lexicon.entries.map((entry) => entry.id)).size, 33);
  const sources = new Set(lexicon.metadata.sources.map((source) => source.id));
  for (const entry of lexicon.entries) {
    assert.equal(entry.reviewStatus, 'draft');
    assert.equal(entry.audioUrl, null);
    assert.ok(entry.sourceIds.length > 0 && entry.sourceIds.every((id) => sources.has(id)));
    assert.ok(/[\u0600-\u06ff]/u.test(entry.word));
  }
});
test('lookup normalization supports Unicode forms and Latin hints without altering Uyghur letters', () => {
  assert.equal(normalizeLookup('  KÖL  '), 'kol');
  assert.equal(normalizeLookup('ئۆي'), 'ئۆي');
  assert.equal(normalizeLookup('سَلَام'), 'سلام');
  assert.throws(() => normalizeLookup(null), TypeError);
  assert.equal(dictionary.search('kol').data[0].word, 'كۆل');
  assert.equal(dictionary.search('سُۇ').data[0].id, 'su');
});
test('search covers Uyghur, Latin hints and English definitions with exact matches ranked first', () => {
  assert.equal(dictionary.search('سالام').data[0].id, 'salam');
  assert.equal(dictionary.search('SALAM').data[0].word, 'سالام');
  assert.equal(dictionary.search('book').data[0].id, 'kitab');
  const limited = dictionary.search('a', { limit: 2 });
  assert.equal(limited.data.length, 2);
  assert.ok(limited.meta.total > 2);
  assert.equal(limited.meta.datasetVersion, '0.1.0');
  assert.deepEqual(dictionary.search('   ').data, []);
  assert.deepEqual(dictionary.search('no-such-word').data, []);
});
test('suggestions are prefix-only and limits are validated', () => {
  assert.equal(dictionary.suggest('sa').data[0].id, 'salam');
  assert.deepEqual(dictionary.suggest('alam').data, []);
  for (const limit of [0, 51, 1.2, 'bad', null]) assert.throws(() => dictionary.search('s', { limit }), (error) => error.code === 'INVALID_LIMIT');
  assert.throws(() => dictionary.search('x'.repeat(81)), (error) => error.status === 400);
  assert.throws(() => dictionary.search(123), LughetError);
});
test('word lookups distinguish malformed and unknown IDs', () => {
  assert.equal(dictionary.getWord('doppa').data.word, 'دوپپا');
  assert.throws(() => dictionary.getWord('not-listed'), (error) => error.status === 404);
  assert.throws(() => dictionary.getWord('../data'), (error) => error.status === 400);
});
test('the local adapter snapshots input and does not expose mutable internal entries or metadata', () => {
  const input = structuredClone(lexicon), adapter = createLocalLughet(input);
  input.entries[0].word = 'changed';
  const result = adapter.getWord('salam'); result.data.word = 'changed'; result.meta.sources[0].title = 'changed';
  const metadata = adapter.metadata(); metadata.name = 'changed';
  assert.equal(adapter.getWord('salam').data.word, 'سالام');
  assert.equal(adapter.metadata().name, 'Lughet starter lexicon');
  assert.notEqual(adapter.getWord('salam').meta.sources[0].title, 'changed');
  assert.throws(() => createLocalLughet({ metadata: {}, entries: [] }), TypeError);
});
test('the local adapter rejects IDs that could not be retrieved through getWord', () => {
  for (const id of ['not valid', 'UPPERCASE', '../salam', '', 'a'.repeat(61), 12, null]) {
    const input = structuredClone(lexicon);
    input.entries[0].id = id;
    assert.throws(() => createLocalLughet(input), TypeError, `Accepted invalid ID ${JSON.stringify(id)}`);
  }
  const input = structuredClone(lexicon);
  input.entries[0].id = 'a'.repeat(60);
  const adapter = createLocalLughet(input);
  const entry = adapter.search('سالام').data[0];
  assert.equal(adapter.getWord(entry.id).data.word, 'سالام');
  input.entries[1].id = input.entries[0].id;
  assert.throws(() => createLocalLughet(input), TypeError);
});
test('word of the day is stable for a UTC date and explicitly identifies that date', () => {
  const a = dictionary.wordOfTheDay(new Date('2026-11-06T00:00:00Z'));
  const b = dictionary.wordOfTheDay(new Date('2026-11-06T23:59:59Z'));
  assert.equal(a.data.id, b.data.id);
  assert.equal(a.meta.date, '2026-11-06');
  assert.equal(a.meta.timeZone, 'UTC');
  assert.throws(() => dictionary.wordOfTheDay(new Date('invalid')), LughetError);
});
test('HTTP handler supports search, prefix suggestions, individual entries, health and UTC daily words', async () => {
  const search = api('/v1/search?q=' + encodeURIComponent('سۇ'));
  assert.equal(search.status, 200); assert.equal((await search.json()).data[0].id, 'su');
  assert.equal(search.headers.get('access-control-allow-origin'), '*');
  assert.equal((await api('/v1/suggest?q=sa').json()).data[0].id, 'salam');
  assert.equal((await api('/v1/words/salam').json()).data.id, 'salam');
  assert.equal((await api('/health').json()).totalEntries, 33);
  const daily = api('/v1/word-of-the-day', 'GET', { now: new Date('2026-11-06T23:59:59Z') });
  assert.equal(daily.headers.get('cache-control'), 'public, max-age=1');
  assert.equal((await daily.json()).meta.date, '2026-11-06');
});
test('HTTP validation, HEAD, OPTIONS and serverless rewrite paths behave consistently', async () => {
  assert.equal(api('/v1/search?q=s&limit=0').status, 400);
  assert.equal(api('/v1/search?q=' + 'a'.repeat(81)).status, 400);
  assert.equal(api('/v1/words/%E0%A4%A').status, 400);
  assert.equal(api('/v1/words/missing').status, 404);
  assert.equal(api('/missing').status, 404);
  const post = api('/v1/search?q=s', 'POST'); assert.equal(post.status, 405); assert.equal(post.headers.get('allow'), 'GET, HEAD, OPTIONS');
  const head = api('/v1/words/salam', 'HEAD'); assert.equal(head.status, 200); assert.equal(await head.text(), '');
  const options = api('/v1/search', 'OPTIONS'); assert.equal(options.status, 204); assert.equal(await options.text(), '');
  assert.equal((await api('/api/index?__route=/v1/words/salam').json()).data.id, 'salam');
});
test('the fetch SDK preserves deployment path prefixes and correctly encodes queries', async () => {
  const calls = [];
  const client = createLughetClient({ baseUrl: 'https://api.example/base/', fetch: async (url, options) => {
    calls.push({ url: new URL(url), options });
    const apiUrl = new URL(url); apiUrl.pathname = apiUrl.pathname.replace(/^\/base/, '');
    return handleRequest(new Request(apiUrl));
  } });
  await client.search('سۇ & tea', { limit: 2 });
  assert.equal(calls[0].url.pathname, '/base/v1/search');
  assert.equal(calls[0].url.searchParams.get('q'), 'سۇ & tea');
  assert.equal(calls[0].url.searchParams.get('limit'), '2');
  assert.equal(calls[0].options.headers.Accept, 'application/json');
  await client.getWord('salam'); assert.equal(calls[1].url.pathname, '/base/v1/words/salam');
  await client.wordOfTheDay(); assert.equal(calls[2].url.pathname, '/base/v1/word-of-the-day');
  const root = createLughetClient({ baseUrl: 'https://api.example/', fetch: async (url) => { assert.equal(new URL(url).pathname, '/v1/search'); return handleRequest(new Request(url)); } });
  await root.search('salam');
  assert.throws(() => createLughetClient({ baseUrl: 'file:///tmp/data' }), TypeError);
  assert.throws(() => createLughetClient({ baseUrl: 'https://name:secret@example.com' }), TypeError);
});
test('the fetch SDK exposes structured HTTP and invalid-response errors', async () => {
  const failed = createLughetClient({ baseUrl: 'https://api.example', fetch: async () => new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Word not found.' } }), { status: 404 }) });
  await assert.rejects(failed.getWord('missing'), (error) => error instanceof LughetError && error.status === 404 && error.code === 'NOT_FOUND');
  const broken = createLughetClient({ baseUrl: 'https://api.example', fetch: async () => new Response('<html>failure</html>', { status: 502 }) });
  await assert.rejects(broken.search('salam'), (error) => error.code === 'INVALID_RESPONSE');
});
test('the fetch SDK rejects successful JSON with a malformed envelope, metadata, or entry', async () => {
  const valid = dictionary.search('salam');
  const bodies = [null, [], { unexpected: 'not a Lughet response' }, { data: [], meta: {} },
    { ...valid, data: valid.data[0] },
    { ...valid, meta: { ...valid.meta, totalEntries: '33' } },
    { ...valid, meta: { ...valid.meta, sources: [null] } },
    { ...valid, data: [{ ...valid.data[0], id: 'not valid' }] },
    { ...valid, data: [{ ...valid.data[0], definition: 12 }] },
    { ...valid, data: [{ ...valid.data[0], reviewStatus: 'invented' }] },
    { ...valid, data: [{ ...valid.data[0], sourceIds: ['unknown-source'] }] },
  ];
  for (const body of bodies) {
    const client = createLughetClient({ baseUrl: 'https://api.example', fetch: async () => new Response(JSON.stringify(body), { status: 200 }) });
    await assert.rejects(client.search('salam'), (error) => error instanceof LughetError && error.status === 200 && error.code === 'INVALID_RESPONSE');
  }
});
test('the fetch SDK distinguishes suggestion lists from individual full entries', async () => {
  const validSuggestion = dictionary.suggest('sa');
  const validWord = dictionary.getWord('salam');
  const clientFor = (body) => createLughetClient({ baseUrl: 'https://api.example', fetch: async () => new Response(JSON.stringify(body)) });
  assert.deepEqual(await clientFor(validSuggestion).suggest('sa'), validSuggestion);
  assert.deepEqual(await clientFor(validWord).getWord('salam'), validWord);
  await assert.rejects(clientFor({ ...validSuggestion, data: [{ id: 'salam', word: 'سالام' }] }).suggest('sa'), (error) => error.code === 'INVALID_RESPONSE');
  await assert.rejects(clientFor(validSuggestion).getWord('salam'), (error) => error.code === 'INVALID_RESPONSE');
  await assert.rejects(clientFor(dictionary.getWord('su')).getWord('salam'), (error) => error.code === 'INVALID_RESPONSE');
  await assert.rejects(clientFor({ ...validWord, data: [] }).wordOfTheDay(), (error) => error.code === 'INVALID_RESPONSE');
});
test('the actual Node HTTP server serves the API and static playground and denies private paths', async (t) => {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  const client = createLughetClient({ baseUrl: base });
  assert.equal((await client.search('book')).data[0].id, 'kitab');
  assert.equal((await client.suggest('sa')).data[0].id, 'salam');
  const home = await fetch(base + '/'); assert.equal(home.status, 200); assert.ok((await home.text()).includes('id="playground"'));
  const data = await fetch(base + '/data/lexicon.json'); assert.equal((await data.json()).entries.length, 33);
  assert.equal((await fetch(base + '/.git/config')).status, 404);
  assert.equal((await fetch(base + '/server.js')).status, 404);
  assert.equal((await fetch(base + '/v1/search?q=s', { method: 'POST' })).status, 405);
});
