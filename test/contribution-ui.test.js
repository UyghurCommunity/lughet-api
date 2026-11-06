import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { lexicon } from '../src/dataset.js';
import { createLocalLughet, createLughetClient, normalizeLookup } from '../src/index.js';
import * as proposals from '../docs/proposals.js';
import { createServer } from '../server.js';
class Node {
  constructor(tag='div') { this.tag=tag;this.children=[];this.events={};this.attributes={};this.dataset={};this.style={};this._text='';this.value='';this.checked=false;this.hidden=false;this.disabled=false;this.classList={add(){},remove(){}}; }
  set textContent(value) { this._text=String(value);this.children=[]; }
  get textContent() { return this._text + this.children.map((child) => typeof child === 'string' ? child : child.textContent).join(''); }
  append(...children) { this.children.push(...children); }
  appendChild(child) { this.children.push(child); return child; }
  replaceChildren(...children) { this.children=children;this._text=''; }
  setAttribute(name,value) { this.attributes[name]=String(value); }
  removeAttribute(name) { delete this.attributes[name]; }
  addEventListener(name,handler) { (this.events[name] ||= []).push(handler); }
  emit(name) { for (const handler of this.events[name] || []) handler({target:this,preventDefault(){}}); }
  focus() {}
  scrollIntoView() {}
  reset() {}
  querySelectorAll() { return []; }
}
function nodesFromHTML(html) {
  const nodes=new Map();
  for (const match of html.matchAll(/<([a-z][a-z0-9-]*)\b([^>]*)>/gi)) {
    const attrs=Object.fromEntries([...match[2].matchAll(/([\w-]+)="([^"]*)"/g)].map((item) => [item[1],item[2]]));
    if (attrs.id) { const node=new Node(match[1]); node.value=attrs.value || ''; nodes.set(attrs.id,node); }
  }
  return nodes;
}
const tick=() => new Promise((resolve) => setImmediate(resolve));
async function playground() {
  const nodes=nodesFromHTML(await readFile(new URL('../index.html',import.meta.url),'utf8'));
  nodes.get('operation').value='search';
  const source=(await readFile(new URL('../docs/app.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/gm,'').replaceAll('import.meta.url',"'https://uyghurcommunity.github.io/lughet-api/docs/app.js'");
  const context={document:{getElementById:(id) => nodes.get(id),createElement:(tag) => new Node(tag),querySelectorAll:() => []},createLocalLughet,createLughetClient,createWordGarden:() => ({updateMatches(){}}),URL,location:{protocol:'https:'},setTimeout:() => 1,clearTimeout(){},fetch:async () => ({ok:true,json:async () => lexicon})};
  vm.runInNewContext(source,context);
  await tick();await tick();
  return nodes;
}
function descendants(node) { return node.children.flatMap((child) => typeof child === 'string' ? [] : [child,...descendants(child)]); }
test('actual missing-word search renders an encoded canonical proposal link; blank query does not',async () => {
  const nodes=await playground();
  nodes.get('query').value='يېڭى & سۆز <script>';
  nodes.get('query-form').emit('submit');await tick();
  const link=descendants(nodes.get('results')).find((node) => node.tag === 'a');
  assert.ok(link);
  const url=new URL(link.href);
  assert.equal(url.pathname,'/lughet-api/docs/contribute.html');
  assert.equal(url.searchParams.get('q'),'يېڭى & سۆز <script>');
  assert.equal(url.hash,'');
  nodes.get('query').value='';nodes.get('query-form').emit('submit');await tick();
  assert.equal(descendants(nodes.get('results')).some((node) => node.tag === 'a'),false);
});
test('unknown entry IDs offer a proposal only after the real local adapter returns not-found',async () => {
  const nodes=await playground();
  nodes.get('operation').value='word';nodes.get('query').value='unknown-entry';
  nodes.get('query-form').emit('submit');await tick();
  assert.equal(nodes.get('error').hidden,false);
  const link=descendants(nodes.get('results')).find((node) => node.tag === 'a');
  assert.equal(new URL(link.href).searchParams.get('q'),'unknown-entry');
});
test('canonical contribution page actually prefills search hints with rights and exports still unapproved',async () => {
  const html=await readFile(new URL('../docs/contribute.html',import.meta.url),'utf8');
  const nodes=nodesFromHTML(html);
  nodes.get('review-filter').value='all';
  const source=(await readFile(new URL('../docs/contribute.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/gm,'');
  const document={getElementById:(id) => nodes.get(id),createElement:(tag) => new Node(tag)};
  vm.runInNewContext(source,{document,lexicon,normalizeLookup,...proposals,URL,URLSearchParams,location:{search:'?q=' + encodeURIComponent('يېڭى سۆز')},setTimeout:() => 1,clearTimeout(){}});
  assert.equal(nodes.get('type').value,'new');
  assert.equal(nodes.get('word').value,'يېڭى سۆز');
  assert.equal(nodes.get('definition').value,'');
  assert.equal(nodes.get('sourceLicense').value,'');
  assert.equal(nodes.get('ack-rights').checked,false);
  assert.equal(nodes.get('download-proposal').disabled,true);
  assert.equal(nodes.get('open-issue').attributes['aria-disabled'],'true');
  assert.equal(nodes.get('entry-list').children.length,33);
});

test('canonical contribution page and its independent assets are served by the existing Node routes',async (t) => {
  const server=createServer();
  await new Promise((resolve,reject) => {server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base='http://127.0.0.1:' + server.address().port;
  for (const [path,type] of [['/docs/contribute.html','text/html'],['/docs/contribute.js','text/javascript'],['/docs/proposals.js','text/javascript'],['/docs/contribute.css','text/css'],['/src/dataset.js','text/javascript']]) {
    const response=await fetch(base + path);assert.equal(response.status,200,path);assert.ok(response.headers.get('content-type').startsWith(type));await response.text();
  }
  const dataset=await (await fetch(base + '/data/lexicon.json')).json();
  assert.equal(dataset.entries.length,33);
  assert.ok(dataset.entries.every((entry) => entry.reviewStatus === 'draft' && entry.audioUrl === null));
});
