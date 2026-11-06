# Pending community proposals

This directory is an intake area, separate from `data/lexicon.json` and `src/dataset.js`. It intentionally starts with **no proposal JSON files**. No contributions, human reviews, or recordings are invented for the demo.

Prepare a proposal at [the contribution page](https://uyghurcommunity.github.io/lughet-api/docs/contribute.html), download its JSON, and open a pull request adding a file such as `proposals/your-entry-id.json`. Alternatively, use a GitHub Issue template. Contributors submit their own issues; the website never posts an issue or uploads a proposal automatically.

Validate locally:

```sh
npm run check:proposals
node scripts/check-proposals.mjs proposals/your-entry-id.json
```

Every intake file must use schema version 1 and `reviewStatus: "pending"`. The checker validates shape, bounded fields, known IDs for corrections/audio, source licensing fields, HTTP(S) source URLs, HTTPS audio URLs, recording credit and consent, and contributor acknowledgments. A passing check establishes structural validity only.

Maintainers must separately verify linguistic accuracy with a qualified human reviewer, trace source provenance, determine license compatibility with the intended release, and verify recording ownership and speaker consent. The current original data license is CC0-1.0; proposing a differently licensed source does not establish compatibility or permission to relicense it.

Accepting a proposal file or issue does not publish data. Any future approved entry change requires a separate reviewed change to canonical data, generation of the SDK module, tests, and a release decision. Only actual human review may justify a reviewed status. The existing **33 entries remain `draft` and have no audio**.

Keep personal or private information out of public proposals. Audio URLs identify existing recordings; no recording or file upload is performed by this workflow.
