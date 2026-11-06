import { readFile, readdir, realpath } from 'node:fs/promises';
import { resolve, relative, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseProposal } from '../docs/proposals.js';

const root = fileURLToPath(new URL('../proposals/', import.meta.url));
const allowedRoot = await realpath(root);
const lexicon = JSON.parse(await readFile(new URL('../data/lexicon.json', import.meta.url), 'utf8'));
const options = { entryIds: lexicon.entries.map((entry) => entry.id) };
const files = [];
async function collect(path) {
  const actual = await realpath(path), inside = relative(allowedRoot, actual);
  if (inside === '..' || inside.startsWith('..' + sep) || resolve(actual) === sep) throw new Error('Proposal paths must stay inside proposals/');
  const entries = await readdir(actual, { withFileTypes: true }).catch((error) => error.code === 'ENOTDIR' ? null : Promise.reject(error));
  if (!entries) { if (extname(actual) !== '.json') throw new Error('Proposal files must use .json'); files.push(actual); return; }
  for (const entry of entries) {
    if (entry.isSymbolicLink()) throw new Error('Proposal folders must not contain symbolic links');
    if (entry.isDirectory()) await collect(resolve(actual, entry.name));
    else if (entry.isFile() && extname(entry.name) === '.json') files.push(resolve(actual, entry.name));
  }
}
try {
  for (const path of process.argv.slice(2).length ? process.argv.slice(2) : [root]) await collect(resolve(path));
  let failures = 0;
  for (const file of [...new Set(files)].sort()) {
    try { parseProposal(await readFile(file, 'utf8'), options); console.log(`Valid pending proposal: ${relative(allowedRoot, file)}`); }
    catch (error) { failures++; console.error(`Invalid proposal ${relative(allowedRoot, file)}: ${error.message}`); }
  }
  if (failures) process.exitCode = 1;
  else console.log(`Checked ${new Set(files).size} pending proposal file(s). This check does not approve language or change the API.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
