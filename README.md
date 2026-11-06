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
- A browser-local [community contribution desk](https://uyghurcommunity.github.io/lughet-api/docs/contribute.html) for preparing sourced word, correction, example, and licensed pronunciation proposals for human review.

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

## Community proposal workflow

Open [the contribution desk](https://uyghurcommunity.github.io/lughet-api/docs/contribute.html), or `docs/contribute.html` on either the local Node server or a static HTTP server. The root `contribute.html` is a GitHub Pages alias; use the canonical docs/contribute.html path on the local Node server. No backend routes, API behavior, canonical entries, generated dataset, dataset version, or package version are changed by this contribution workflow.

The Uyghur RTL page uses the existing ALKATIP Basma font and shows the current **33 draft entries**, including each entry's real review status and provenance. Search by Uyghur word, Latin hint, English definition, or ID. The reviewed-status filter currently returns no entries, because none has received independent human review. Existing recordings remain absent.

An empty search or suggestion result offers a link to prepare a missing-word proposal. The search term is carried to the canonical contribution page as an editable hint: Arabic-script letters populate the word field, and a Latin-script query populates the Latin lookup hint. Definitions, provenance, licenses, and acknowledgments stay empty and require contributor input. Blank or invalid hints do not create a proposal. Unknown entry IDs also offer this path after a genuine not-found response.

Choose **new word**, **correction/example**, or **audio**. A correction/audio button on an entry copies its existing word, Latin hint, part of speech, definition, and ID into the form; it does not assert that these fields are correct or fill in rights acknowledgments on your behalf. Add your own proposed changes, optional Uyghur/English examples, source kind/title/URL, exact license or permission explanation, and public credit. External sources require an HTTP(S) source URL. An audio contribution requires an existing HTTPS recording, explicit recording license, credit, and affirmative recorder/speaker consent; the page does not record, fetch, upload, or play audio.

Structural validation runs entirely in the browser. The text preview uses `textContent`; user input is never interpreted as HTML. Every exported proposal includes `schemaVersion: 1` and `reviewStatus: "pending"`. Unknown fields, oversized values, malformed IDs, unknown correction/audio IDs, unsafe URL protocols, credential-bearing URLs, missing license details, and unchecked acknowledgments are rejected. This is **not a determination of linguistic accuracy, legal permission, or license compatibility**.

After validation you can:

1. Download a JSON proposal and open a pull request adding it under [`proposals/`](proposals/README.md).
2. Open a prefilled GitHub Issue, inspect its contents, and press GitHub's submit button yourself. The application only prepares a URL; it never creates an issue or sends a proposal automatically. Long proposals use the JSON path rather than an oversized issue URL.
3. Use the repository's [new-word](.github/ISSUE_TEMPLATE/word-proposal.yml), [correction](.github/ISSUE_TEMPLATE/correction.yml), or [licensed-audio](.github/ISSUE_TEMPLATE/audio.yml) issue forms directly.

Keep public credits intentional and exclude private correspondence, tokens, and personal information. Browsing the contribution desk does not save drafts to local storage or a server. Drafts live only in this page and any form state your browser retains; download JSON before leaving if you need a portable copy. Opening a prepared GitHub Issue transfers its text to GitHub only when you follow that link.

### Maintainer review

Proposals are intake records, separate from the published API. A maintainer must check the proposed spelling, meaning, part of speech, examples, and any usage or regional claims with a qualified human reviewer; trace the source; establish reuse rights and attribution; and verify recording ownership and speaker/recorder consent where applicable. The original dataset is CC0-1.0; a proposal citing CC-BY, CC-BY-SA, or separate permission does **not** establish that its content may be incorporated into a CC0 release. Incompatible or unclear rights must be resolved or the material excluded.

Do not mark a proposal or entry as reviewed merely because automated checks pass. Only actual human review may justify a reviewed status. Accepting a proposal file or issue does not update entries. Any future accepted data change requires a separate reviewed canonical-data edit, regeneration, tests, and a release decision. This implementation leaves all **33 entries `draft` with `audioUrl: null`** and adds no invented contributions, recordings, or human reviews.

### Proposal checks

```sh
npm run check
npm run check:proposals
node scripts/check-proposals.mjs proposals/your-entry-id.json
npm test
```

`docs/proposals.js` is a pure validation/serialization module shared by the form and CLI. The CLI validates JSON files inside `proposals/`, checks current entry IDs for corrections/audio, and rejects statuses other than `pending`; it never changes the live dataset. The directory initially contains only its README, so a successful check reports zero proposal files. Tests cover schema/field bounds, source protocols, recording consent/license requirements, safe issue URL encoding/fences, pending status, preview text handling, and CLI success/failure while preserving canonical data. CI runs syntax, proposal validation, the complete existing API/SDK test suite, and the package dry run using official actions pinned to commit SHAs.

## Typography

Uyghur demo text and dynamic word entries use the externally linked **ALKATIP Basma** font, with WOFF2, WOFF, and TTF fallbacks and `font-display: swap`. English and code keep explicit system and monospace font stacks. The `.alkatip-basma` helper provides RTL direction, bidi embedding, and line-height 2.2. No font binary is bundled; system fallbacks remain available if the external host cannot be reached.

## Website motion controls

The documentation hero contains an original **Word Garden**: a dimensional book, turning paper, drifting Uyghur word cards, and flowing SVG connections. The five visible words come from the starter vocabulary; the connections are illustrative, not linguistic claims. Searches highlight matching sample IDs without changing your query or response text. Select a word card to pin its highlight, or move a mouse over the scene for a small perspective shift.

The visible **Pause motion / Play motion** control stops the hero and entrance effects. Reduced-motion preferences show a still composition from the first paint. CSS animations default to paused until their controller initializes, and stop while the page is hidden or the hero is offscreen. Pointer work uses only event-driven animation frames, with no continuous JavaScript loop. The API and SDK do not depend on these website effects.
