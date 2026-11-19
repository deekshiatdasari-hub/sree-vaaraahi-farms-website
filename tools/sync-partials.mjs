/**
 * Copies the shared head, header and footer into every page of the website.
 *
 * Pages stay plain HTML (good for search engines and fast to load); this script just
 * keeps the repeated parts identical. Each page marks where a part goes:
 *   <!-- partial:header --><!-- /partial:header -->
 * Run after editing anything in tools/partials/:
 *   npm run sync
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const site = join(here, '..', 'site');
const names = ['head', 'header', 'footer'];
const partials = Object.fromEntries(
  names.map((name) => [name, readFileSync(join(here, 'partials', `${name}.html`), 'utf8').trim()]),
);

function* htmlFiles(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* htmlFiles(path);
    else if (entry.endsWith('.html')) yield path;
  }
}

let changed = 0;
for (const file of htmlFiles(site)) {
  const before = readFileSync(file, 'utf8');
  let after = before;
  for (const name of names) {
    const pattern = new RegExp(`(<!-- partial:${name} -->)[\\s\\S]*?(<!-- /partial:${name} -->)`, 'g');
    after = after.replace(pattern, `$1\n${partials[name]}\n$2`);
  }
  if (after !== before) {
    writeFileSync(file, after);
    changed++;
    console.log('updated', relative(site, file));
  }
}
console.log(`${changed} page(s) updated`);
