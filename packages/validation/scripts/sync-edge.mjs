// Copies the validation modules used by Edge Functions into supabase/functions/_shared/validation.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, '../../supabase/functions/_shared/validation');
const files = ['limits.ts', 'staff.ts', 'checkout.ts', 'account.ts'];

mkdirSync(target, { recursive: true });
for (const file of files) {
  // Deno requires explicit file extensions on relative imports.
  const source = readFileSync(join(root, 'src', file), 'utf8');
  writeFileSync(join(target, file), source.replaceAll("from './limits'", "from './limits.ts'"));
}
console.log(`Synced ${files.length} files to ${target}`);
