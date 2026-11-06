import { createLocalLughet, createLughetClient } from '../src/index.js';
const $ = (id) => document.getElementById(id);
let local, adapter, responseBody, noticeTimer, debounce, sequence = 0;
const node = (tag, text, className) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; };
function announce(message) { $('notice').textContent = message; $('notice').classList.add('visible'); clearTimeout(noticeTimer); noticeTimer = setTimeout(() => $('notice').classList.remove('visible'), 2500); }
async function copy(value) {
  try { await navigator.clipboard.writeText(value); announce('Copied.'); }
  catch { const field = node('textarea'); field.value = value; field.style.cssText = 'position:fixed;opacity:0'; document.body.append(field); field.select(); const ok = document.execCommand('copy'); field.remove(); announce(ok ? 'Copied.' : 'Select the text and copy it manually.'); }
}
function renderEntries(data) {
  $('results').replaceChildren();
  if (!data.length) { $('results').append(node('p', 'No matching words in this small starter dataset. Try another term or contribute an entry.', 'empty')); return; }
  for (const entry of data) {
    const article = node('article', undefined, 'entry');
    const top = node('div', undefined, 'entry-top');
    const wordRow = node('div'); const word = node('bdi', entry.word, 'entry-word alkatip-basma'); word.lang = 'ug'; word.dir = 'rtl'; wordRow.append(word, node('span', entry.latin, 'entry-latin')); top.append(wordRow);
    const controls = node('div'); if (entry.reviewStatus) controls.append(node('span', entry.reviewStatus, 'draft'));
    const copyButton = node('button', '⧉', 'entry-copy'); copyButton.type = 'button'; copyButton.setAttribute('aria-label', 'Copy ' + entry.word); copyButton.addEventListener('click', () => copy(entry.word)); controls.append(copyButton); top.append(controls); article.append(top);
    if (entry.partOfSpeech) article.append(node('p', entry.partOfSpeech + ' · ' + entry.id, 'entry-grammar'));
    if (entry.definition) article.append(node('p', entry.definition));
    if (entry.sourceIds) { const details = node('details'); details.append(node('summary', 'Source & review status')); details.append(node('p', `Source: ${entry.sourceIds.join(', ')}. Status: ${entry.reviewStatus}. Audio: ${entry.audioUrl ? 'URL provided' : 'not supplied'}.`)); article.append(details); }
    $('results').append(article);
  }
}
function updateQueryLanguage() {
  const isUyghur = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff]/u.test($('query').value);
  $('query').lang = isUyghur ? 'ug' : 'en';
}
async function run() {
  updateQueryLanguage();
  if (!adapter) return;
  const current = ++sequence;
  const operation = $('operation').value, query = $('query').value;
  const path = operation === 'search' ? '/v1/search?q=' + encodeURIComponent(query) : operation === 'suggest' ? '/v1/suggest?q=' + encodeURIComponent(query) : operation === 'word' ? '/v1/words/' + encodeURIComponent(query) : '/v1/word-of-the-day';
  $('request-path').textContent = path;
  $('error').hidden = true; $('search-button').disabled = true;
  try {
    const result = await (operation === 'search' ? adapter.search(query, { limit: 12 }) : operation === 'suggest' ? adapter.suggest(query, { limit: 8 }) : operation === 'word' ? adapter.getWord(query) : adapter.wordOfTheDay());
    if (current !== sequence) return;
    responseBody = result; $('response-json').textContent = JSON.stringify(result, null, 2);
    const rows = Array.isArray(result.data) ? result.data : [result.data];
    $('result-count').textContent = operation === 'daily' ? result.meta.date + ' UTC' : rows.length + (result.meta.total > rows.length ? ' of ' + result.meta.total : '') + ' result' + (rows.length === 1 ? '' : 's');
    renderEntries(rows);
  } catch (error) {
    if (current !== sequence) return;
    responseBody = { error: { code: error.code || 'REQUEST_FAILED', message: error.message } };
    $('response-json').textContent = JSON.stringify(responseBody, null, 2); $('error').textContent = error.message; $('error').hidden = false; $('result-count').textContent = 'Request failed'; $('results').replaceChildren();
  } finally { if (current === sequence) $('search-button').disabled = false; }
}
function operationChanged() {
  const operation = $('operation').value;
  $('query').disabled = operation === 'daily';
  $('query-label').textContent = operation === 'word' ? 'Entry ID, for example salam' : operation === 'suggest' ? 'A Uyghur or Latin prefix' : 'Word, Latin hint, or English meaning';
  $('search-button').textContent = operation === 'daily' ? 'Show word ↗' : operation === 'word' ? 'Look up ↗' : 'Search ↗';
  $('result-title').textContent = operation === 'daily' ? 'Word of the day' : operation === 'suggest' ? 'Suggestions' : operation === 'word' ? 'Dictionary entry' : 'Search results';
  run();
}
$('query-form').addEventListener('submit', (event) => { event.preventDefault(); clearTimeout(debounce); run(); });
$('query').addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(run, 170); });
$('operation').addEventListener('change', operationChanged);
document.querySelectorAll('[data-example]').forEach((button) => button.addEventListener('click', () => { $('operation').value = 'search'; $('query').value = button.dataset.example; operationChanged(); }));
$('copy-response').addEventListener('click', () => { if (responseBody) copy(JSON.stringify(responseBody, null, 2)); });
$('remote-form').addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    const url = new URL($('api-base').value);
    if (location.protocol === 'https:' && url.protocol === 'http:') throw new Error('Use an HTTPS API when the playground is served over HTTPS.');
    adapter = createLughetClient({ baseUrl: url.href }); $('connection-status').textContent = 'HTTP · ' + url.host; run();
  } catch (error) { $('error').textContent = error.message; $('error').hidden = false; }
});
$('use-local').addEventListener('click', () => { if (!local) return; adapter = local; $('connection-status').textContent = 'Bundled dataset · local SDK'; run(); });
async function initialize() {
  try {
    const result = await fetch(new URL('../data/lexicon.json', import.meta.url));
    if (!result.ok) throw new Error('The bundled dataset could not be loaded.');
    const dataset = await result.json(); local = createLocalLughet(dataset); adapter = local;
    $('entry-count').textContent = dataset.entries.length; $('connection-status').textContent = 'Bundled dataset · local SDK'; run();
  } catch (error) { $('error').textContent = error.message + ' Serve this folder over HTTP rather than opening the HTML file directly.'; $('error').hidden = false; $('connection-status').textContent = 'Dataset unavailable'; $('results').replaceChildren(node('p', 'Dataset unavailable.', 'empty')); }
}
initialize();
