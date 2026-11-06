# لۇغەت · Lughet

An open-source Uyghur starter lexicon, HTTP API, and JavaScript SDK by [UyghurCommunity](https://github.com/UyghurCommunity).

**Source release 0.1.0 · 33 original draft entries · no runtime dependencies**

لۇغەت — ئۇيغۇرچە سۆزلەرنى ئىزدەش، تەكلىپ سۆزلەرنى ئېلىش ۋە كۈنلۈك سۆزنى كۆرسىتىش ئۈچۈن ياسالغان ئوچۇق مەنبەلىك قورال. بۇ دەسلەپكى سانلىق مەلۇمات مۇستەقىل تىل تەكشۈرۈشىدىن ئۆتمىگەن؛ تۈزىتىش ۋە تەكشۈرۈپ بېرىشنى قارشى ئالىمىز.

## Public API

Verified live endpoint: **https://uyghurcommunity-lughet-api.vercel.app**

```bash
curl "https://uyghurcommunity-lughet-api.vercel.app/v1/search?q=salam"
```

The service currently serves 33 original draft entries, without authentication. The same SDK works offline using the bundled dataset.

## What is included

- Search by Uyghur word, Latin lookup hint, or English definition.
- Prefix autocomplete, individual entry lookup, and a deterministic UTC word of the day.
- Browser/Node local adapter and HTTP fetch client, with TypeScript declarations.
- Read-only Node HTTP server and stateless Vercel adapter.
- Static [playground](https://uyghurcommunity.github.io/lughet-api/) using bundled local data.
- Downloadable [JSON dataset](data/lexicon.json) and [OpenAPI 3.1 document](openapi.json).

**GitHub Pages serves the static demo, not the HTTP API.** The repository contains npm-ready package source; registry publication is a separate release step for an authorized npm scope owner.

## Run locally

Use Node.js 20 or newer. No dependency installation is required.

```bash
npm start
```

Open <http://localhost:8787>. The same process serves the playground and API:

```bash
curl 'http://localhost:8787/v1/search?q=salam'
curl 'http://localhost:8787/v1/suggest?q=sa&limit=5'
curl 'http://localhost:8787/v1/words/salam'
curl 'http://localhost:8787/v1/word-of-the-day'
curl 'http://localhost:8787/health'
```

Set `PORT` to change the port. The default host is `127.0.0.1`; use `HOST=0.0.0.0` when a container host requires it. The service keeps no user records and needs no API key or database.

For a static-only preview, run `python3 -m http.server 4173` and open <http://localhost:4173>. Static hosting supports the local SDK demo and JSON download, but not dynamic `/v1/*` routes.

## JavaScript SDK

The source package name is `@uyghurcommunity/lughet`. Before an npm registry release, install this folder with `npm install /path/to/lughet-api`, or use relative imports from the clone.

### Work offline

```js
import { createLocalLughet } from './src/index.js';
import { lexicon } from './src/dataset.js';

const dictionary = createLocalLughet(lexicon);
const result = dictionary.search('سۇ', { limit: 10 });
console.log(result.data[0].word); // سۇ
console.log(result.meta.sources);

const suggestions = dictionary.suggest('sa');
const entry = dictionary.getWord('salam');
const daily = dictionary.wordOfTheDay(new Date('2026-11-06T12:00:00Z'));
```

After installing the package, use `@uyghurcommunity/lughet` and `@uyghurcommunity/lughet/data` as import paths. The local adapter snapshots its input; returned entries and metadata are defensive copies.

### Connect to a real HTTP API

```js
import { createLughetClient } from './src/index.js';

const client = createLughetClient({ baseUrl: 'http://localhost:8787' });
const result = await client.search('book', { limit: 5 });
console.log(result.data[0].id); // kitab
```

`baseUrl` is the deployment root without `/v1`; path prefixes are supported. Pass a custom `fetch` or an `AbortSignal` if needed. `LughetError` exposes `status` and `code` for HTTP and invalid-response errors. Connection errors and aborts propagate from fetch.

## API contract

| Endpoint | Result |
| --- | --- |
| `GET /v1/search?q=...&limit=20` | Words matching a word, Latin hint, or definition; exact matches first. |
| `GET /v1/suggest?q=...&limit=8` | Prefix matches containing ID, word, and Latin hint. |
| `GET /v1/words/:id` | One full entry. |
| `GET /v1/word-of-the-day` | A stable word for the current UTC date. |
| `GET /health` | Service status, versions, and total entry count. |

Search/suggestions return `{ data: [], meta: {} }`; individual/daily words return `{ data: {}, meta: {} }`. Metadata contains dataset version, review status, entry count, and source records.

Queries are limited to 80 UTF-16 code units. `limit` is an integer from 1 to 50. Empty queries return an empty list. Unknown IDs return 404, invalid values 400, and unsupported methods 405 with an `Allow` header. Errors use `{ error: { code, message } }`.

GET routes accept HEAD. OPTIONS returns public CORS headers. Successful responses cache for up to five minutes; daily-word caching stops at the next UTC boundary. No usage quota or production SLA is provided by this source release.

`normalizeLookup()` applies NFKC, lowercasing, selected Arabic-character variant normalization, whitespace cleanup, and selected Latin diacritic folding. It changes lookup keys, never stored display text. It is not a full transliteration or spelling-correction tool.

## Dataset and provenance

`data/lexicon.json` is canonical. The starter vocabulary contains **original editorial definitions**, not copied dictionary content. Each record is marked `draft` and points to an original source record.

- Definitions are English.
- Latin fields are lookup hints, not a normative transliteration standard.
- Pronunciation audio is not provided; `audioUrl` is `null`.
- Independent native-speaker review is requested before educational use.
- Original data: [CC0-1.0](LICENSE-DATA). Code: [MIT](LICENSE).

After editing JSON, run:

```bash
npm run generate:data
npm test
```

Generated `src/dataset.js` is committed so the package works without a build. Tests verify it matches the canonical JSON.

## Deployment

### GitHub Pages

Publish `main` from the repository root. `.nojekyll` is included. The static playground imports the local SDK and downloads JSON; it works without a live API.

### Node host

Run `HOST=0.0.0.0 PORT=8787 npm start` on a host supporting persistent Node HTTP services. Expose the chosen port through the host's HTTPS endpoint.

### Vercel

`api/index.js` exports Web Request/Response handlers. `vercel.json` rewrites `/v1/*` and `/health` to the stateless function. Import this as a framework-free Node project. The function bundles its dataset and writes no runtime files. Verify `/health`, then enter your API base URL in the optional playground connection panel.

The public deployment above uses this adapter. A fork still needs its own deployment; its GitHub Pages demo continues to work offline.

## Validation and release

```bash
npm test
npm pack --dry-run --ignore-scripts
```

Tests include the actual Node server on an ephemeral loopback port, which requires permission to bind a local port. Other checks cover Unicode lookup, limits, defensive copies, dates, HTTP/CORS behavior, and the fetch client.

An authorized npm scope owner can inspect `npm pack`, then use `npm publish --access public`. `prepack` regenerates data and runs tests. Package contents are explicitly restricted to source, canonical data, documentation, and licenses.

## Contributing

Open an issue or pull request with the entry ID, proposed correction, and reasoning. Native-speaker review is especially useful. External sources need clear attribution and reuse permission; keep original entries distinguishable from imported collections. Keep `audioUrl: null` until an actual licensed recording is supplied.
