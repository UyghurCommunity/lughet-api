import { readFile, writeFile } from 'node:fs/promises';
const base = new URL('../', import.meta.url);
const dataset = JSON.parse(await readFile(new URL('data/lexicon.json', base), 'utf8'));
await writeFile(new URL('src/dataset.js', base), '// Generated from data/lexicon.json. Run npm run generate:data after editing.\nexport const lexicon = ' + JSON.stringify(dataset, null, 2) + ';\n');
