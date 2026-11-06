import { lexicon } from '../src/dataset.js';
import { normalizeLookup } from '../src/index.js';
import { emptyProposal, proposalFromEntry, proposalFromQuery, validateProposal, serializeProposal, reviewText, createIssueURL } from './proposals.js';

const $ = (id) => document.getElementById(id);
const form = $('proposal-form');
const entryIds = lexicon.entries.map((entry) => entry.id);
const options = { entryIds };
const sources = new Map(lexicon.metadata.sources.map((source) => [source.id, source]));
let prepared = null, noticeTimer;
const labels = { type: 'تەكلىپ تۈرى', entryId: 'سۆز كىملىكى', word: 'ئۇيغۇرچە سۆز', latin: 'لاتىنچە ئىزدەش يىپ ئۇچى', partOfSpeech: 'سۆز تۈركۈمى', definition: 'ئىنگلىزچە ئىزاھ', exampleUg: 'ئۇيغۇرچە مىسال', exampleEn: 'ئىنگلىزچە مىسال', sourceKind: 'مەنبە تۈرى', sourceTitle: 'مەنبە نامى', sourceUrl: 'مەنبە ئۇلانمىسى', sourceLicense: 'مەنبە ئىجازەتنامىسى', sourceLicenseDetails: 'مەنبە رۇخسىتىنىڭ تەپسىلاتى', sourceCredit: 'مەنبە ئاپتورى', audioUrl: 'ئاۋاز ئۇلانمىسى', audioLicense: 'ئاۋاز ئىجازەتنامىسى', audioCredit: 'ئاۋاز ئىگىسى', audioConsent: 'ئاۋاز رۇخسىتى', audioLicenseDetails: 'ئاۋاز رۇخسىتىنىڭ تەپسىلاتى', notes: 'قوشۇمچە ئىزاھ', 'ack-accuracy': 'مەزمۇن توغرىلىقىغا دائىر جەزملەشتۈرۈش', 'ack-rights': 'ھوقۇققا دائىر جەزملەشتۈرۈش', 'ack-noAutoPublish': 'ئىنسان تەكشۈرۈشىگە دائىر جەزملەشتۈرۈش' };
const errorMessages = { required: 'بۇ بۆلەكنى تولدۇرۇڭ.', 'invalid-text': 'ئاخىرقى ئۇزۇنلۇق چېكى ۋە تېكىستنى تەكشۈرۈڭ.', 'invalid-url': 'توغرا تور ئۇلانمىسى كىرگۈزۈڭ؛ ئاۋاز پەقەت HTTPS بولىدۇ.', 'invalid-id': 'كىچىك لاتىن ھەرپى بىلەن باشلىنىدىغان 1–60 ھەرپ، سان ياكى سىزىقچە ئىشلىتىڭ.', 'uyghur-required': 'ئۇيغۇرچە سۆز كىرگۈزۈڭ.', 'invalid-choice': 'تىزىملىكتىن بىرنى تاللاڭ.', 'already-exists': 'بۇ كىملىك بار؛ تۈزىتىش تۈرىنى تاللاڭ ياكى يېڭى كىملىك بېرىڭ.', 'entry-not-found': 'تۈزىتىش ياكى ئاۋاز ئۈچۈن مەۋجۇت سۆزنى تاللاڭ.', 'license-required': 'ئېنىق ئىجازەتنامىنى تاللاڭ.', 'consent-required': 'خاتىرىلىگۈچى ۋە سۆزلىگۈچىنىڭ رۇخسىتىنى جەزملەشتۈرۈڭ.', 'audio-required': 'مەۋجۇت ئىجازەتلىك ئاۋازنىڭ HTTPS ئۇلانمىسىنى تەمىنلەڭ.', 'acknowledgment-required': 'داۋاملاشتۇرۇشتىن بۇرۇن جەزملەشتۈرۈڭ.' };
function element(tag, className = '', text = '') { const node = document.createElement(tag); node.className = className; node.textContent = text; return node; }
function notify(text) { $('contribution-notice').textContent = text; $('contribution-notice').classList.add('visible'); clearTimeout(noticeTimer); noticeTimer = setTimeout(() => $('contribution-notice').classList.remove('visible'), 3200); }
function invalidate() {
  prepared = null; $('download-proposal').disabled = true; $('open-issue').removeAttribute('href'); $('open-issue').setAttribute('aria-disabled', 'true');
  $('preview-state').textContent = 'تەكلىپنى قايتا تەكشۈرۈڭ'; $('proposal-preview').textContent = 'جەدۋەلنى تولدۇرۇپ، تەكلىپ شەكلىنى تەكشۈرۈڭ.';
}
function updateContext() {
  const entry = lexicon.entries.find((item) => item.id === $('entryId').value.trim());
  const visible = $('type').value !== 'new' && entry;
  $('entry-context').hidden = !visible;
  $('entry-context').textContent = visible ? `مەۋجۇت سۆز: ${entry.word} (${entry.id}) · ھازىرقى ھالەت: draft. بۇ جەدۋەل ئەسلى سۆزنى ئۆزگەرتمەيدۇ.` : '';
  if ($('type').value === 'audio') $('audio-section').open = true;
}
function readForm() {
  const value = (key) => $(key).value;
  const proposal = emptyProposal(value('type'));
  for (const key of ['entryId', 'word', 'latin', 'partOfSpeech', 'definition', 'notes']) proposal[key] = value(key);
  proposal.example = { ug: value('exampleUg'), en: value('exampleEn') };
  proposal.source = { kind: value('sourceKind'), title: value('sourceTitle'), url: value('sourceUrl'), license: value('sourceLicense'), licenseDetails: value('sourceLicenseDetails'), credit: value('sourceCredit') };
  if (value('type') === 'audio' || ['audioUrl', 'audioLicense', 'audioCredit', 'audioLicenseDetails'].some((key) => value(key).trim()) || $('audioConsent').checked) {
    proposal.audio = { url: value('audioUrl'), license: value('audioLicense'), credit: value('audioCredit'), licenseDetails: value('audioLicenseDetails'), consent: $('audioConsent').checked };
  }
  proposal.acknowledgments = { accuracy: $('ack-accuracy').checked, rights: $('ack-rights').checked, noAutoPublish: $('ack-noAutoPublish').checked };
  return proposal;
}
function fillForm(proposal) {
  form.reset();
  for (const key of ['type', 'entryId', 'word', 'latin', 'partOfSpeech', 'definition', 'notes']) $(key).value = proposal[key];
  $('exampleUg').value = proposal.example.ug; $('exampleEn').value = proposal.example.en;
  for (const [field, key] of Object.entries({ sourceKind: 'kind', sourceTitle: 'title', sourceUrl: 'url', sourceLicense: 'license', sourceLicenseDetails: 'licenseDetails', sourceCredit: 'credit' })) $(field).value = proposal.source[key];
  $('audio-section').open = proposal.type === 'audio';
  clearErrors(); invalidate(); updateContext();
}
function clearErrors() { $('form-errors').hidden = true; $('form-errors').replaceChildren(); form.querySelectorAll('[aria-invalid]').forEach((field) => field.removeAttribute('aria-invalid')); }
function showErrors(errors) {
  const container = $('form-errors'); container.replaceChildren(element('p', '', 'تۆۋەندىكى بۆلەكلەرنى تەكشۈرۈڭ:'));
  const list = element('ul');
  for (const [key, code] of Object.entries(errors)) {
    const field = $(key), text = `${labels[key] || 'تەكلىپ قۇرۇلمىسى'}: ${errorMessages[code] || 'بۇ بۆلەك ئىناۋەتسىز.'}`;
    const item = element('li');
    if (field) { const link = element('a', '', text); link.href = `#${key}`; link.addEventListener('click', () => { field.closest('details')?.setAttribute('open', ''); field.focus(); }); item.appendChild(link); field.setAttribute('aria-invalid', 'true'); }
    else item.textContent = text;
    list.appendChild(item);
  }
  container.appendChild(list); container.hidden = false; container.focus();
}
form.addEventListener('input', () => { invalidate(); updateContext(); });
form.addEventListener('change', () => { invalidate(); updateContext(); });
form.addEventListener('submit', (event) => {
  event.preventDefault(); clearErrors();
  const result = validateProposal(readForm(), options);
  if (!result.valid) { invalidate(); showErrors(result.errors); return; }
  prepared = result.proposal;
  $('proposal-preview').textContent = reviewText(prepared, options);
  $('preview-state').textContent = 'شەكىل توغرا · ئىنسان تەكشۈرۈشىنى كۈتىدۇ';
  $('download-proposal').disabled = false;
  const url = createIssueURL(prepared, options);
  if (url.length <= 18000) {
    $('open-issue').href = url; $('open-issue').setAttribute('aria-disabled', 'false');
    $('issue-hint').textContent = 'GitHub بېتىدە مەزمۇننى كۆرۈپ، يوللاش كۇنۇپكىسىنى ئۆزىڭىز باسىسىز. بۇ بەت ھېچنېمە يوللىمايدۇ.';
  } else {
    $('open-issue').removeAttribute('href'); $('open-issue').setAttribute('aria-disabled', 'true');
    $('issue-hint').textContent = 'تەكلىپ ئۇزۇن بولغاچقا ئۇلانمىغا سىغمايدۇ. JSON نى چۈشۈرۈپ، GitHub تەكلىپ قېلىپىغا ئۆزىڭىز قوشۇڭ.';
  }
  notify('شەكىل تەكشۈرۈلدى. بۇ تىل ياكى ھوقۇق تەستىقى ئەمەس.');
});
$('reset-proposal').addEventListener('click', () => { fillForm(emptyProposal()); notify('جەدۋەل تازىلاندى. ھېچقانداق تەكلىپ يوللانمىدى.'); });
$('download-proposal').addEventListener('click', () => {
  if (!prepared) return;
  const blob = new Blob([serializeProposal(prepared, options)], { type: 'application/json;charset=utf-8' }), url = URL.createObjectURL(blob);
  const link = element('a'); link.href = url; link.download = `lughet-proposal-${prepared.entryId}.json`; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
  notify('تەكلىپ ھۆججىتى چۈشۈرۈلدى. API ئۆزگەرمىدى.');
});
function propose(entry, type) {
  fillForm(proposalFromEntry(entry, type));
  $('proposal-form').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  $('word').focus({ preventScroll: true });
  notify('سۆز ئۇچۇرلىرى كىرگۈزۈلدى؛ تەكلىپىڭىزنىڭ مەنبە ۋە ئىجازىتىنى تولدۇرۇڭ.');
}
function renderEntries() {
  const query = normalizeLookup($('entry-search').value), filter = $('review-filter').value;
  const entries = lexicon.entries.filter((entry) => (filter === 'all' || entry.reviewStatus === filter) && (!query || normalizeLookup([entry.word, entry.latin, entry.definition, entry.id].join(' ')).includes(query)));
  $('browse-count').textContent = `${entries.length} / ${lexicon.entries.length} سۆز`;
  const list = $('entry-list'); list.replaceChildren();
  if (!entries.length) { list.appendChild(element('p', 'empty-contributions', filter === 'reviewed' ? 'ھازىر ئىنسان تەكشۈرگەن سۆز يوق. ھەممىسى دەسلەپكى ھالەتتە.' : 'ماس كېلىدىغان سۆز تېپىلمىدى.')); return; }
  for (const entry of entries) {
    const article = element('article', 'browse-entry'), top = element('div', 'browse-entry-top');
    top.append(element('h3', '', entry.word), element('span', 'draft', entry.reviewStatus.toUpperCase()));
    const latin = element('bdi', 'browse-latin', `${entry.latin} · ${entry.id}`); latin.dir = 'ltr';
    const definition = element('p', 'definition', entry.definition); definition.dir = 'ltr'; definition.lang = 'en';
    const grammar = element('p', 'grammar', entry.partOfSpeech); grammar.dir = 'ltr';
    const details = element('details'); details.appendChild(element('summary', '', 'مەنبە ۋە تەكشۈرۈش ئۇچۇرى'));
    details.appendChild(element('p', '', `ھالەت: ${entry.reviewStatus} · ئاۋاز: تەمىنلەنمىگەن`));
    for (const id of entry.sourceIds) {
      const source = sources.get(id); if (!source) continue;
      const sourceLine = element('p'); sourceLine.appendChild(element('span', '', `${source.title} · ${source.license} · ${source.attribution}`));
      try { const url = new URL(source.url); if (['https:', 'http:'].includes(url.protocol)) { const link = element('a', '', 'مەنبە ↗'); link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; sourceLine.append(' ', link); } } catch { /* Unknown source URLs remain plain text. */ }
      details.appendChild(sourceLine);
    }
    const actions = element('div', 'browse-entry-actions');
    for (const [type, text] of [['correction', 'تۈزىتىش تەكلىپى'], ['audio', 'ئاۋاز تەكلىپى']]) { const button = element('button', '', text); button.type = 'button'; button.addEventListener('click', () => propose(entry, type)); actions.appendChild(button); }
    article.append(top, latin, definition, grammar, details, actions); list.appendChild(article);
  }
}
$('entry-search').addEventListener('input', renderEntries); $('review-filter').addEventListener('change', renderEntries);
const params = new URLSearchParams(location.search), selected = lexicon.entries.find((entry) => entry.id === params.get('entry'));
if (selected) fillForm(proposalFromEntry(selected, params.get('type') === 'audio' ? 'audio' : 'correction'));
else if (params.has('q')) {
  try {
    fillForm(proposalFromQuery(params.get('q')));
    notify('ئىزدەش سۆزىڭىز يىپ ئۇچى سۈپىتىدە كىرگۈزۈلدى؛ سۆز، ئىزاھ، مەنبە ۋە ھوقۇق ئۇچۇرىنى ئۆزىڭىز تەكشۈرۈپ تولدۇرۇڭ.');
  } catch { notify('ئىزدەش يىپ ئۇچىنى كىرگۈزگىلى بولمىدى؛ جەدۋەلنى قولدا تولدۇرۇڭ.'); }
}
renderEntries();
