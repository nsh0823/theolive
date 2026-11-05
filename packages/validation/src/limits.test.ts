import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  CATEGORY_NAME_MAX_LENGTH,
  MENU_DESCRIPTION_MAX_LENGTH,
  MENU_NAME_MAX_LENGTH,
  MENU_PRICE_MAX,
  STORE_ADDRESS_MAX_LENGTH,
  STORE_DESCRIPTION_MAX_LENGTH,
  STORE_NAME_MAX_LENGTH,
  STORE_PHONE_MAX_LENGTH,
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  STAFF_NAME_MAX_LENGTH,
  STAFF_NAME_MIN_LENGTH,
  LINE_MAX_QUANTITY,
  ORDER_NOTE_MAX_LENGTH,
  REJECT_REASON_MAX_LENGTH,
  ANNOUNCEMENT_TITLE_MAX_LENGTH,
  ANNOUNCEMENT_BODY_MAX_LENGTH,
} from './limits';

const MIGRATIONS_DIR = join(__dirname, '../../../supabase/migrations');
const migrationsSql = readdirSync(MIGRATIONS_DIR)
  .filter((file) => file.endsWith('.sql'))
  .map((file) => readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))
  .join('\n');

describe('limits match the SQL check constraints', () => {
  it('nickname length', () => {
    expect(migrationsSql).toContain(
      `char_length(nickname) between ${NICKNAME_MIN_LENGTH} and ${NICKNAME_MAX_LENGTH}`,
    );
  });
  it('staff display name length', () => {
    expect(migrationsSql).toContain(
      `char_length(display_name) between ${STAFF_NAME_MIN_LENGTH} and ${STAFF_NAME_MAX_LENGTH}`,
    );
  });
  it('menu item limits', () => {
    expect(migrationsSql).toContain(`char_length(name) between 1 and ${MENU_NAME_MAX_LENGTH}`);
    expect(migrationsSql).toContain(`char_length(description) <= ${MENU_DESCRIPTION_MAX_LENGTH}`);
    expect(migrationsSql).toContain(`price between 0 and ${MENU_PRICE_MAX}`);
  });
  it('category name length', () => {
    expect(migrationsSql).toContain(`char_length(name) between 1 and ${CATEGORY_NAME_MAX_LENGTH}`);
  });
  it('store info limits', () => {
    expect(migrationsSql).toContain(`char_length(name) between 1 and ${STORE_NAME_MAX_LENGTH}`);
    expect(migrationsSql).toContain(`char_length(phone) <= ${STORE_PHONE_MAX_LENGTH}`);
    expect(migrationsSql).toContain(`char_length(address) <= ${STORE_ADDRESS_MAX_LENGTH}`);
    expect(migrationsSql).toContain(`char_length(description) <= ${STORE_DESCRIPTION_MAX_LENGTH}`);
  });
  it('announcement limits', () => {
    expect(migrationsSql).toContain(
      `char_length(title) between 1 and ${ANNOUNCEMENT_TITLE_MAX_LENGTH}`,
    );
    expect(migrationsSql).toContain(
      `char_length(body) between 1 and ${ANNOUNCEMENT_BODY_MAX_LENGTH}`,
    );
  });
  it('order limits', () => {
    expect(migrationsSql).toContain(`char_length(note) <= ${ORDER_NOTE_MAX_LENGTH}`);
    expect(migrationsSql).toContain(`quantity between 1 and ${LINE_MAX_QUANTITY}`);
    expect(migrationsSql).toContain(`char_length(reject_reason) <= ${REJECT_REASON_MAX_LENGTH}`);
  });
});
