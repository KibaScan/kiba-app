// Sync src/data/toxic_foods.json into the validate-recipe Edge Function directory.
// Edge Functions cannot import from outside their own folder, so we copy the
// curated source-of-truth file into the function's local directory before deploy.
//
// Run: npm run sync:toxics

import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SRC = resolve(__dirname, '..', 'src', 'data', 'toxic_foods.json');
const DEST = resolve(
  __dirname,
  '..',
  'supabase',
  'functions',
  'validate-recipe',
  'toxic_foods.json',
);

if (!existsSync(SRC)) {
  console.error(`Source not found: ${SRC}`);
  process.exit(1);
}
mkdirSync(dirname(DEST), { recursive: true });
copyFileSync(SRC, DEST);
console.log(`Synced ${SRC} -> ${DEST}`);
