import { describe, expect, it } from 'vitest';
import { STAFF_PERMISSION, STAFF_ROLE } from '@theolive/types';

import {
  MENU_PRICE_MAX,
  businessHoursSchema,
  menuItemInputSchema,
  storeInfoSchema,
  NICKNAME_MAX_LENGTH,
  nicknameSchema,
  signInSchema,
  staffInviteSchema,
  staffPermissionSchema,
  staffRoleSchema,
  staffUpdateSchema,
} from './index';

describe('nicknameSchema', () => {
  it('trims and accepts 1-20 characters', () => {
    expect(nicknameSchema.parse('  올리  ')).toBe('올리');
    expect(nicknameSchema.safeParse('가'.repeat(NICKNAME_MAX_LENGTH)).success).toBe(true);
  });
  it('rejects empty and too long', () => {
    expect(nicknameSchema.safeParse('   ').success).toBe(false);
    expect(nicknameSchema.safeParse('가'.repeat(NICKNAME_MAX_LENGTH + 1)).success).toBe(false);
  });
});

describe('signInSchema', () => {
  it('accepts a valid email and password', () => {
    expect(signInSchema.safeParse({ email: ' a@b.co ', password: 'secret1' }).success).toBe(true);
  });
  it('rejects a bad email or short password', () => {
    expect(signInSchema.safeParse({ email: 'nope', password: 'secret1' }).success).toBe(false);
    expect(signInSchema.safeParse({ email: 'a@b.co', password: '123' }).success).toBe(false);
  });
});

describe('staff schemas', () => {
  const valid = {
    email: 'new@example.com',
    displayName: '신입',
    role: 'STAFF',
    permissions: ['PROCESS_ORDERS'],
  };
  it('accepts a valid invite', () => {
    expect(staffInviteSchema.safeParse(valid).success).toBe(true);
  });
  it('rejects empty, duplicate and unknown permissions', () => {
    expect(staffInviteSchema.safeParse({ ...valid, permissions: [] }).success).toBe(false);
    expect(
      staffInviteSchema.safeParse({ ...valid, permissions: ['PROCESS_ORDERS', 'PROCESS_ORDERS'] })
        .success,
    ).toBe(false);
    expect(staffInviteSchema.safeParse({ ...valid, permissions: ['SUPER'] }).success).toBe(false);
  });
  it('rejects an unknown role and a long name', () => {
    expect(staffInviteSchema.safeParse({ ...valid, role: 'OWNER' }).success).toBe(false);
    expect(staffInviteSchema.safeParse({ ...valid, displayName: '가'.repeat(21) }).success).toBe(
      false,
    );
  });
  it('requires a uuid for updates', () => {
    const update = {
      userId: 'x',
      displayName: '이름',
      role: 'STAFF',
      permissions: ['PROCESS_ORDERS'],
      isActive: true,
    };
    expect(staffUpdateSchema.safeParse(update).success).toBe(false);
    expect(
      staffUpdateSchema.safeParse({ ...update, userId: '00000000-0000-4000-8000-0000000000b1' })
        .success,
    ).toBe(true);
  });
  it('matches the database enums', () => {
    expect([...staffRoleSchema.options].sort()).toEqual(Object.values(STAFF_ROLE).sort());
    expect([...staffPermissionSchema.options].sort()).toEqual(
      Object.values(STAFF_PERMISSION).sort(),
    );
  });
});

describe('menuItemInputSchema', () => {
  const valid = {
    name: ' 플랫 화이트 ',
    description: '',
    price: 5300,
    categoryId: '00000000-0000-4000-8000-000000000101',
    temperatures: ['HOT'],
    isActive: true,
    imagePath: null,
  };
  it('trims and accepts a valid item, including an empty temperature set (OQ-16)', () => {
    expect(menuItemInputSchema.parse(valid).name).toBe('플랫 화이트');
    expect(menuItemInputSchema.safeParse({ ...valid, temperatures: [] }).success).toBe(true);
  });
  it('rejects bad names, prices, temperatures and categories', () => {
    expect(menuItemInputSchema.safeParse({ ...valid, name: '  ' }).success).toBe(false);
    expect(menuItemInputSchema.safeParse({ ...valid, price: 0 }).success).toBe(false);
    expect(menuItemInputSchema.safeParse({ ...valid, price: MENU_PRICE_MAX + 1 }).success).toBe(
      false,
    );
    expect(menuItemInputSchema.safeParse({ ...valid, price: 10.5 }).success).toBe(false);
    expect(menuItemInputSchema.safeParse({ ...valid, price: Number.NaN }).success).toBe(false);
    expect(menuItemInputSchema.safeParse({ ...valid, temperatures: ['HOT', 'HOT'] }).success).toBe(
      false,
    );
    expect(menuItemInputSchema.safeParse({ ...valid, temperatures: ['WARM'] }).success).toBe(false);
    expect(menuItemInputSchema.safeParse({ ...valid, categoryId: 'coffee' }).success).toBe(false);
  });
});

describe('storeInfoSchema and businessHoursSchema', () => {
  const week = Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    isClosed: false,
    opensAt: '08:00',
    closesAt: '21:00',
  }));
  it('requires a store name', () => {
    expect(
      storeInfoSchema.safeParse({ name: ' ', phone: '', address: '', description: '' }).success,
    ).toBe(false);
    expect(
      storeInfoSchema.parse({ name: ' 올리브 ', phone: '', address: '', description: '' }).name,
    ).toBe('올리브');
  });
  it('accepts a full week and rejects close-before-open unless the day is closed', () => {
    expect(businessHoursSchema.safeParse(week).success).toBe(true);
    const bad = week.map((day) => (day.weekday === 2 ? { ...day, closesAt: '07:00' } : day));
    expect(businessHoursSchema.safeParse(bad).success).toBe(false);
    const closed = bad.map((day) => (day.weekday === 2 ? { ...day, isClosed: true } : day));
    expect(businessHoursSchema.safeParse(closed).success).toBe(true);
  });
  it('rejects a missing or duplicated weekday and malformed times', () => {
    expect(businessHoursSchema.safeParse(week.slice(0, 6)).success).toBe(false);
    expect(businessHoursSchema.safeParse(week.map((day) => ({ ...day, weekday: 0 }))).success).toBe(
      false,
    );
    expect(
      businessHoursSchema.safeParse(week.map((day) => ({ ...day, opensAt: '8:00' }))).success,
    ).toBe(false);
  });
});
