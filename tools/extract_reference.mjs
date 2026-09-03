// Извлекает данные из референсных JS-файлов прототипа (components_db.js, nets_db.js)
// и сохраняет их как JSON для импорта в mycad-core.
// Использование: node tools/extract_reference.mjs <каталог с components_db.js/nets_db.js> <выходной каталог>

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const [srcDir, outDir] = process.argv.slice(2);
if (!srcDir || !outDir) {
  console.error('Usage: node tools/extract_reference.mjs <srcDir> <outDir>');
  process.exit(1);
}

const sandbox = { window: {}, console };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

for (const file of ['components_db.js', 'nets_db.js']) {
  const code = readFileSync(join(srcDir, file), 'utf8');
  vm.runInContext(code, sandbox, { filename: file });
}

const w = sandbox.window;
const g = sandbox;

const pick = (...names) => {
  for (const n of names) {
    if (w[n] !== undefined) return w[n];
    if (g[n] !== undefined) return g[n];
  }
  return null;
};

const out = {
  boardMeta: pick('BOARD_META'),
  footprints: pick('FOOTPRINT_LIBRARY', 'FOOTPRINT_TEMPLATES'),
  catalogTree: pick('COMPONENT_CATALOG_TREE'),
  presets: pick('COMPONENT_PRESETS'),
  components: pick('INITIAL_COMPONENTS'),
  nets: pick('BOARD_NETS'),
};

mkdirSync(outDir, { recursive: true });
for (const [name, data] of Object.entries(out)) {
  if (data === null) {
    console.warn(`warning: ${name} not found in reference files`);
    continue;
  }
  writeFileSync(join(outDir, `${name}.json`), JSON.stringify(data, null, 2));
  const count = Array.isArray(data) ? data.length : Object.keys(data).length;
  console.log(`${name}.json: ${count} entries`);
}
