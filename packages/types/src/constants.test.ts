import { describe, expect, it } from 'vitest';
import { STAFF_PERMISSION, STAFF_ROLE } from './constants';

describe('enum constants', () => {
  it('mirrors the staff enums in the database', () => {
    expect(Object.values(STAFF_ROLE).sort()).toEqual(['ADMIN', 'STAFF']);
    expect(Object.values(STAFF_PERMISSION).sort()).toEqual(['MANAGE_OPERATIONS', 'PROCESS_ORDERS']);
  });
});
