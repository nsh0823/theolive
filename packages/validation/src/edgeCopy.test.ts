import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE_DIR = __dirname;
const EDGE_DIR = join(__dirname, '../../../supabase/functions/_shared/validation');
const SHARED_FILES = ['limits.ts', 'staff.ts', 'checkout.ts', 'account.ts'];

// Supabase's Edge Function bundler cannot import outside supabase/functions, so the schemas Edge Functions
// use are copied (`pnpm --filter @theolive/validation sync:edge`). This guards against the copy going stale.
describe('Edge Function copy of the validation schemas', () => {
  it.each(SHARED_FILES)('%s is identical to the source', (file) => {
    const source = readFileSync(join(SOURCE_DIR, file), 'utf8').replaceAll(
      "from './limits'",
      "from './limits.ts'",
    );
    const copy = readFileSync(join(EDGE_DIR, file), 'utf8');
    expect(copy).toBe(source);
  });
});
