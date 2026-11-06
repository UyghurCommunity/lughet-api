import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { emptyProposal, proposalFromEntry, proposalFromQuery, validateProposal, assertProposal, serializeProposal, parseProposal, reviewText, createIssueURL } from '../docs/proposals.js';
import { lexicon } from '../src/dataset.js';

const entryIds = lexicon.entries.map((entry) => entry.id), options = { entryIds };
function fixture() {
  return { ...emptyProposal(), entryId: 'yengi-soz', word: 'يېڭى', latin: 'yengi', definition: 'A test fixture definition; not a community submission.', source: { kind: 'original', title: 'Automated test fixture', url: '', license: 'CC0-1.0', licenseDetails: '', credit: 'Test fixture' }, acknowledgments: { accuracy: true, rights: true, noAutoPublish: true } };
}
test('valid proposals normalize whitespace, remain pending, and round-trip as JSON', () => {
  const input = fixture(); input.word = '  يېڭى  ';
  const proposal = assertProposal(input, options);
  assert.equal(proposal.word, 'يېڭى'); assert.equal(proposal.reviewStatus, 'pending');
  assert.deepEqual(parseProposal(serializeProposal(proposal, options), options), proposal);
  proposal.source.title = 'changed'; assert.notEqual(input.source.title, proposal.source.title);
});
test('empty forms report actionable field errors; validation never claims human review', () => {
  const result = validateProposal(emptyProposal(), options);
  assert.equal(result.valid, false); assert.equal(result.proposal, null);
  for (const key of ['entryId', 'word', 'latin', 'definition', 'sourceTitle', 'sourceLicense', 'sourceCredit', 'ack-accuracy', 'ack-rights', 'ack-noAutoPublish']) assert(Object.hasOwn(result.errors, key));
  assert.throws(() => assertProposal({ ...fixture(), reviewStatus: 'reviewed' }, options), /reviewStatus/);
  assert.throws(() => assertProposal({ ...fixture(), reviewedBy: 'Imaginary reviewer' }, options), /schema/);
});
test('new IDs must be unused while corrections and audio target actual draft entries', () => {
  assert(validateProposal({ ...fixture(), entryId: 'salam' }, options).errors.entryId);
  assert(validateProposal({ ...fixture(), type: 'correction', entryId: 'not-in-dataset' }, options).errors.entryId);
  for (const entryId of ['../secret', 'A-b', 'space id', 'a'.repeat(61), '-bad']) assert(validateProposal({ ...fixture(), entryId }, options).errors.entryId);
  const correction = { ...fixture(), ...proposalFromEntry(lexicon.entries[0]), source: fixture().source, acknowledgments: fixture().acknowledgments };
  assert.equal(assertProposal(correction, options).entryId, 'salam');
  assert.equal(lexicon.entries[0].reviewStatus, 'draft'); assert.equal(lexicon.entries[0].audioUrl, null);
});
test('field bounds, control characters, schema versions, and unknown nested data reject safely', () => {
  for (const changed of [{ definition: 'x'.repeat(601) }, { word: 'latin only' }, { notes: '\u0000bad' }, { latin: 'a'.repeat(101) }, { schemaVersion: 2 }, { example: { ug: '', en: '', html: '<script>' } }]) assert.equal(validateProposal({ ...fixture(), ...changed }, options).valid, false);
  assert.throws(() => parseProposal('{"__proto__":{"polluted":true}}', options));
  assert.throws(() => parseProposal('x'.repeat(30001), options), /30,000/);
  assert.equal({}.polluted, undefined);
});
test('external provenance requires a source URL and an explicit compatible-to-review license', () => {
  const proposal = fixture(); proposal.source.kind = 'external';
  assert(validateProposal(proposal, options).errors.sourceUrl);
  for (const url of ['javascript:alert(1)', 'data:text/html,bad', 'file:///private/data', 'https://user:secret@example.com/x', 'https://example.com/\nbad']) {
    proposal.source.url = url; assert(validateProposal(proposal, options).errors.sourceUrl);
  }
  proposal.source.url = 'https://example.com/source'; proposal.source.license = 'permission';
  assert(validateProposal(proposal, options).errors.sourceLicenseDetails);
  proposal.source.licenseDetails = 'Test-only permission evidence description.';
  assert.equal(validateProposal(proposal, options).valid, true);
});
test('audio proposals require HTTPS, exact license, recording credit, and affirmative consent', () => {
  const proposal = { ...fixture(), type: 'audio', entryId: 'salam' };
  assert(validateProposal(proposal, options).errors.audioUrl);
  proposal.audio = { url: 'http://example.com/recording.ogg', license: '', credit: '', licenseDetails: '', consent: false };
  const invalid = validateProposal(proposal, options);
  for (const key of ['audioUrl', 'audioLicense', 'audioCredit', 'audioConsent']) assert(invalid.errors[key]);
  proposal.audio = { url: 'https://example.com/recording.ogg', license: 'CC-BY-4.0', credit: 'Test fixture recorder', licenseDetails: '', consent: true };
  assert.equal(assertProposal(proposal, options).audio.consent, true);
  assert.equal(lexicon.entries.find((entry) => entry.id === 'salam').audioUrl, null);
});
test('optional examples and optional audio still require truthful complete recording metadata', () => {
  const proposal = fixture(); proposal.example = { ug: 'سىناق جۈملە.', en: 'An automated test sentence.' };
  assert.equal(validateProposal(proposal, options).valid, true);
  proposal.audio = { url: 'https://example.com/a.ogg', license: 'other', credit: 'Fixture', licenseDetails: '', consent: true };
  assert(validateProposal(proposal, options).errors.audioLicenseDetails);
});
test('GitHub issue URL encodes untrusted content and fences JSON without submitting it', () => {
  const proposal = fixture(); proposal.notes = '<img src=x onerror=alert(1)> & # ? ```\n**not a review**';
  const url = new URL(createIssueURL(proposal, options));
  assert.equal(url.origin, 'https://github.com'); assert.equal(url.pathname, '/UyghurCommunity/lughet-api/issues/new');
  assert.equal(url.hash, ''); assert(url.searchParams.get('title').includes('يېڭى'));
  const body = url.searchParams.get('body'); assert(body.includes('````json')); assert(body.includes('PENDING') || body.includes('pending'));
  assert(body.includes('not human approval')); assert(url.href.includes('%3Cimg'));
  assert(reviewText(proposal, options).includes(proposal.notes));
});
test('preview renderer uses textContent and never interprets proposal content as HTML', async () => {
  const app = await readFile(new URL('../docs/contribute.js', import.meta.url), 'utf8');
  assert(app.includes("$('proposal-preview').textContent = reviewText"));
  assert(!app.includes('innerHTML')); assert(!app.includes('fetch('));
});
test('CLI validates intake files and rejects invalid pending proposals without editing live data', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const dataPath = new URL('../data/lexicon.json', import.meta.url), before = await readFile(dataPath, 'utf8');
  const directory = await mkdtemp(new URL('../proposals/.test-', import.meta.url));
  try {
    const file = `${directory}/fixture.json`; await writeFile(file, serializeProposal(fixture(), options));
    let result = spawnSync(process.execPath, ['scripts/check-proposals.mjs', file], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr); assert(result.stdout.includes('Valid pending proposal'));
    await writeFile(file, JSON.stringify({ ...fixture(), reviewStatus: 'reviewed' }));
    result = spawnSync(process.execPath, ['scripts/check-proposals.mjs', file], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 1); assert(result.stderr.includes('reviewStatus'));
    result = spawnSync(process.execPath, ['scripts/check-proposals.mjs', 'data/lexicon.json'], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 1); assert(result.stderr.includes('inside proposals/'));
  } finally { await rm(directory, { recursive: true, force: true }); }
  assert.equal(await readFile(dataPath, 'utf8'), before);
});

test('new-word search hints preserve editable text without guessing definitions or consent', () => {
  const ug = proposalFromQuery('  يېڭى سۆز  ');
  assert.equal(ug.type, 'new'); assert.equal(ug.word, 'يېڭى سۆز');
  assert.equal(ug.entryId, ''); assert.equal(ug.definition, ''); assert.equal(ug.source.license, '');
  assert.deepEqual(ug.acknowledgments, { accuracy:false, rights:false, noAutoPublish:false });
  const latin = proposalFromQuery('unknown & term');
  assert.equal(latin.latin, 'unknown & term'); assert.equal(latin.word, '');
  assert.equal(proposalFromQuery(' ؟ ١٢٣ ').word, '');
  assert.throws(() => proposalFromQuery('x'.repeat(81)), /80/);
  assert.throws(() => proposalFromQuery('bad' + String.fromCharCode(10) + 'query'), /control/);
});
test('Uyghur word field requires an Arabic-script letter, not just digits or punctuation', () => {
  for (const word of ['؟', '١٢٣', '،؛']) assert.equal(validateProposal({...fixture(),word},options).errors.word,'uyghur-required');
  assert.equal(validateProposal({...fixture(),word:'ئۆرۈك'},options).valid,true);
});
