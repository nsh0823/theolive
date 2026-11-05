import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { STAFF_ORDER_EDGES, type StaffOrderAction } from '@theolive/types';

const FUNCTIONS_SQL = readFileSync(
  join(__dirname, '../../../supabase/migrations/20261105000009_order_and_payment_functions.sql'),
  'utf8',
);

// The SQL case expressions are the source of truth; this fails if the TS display table drifts from them.
describe('staff order edges match staff_transition_order in SQL', () => {
  const actions = Object.keys(STAFF_ORDER_EDGES) as StaffOrderAction[];

  it.each(actions)('%s', (action) => {
    const { from, to } = STAFF_ORDER_EDGES[action];
    expect(FUNCTIONS_SQL).toMatch(new RegExp(`when '${action}' then '${from}'`));
    expect(FUNCTIONS_SQL).toMatch(new RegExp(`when '${action}' then '${to}'`));
  });
});
