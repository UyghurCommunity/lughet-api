// Pure proposal validation. This workflow never edits the published lexicon.
export const PROPOSAL_TYPES = ['new', 'correction', 'audio'];
export const PARTS_OF_SPEECH = ['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'numeral', 'interjection', 'conjunction', 'preposition', 'phrase', 'other'];
export const LICENSES = ['CC0-1.0', 'CC-BY-4.0', 'CC-BY-SA-4.0', 'permission', 'other'];
const KEYS = ['schemaVersion', 'type', 'entryId', 'word', 'latin', 'partOfSpeech', 'definition', 'example', 'source', 'audio', 'notes', 'acknowledgments', 'reviewStatus'];
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const clone = (value) => JSON.parse(JSON.stringify(value));
const hasArabicLetter = (value) => [...value].some((character) => /\p{Script=Arabic}/u.test(character) && /\p{Letter}/u.test(character));
export function emptyProposal(type = 'new') {
  return { schemaVersion: 1, type, entryId: '', word: '', latin: '', partOfSpeech: 'noun', definition: '', example: { ug: '', en: '' }, source: { kind: 'original', title: '', url: '', license: '', licenseDetails: '', credit: '' }, audio: null, notes: '', acknowledgments: { accuracy: false, rights: false, noAutoPublish: false }, reviewStatus: 'pending' };
}
export function proposalFromEntry(entry, type = 'correction') {
  if (!record(entry)) throw new TypeError('An entry is required');
  return { ...emptyProposal(type), entryId: entry.id, word: entry.word, latin: entry.latin, partOfSpeech: entry.partOfSpeech, definition: entry.definition };
}
/** A search term is only an editable hint, never a definition or a rights assertion. */
export function proposalFromQuery(query) {
  if (typeof query !== 'string' || query.length > 80 || /[\u0000-\u001f\u007f]/u.test(query)) throw new TypeError('Search hints must be at most 80 characters without control characters');
  const proposal = emptyProposal();
  const text = query.trim();
  if (hasArabicLetter(text)) proposal.word = text;
  else if (/\p{Script=Latin}/u.test(text)) proposal.latin = text;
  return proposal;
}
export function validateProposal(input, { entryIds } = {}) {
  const errors = {};
  function shape(value, keys, key) {
    if (!record(value) || Object.keys(value).some((name) => !keys.includes(name))) { errors[key] = 'unsupported-object'; return false; }
    return true;
  }
  function text(value, max, key, required = false) {
    if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) { errors[key] = 'invalid-text'; return ''; }
    const clean = value.trim(); if (required && !clean) errors[key] = 'required'; return clean;
  }
  function url(value, key, httpsOnly = false, required = false) {
    const raw = text(value ?? '', 1500, key, required); if (!raw) return '';
    try {
      const parsed = new URL(raw);
      if (!(httpsOnly ? ['https:'] : ['https:', 'http:']).includes(parsed.protocol) || parsed.username || parsed.password || /[\r\n\t]/u.test(raw)) throw new Error('Invalid URL');
      return parsed.href;
    } catch { errors[key] = 'invalid-url'; return ''; }
  }
  if (!shape(input, KEYS, 'schema')) return { valid: false, errors, proposal: null };
  if (input.schemaVersion !== 1) errors.schemaVersion = 'unsupported-version';
  if (!PROPOSAL_TYPES.includes(input.type)) errors.type = 'invalid-choice';
  if (input.reviewStatus !== 'pending') errors.reviewStatus = 'must-be-pending';
  const output = { schemaVersion: 1, type: input.type, entryId: text(input.entryId, 60, 'entryId', true), word: text(input.word, 80, 'word', true), latin: text(input.latin, 100, 'latin', true), partOfSpeech: input.partOfSpeech, definition: text(input.definition, 600, 'definition', true), example: { ug: '', en: '' }, source: {}, audio: null, notes: text(input.notes, 1200, 'notes'), acknowledgments: {}, reviewStatus: 'pending' };
  if (!/^[a-z][a-z0-9-]{0,59}$/u.test(output.entryId)) errors.entryId = 'invalid-id';
  if (!hasArabicLetter(output.word)) errors.word = 'uyghur-required';
  if (!PARTS_OF_SPEECH.includes(input.partOfSpeech)) errors.partOfSpeech = 'invalid-choice';
  if (entryIds) {
    const known = new Set(entryIds);
    if (input.type === 'new' && known.has(output.entryId)) errors.entryId = 'already-exists';
    if (['correction', 'audio'].includes(input.type) && !known.has(output.entryId)) errors.entryId = 'entry-not-found';
  }
  if (shape(input.example, ['ug', 'en'], 'example')) output.example = { ug: text(input.example.ug, 400, 'exampleUg'), en: text(input.example.en, 400, 'exampleEn') };
  if (shape(input.source, ['kind', 'title', 'url', 'license', 'licenseDetails', 'credit'], 'source')) {
    const source = input.source;
    if (!['original', 'external'].includes(source.kind)) errors.sourceKind = 'invalid-choice';
    if (!LICENSES.includes(source.license)) errors.sourceLicense = 'license-required';
    output.source = { kind: source.kind, title: text(source.title, 180, 'sourceTitle', true), url: url(source.url, 'sourceUrl', false, source.kind === 'external'), license: source.license, licenseDetails: text(source.licenseDetails, 300, 'sourceLicenseDetails', ['permission', 'other'].includes(source.license)), credit: text(source.credit, 160, 'sourceCredit', true) };
  }
  if (input.audio !== null) {
    if (shape(input.audio, ['url', 'license', 'credit', 'consent', 'licenseDetails'], 'audio')) {
      if (!LICENSES.includes(input.audio.license)) errors.audioLicense = 'license-required';
      if (input.audio.consent !== true) errors.audioConsent = 'consent-required';
      output.audio = { url: url(input.audio.url, 'audioUrl', true, true), license: input.audio.license, credit: text(input.audio.credit, 160, 'audioCredit', true), licenseDetails: text(input.audio.licenseDetails, 300, 'audioLicenseDetails', ['permission', 'other'].includes(input.audio.license)), consent: input.audio.consent === true };
    }
  }
  if (input.type === 'audio' && !output.audio?.url) errors.audioUrl = 'audio-required';
  if (shape(input.acknowledgments, ['accuracy', 'rights', 'noAutoPublish'], 'acknowledgments')) {
    for (const key of ['accuracy', 'rights', 'noAutoPublish']) {
      if (input.acknowledgments[key] !== true) errors[`ack-${key}`] = 'acknowledgment-required';
      output.acknowledgments[key] = input.acknowledgments[key] === true;
    }
  }
  return { valid: Object.keys(errors).length === 0, errors, proposal: Object.keys(errors).length ? null : clone(output) };
}
export function assertProposal(input, options) {
  const result = validateProposal(input, options);
  if (!result.valid) throw new TypeError(`Invalid proposal: ${Object.keys(result.errors).join(', ')}`);
  return result.proposal;
}
export function serializeProposal(input, options) { return JSON.stringify(assertProposal(input, options), null, 2) + '\n'; }
export function parseProposal(json, options) {
  if (typeof json !== 'string' || json.length > 30000) throw new TypeError('Proposal JSON must be at most 30,000 characters');
  return assertProposal(JSON.parse(json), options);
}
export function reviewText(input, options) {
  const proposal = assertProposal(input, options);
  return [`PENDING HUMAN REVIEW · ${proposal.type}`, `${proposal.word} / ${proposal.latin}`, `Entry: ${proposal.entryId}`, `Part of speech: ${proposal.partOfSpeech}`, '', proposal.definition, '', `Example (ug): ${proposal.example.ug || '—'}`, `Example (en): ${proposal.example.en || '—'}`, '', `Source: ${proposal.source.title}`, `Source URL: ${proposal.source.url || 'Original contribution; no external URL'}`, `Source license: ${proposal.source.license}${proposal.source.licenseDetails ? ' / ' + proposal.source.licenseDetails : ''}`, `Source credit: ${proposal.source.credit}`, '', proposal.audio ? `Audio URL: ${proposal.audio.url}\nAudio license: ${proposal.audio.license}${proposal.audio.licenseDetails ? ' / ' + proposal.audio.licenseDetails : ''}\nRecording credit: ${proposal.audio.credit}\nRecording consent acknowledged: yes` : 'Audio: not supplied', '', `Notes: ${proposal.notes || '—'}`, '', 'This proposal does not change the API. A maintainer must review language, provenance, rights, and recording consent before considering publication.'].join('\n');
}
export function createIssueURL(input, options) {
  const proposal = assertProposal(input, options);
  const json = JSON.stringify(proposal, null, 2);
  const longestFence = Math.max(0, ...(json.match(/`+/gu) || []).map((value) => value.length));
  const fence = '`'.repeat(Math.max(3, longestFence + 1));
  const body = `## Pending community proposal\n\nThis proposal has not been linguistically reviewed and does not update the API. Please verify provenance, reuse rights, and any recording consent.\n\n${fence}json\n${json}\n${fence}\n\nThe contributor opens and submits this issue personally. Automated validation is not human approval.`;
  const url = new URL('https://github.com/UyghurCommunity/lughet-api/issues/new');
  url.searchParams.set('title', `[${proposal.type}] ${proposal.word} (${proposal.entryId})`);
  url.searchParams.set('body', body);
  return url.href;
}
