import type { TypedSupabaseClient } from '@theolive/api';

type Row = Record<string, unknown>;
type Result = { data: unknown; error: unknown };

/** Ids of the seeded menu, shared with tests. */
export const FAKE_IDS = {
  coffee: '00000000-0000-4000-8000-000000000101',
  latte: '00000000-0000-4000-8000-000000000102',
  nonCoffee: '00000000-0000-4000-8000-000000000103',
  tea: '00000000-0000-4000-8000-000000000104',
  dessert: '00000000-0000-4000-8000-000000000105',
  americano: '00000000-0000-4000-8000-000000000201',
  vanillaLatte: '00000000-0000-4000-8000-000000000204',
} as const;

/** Ids of the seeded orders, shared with tests. */
export const FAKE_ORDER_IDS = {
  newOrder: 'order-a41',
  secondNew: 'order-a40',
  accepted: 'order-a39',
  completed: 'order-a30',
  rejected: 'order-a20',
} as const;

const TIMESTAMP = '2026-11-05T00:00:00Z';

type FakeLine = [name: string, temperature: string | null, quantity: number, unitPrice: number];

function order(
  id: string,
  orderNumber: string,
  status: string,
  paymentStatus: string,
  minutesAgo: number,
  lines: FakeLine[],
  extra: Row = {},
): Row {
  const paidAt = new Date(Date.now() - minutesAgo * 60_000).toISOString();
  const menuAmount = lines.reduce((sum, [, , quantity, price]) => sum + quantity * price, 0);
  return {
    id,
    order_number: orderNumber,
    created_at: paidAt,
    paid_at: paidAt,
    expires_at: paidAt,
    status,
    payment_status: paymentStatus,
    payment_method: 'CARD',
    order_type: 'TAKEOUT',
    note: null,
    menu_amount: menuAmount,
    coupon_discount: 0,
    coupon_title_snapshot: null,
    points_used: 0,
    paid_amount: menuAmount,
    customer_id: 'customer-1',
    reject_reason_code: null,
    reject_reason: null,
    cancel_reason: null,
    business_date: paidAt.slice(0, 10),
    order_items: lines.map(([name, temperature, quantity, unit_price], index) => ({
      id: `${id}-${index}`,
      order_id: id,
      menu_item_id: `item-${index}`,
      name_snapshot: name,
      temperature,
      quantity,
      unit_price,
      sort_order: index,
    })),
    ...extra,
  };
}

function seedOrders(): Row[] {
  return [
    order(
      FAKE_ORDER_IDS.newOrder,
      'A-41',
      'PAID',
      'PAID',
      1,
      [
        ['아메리카노', 'ICE', 2, 4500],
        ['플레인 스콘', 'HOT', 1, 3800],
      ],
      { note: '얼음 적게 부탁드려요' },
    ),
    order(FAKE_ORDER_IDS.secondNew, 'A-40', 'PAID', 'PAID', 3, [['카페 라떼', 'HOT', 1, 5000]]),
    order(FAKE_ORDER_IDS.accepted, 'A-39', 'ACCEPTED', 'PAID', 6, [['콜드브루', 'ICE', 1, 5000]]),
    order(FAKE_ORDER_IDS.completed, 'A-30', 'COMPLETED', 'PAID', 120, [
      ['아메리카노', 'HOT', 1, 4500],
    ]),
    order(
      FAKE_ORDER_IDS.rejected,
      'A-20',
      'REJECTED',
      'REFUNDED',
      180,
      [['카푸치노', 'HOT', 1, 5000]],
      {
        reject_reason_code: 'SOLD_OUT',
      },
    ),
  ];
}

function category(id: string, name: string, sort_order: number): Row {
  return { id, name, sort_order, is_active: true, created_at: TIMESTAMP, updated_at: TIMESTAMP };
}

function item(
  id: string,
  category_id: string,
  name: string,
  price: number,
  temperatures: string[],
  sort_order: number,
  is_sold_out = false,
): Row {
  return {
    id,
    category_id,
    name,
    description: `${name} 설명`,
    price,
    temperatures,
    image_path: null,
    is_sold_out,
    is_active: true,
    sort_order,
    archived_at: null,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
  };
}

function rule(
  id: string,
  title: string,
  requiredStamps: number,
  benefitType: string,
  discountAmount: number | null,
  isActive: boolean,
): Row {
  return {
    id,
    title,
    required_stamps: requiredStamps,
    valid_days: 90,
    benefit_type: benefitType,
    discount_amount: discountAmount,
    eligible_category_ids: [],
    eligible_menu_item_ids: [],
    is_active: isActive,
    sort_order: 0,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
  };
}

function issued(id: string, title: string, status: string): Row {
  return {
    id,
    user_id: 'customer-1',
    coupon_id: 'rule-10',
    title_snapshot: title,
    benefit_type_snapshot: 'FREE_ITEM',
    discount_amount_snapshot: null,
    eligible_category_ids_snapshot: [],
    eligible_menu_item_ids_snapshot: [],
    display_status: status,
    issued_at: TIMESTAMP,
    expires_at: '2027-02-04T15:00:00Z',
    used_at: null,
  };
}

function pointCode(
  id: string,
  code: string,
  amount: number,
  remaining: number,
  status: string,
  memo: string,
  registeredAt: string | null = null,
): Row {
  return {
    id,
    code,
    maskedCode: `OLIVE-••••-${code.slice(-4)}`,
    amount,
    remaining,
    status,
    issuedAt: TIMESTAMP,
    expiresAt: '2027-04-20T15:00:00Z',
    registeredAt,
    memo,
    batchId: 'batch-1',
  };
}

function seedTables(): Record<string, Row[]> {
  const both = ['HOT', 'ICE'];
  return {
    menu_categories: [
      category(FAKE_IDS.coffee, '커피', 1),
      category(FAKE_IDS.latte, '라떼', 2),
      category(FAKE_IDS.nonCoffee, '논커피', 3),
      category(FAKE_IDS.tea, '티', 4),
      category(FAKE_IDS.dessert, '디저트', 5),
    ],
    menu_items: [
      item(FAKE_IDS.americano, FAKE_IDS.coffee, '아메리카노', 4500, both, 1),
      item('00000000-0000-4000-8000-000000000202', FAKE_IDS.coffee, '콜드브루', 5000, ['ICE'], 2),
      item('00000000-0000-4000-8000-000000000203', FAKE_IDS.latte, '카페 라떼', 5000, both, 1),
      item(FAKE_IDS.vanillaLatte, FAKE_IDS.latte, '바닐라 라떼', 5500, both, 2, true),
      item('00000000-0000-4000-8000-000000000209', FAKE_IDS.dessert, '플레인 스콘', 3800, both, 1),
    ],
    store_settings: [
      {
        id: 1,
        name: '더 올리브 카페',
        phone: '02-123-4567',
        address: '서울',
        description: '소개',
        is_open: true,
        is_accepting_orders: true,
        pending_payment_ttl_minutes: 15,
        new_order_sound: true,
        new_order_banner: true,
        sold_out_reminder: false,
        daily_summary: true,
        updated_at: TIMESTAMP,
        updated_by: null,
      },
    ],
    orders: seedOrders(),
    stamp_policies: [
      {
        id: 'policy-1',
        version: 1,
        earn_mode: 'PER_ORDER',
        stamps_per_order: 1,
        amount_per_stamp: null,
        earn_basis: 'MENU_AMOUNT',
        earn_timing: 'COMPLETED',
        effective_from: TIMESTAMP,
        created_by: null,
        created_at: TIMESTAMP,
      },
    ],
    coupons: [
      rule('rule-10', '아메리카노 또는 라떼 쿠폰', 10, 'FREE_ITEM', null, true),
      rule('rule-15', '전체 음료 쿠폰', 15, 'FREE_ITEM', 5500, true),
      rule('rule-20', '시즌 정액 쿠폰', 20, 'FIXED_AMOUNT', 3000, false),
    ],
    user_coupon_view: [
      issued('uc-1', '아메리카노 또는 라떼 쿠폰', 'AVAILABLE'),
      issued('uc-2', '전체 음료 쿠폰', 'USED'),
      issued('uc-3', '아메리카노 또는 라떼 쿠폰', 'EXPIRED'),
    ],
    coupon_point_policy: [
      {
        id: 1,
        min_use_amount: 0,
        use_unit: 1,
        max_use_per_order: null,
        registration_attempt_limit: 5,
        registration_attempt_window_minutes: 10,
        updated_at: TIMESTAMP,
      },
    ],
    // Secret `code` stays server-side in the real list: the fake strips it before answering.
    point_codes: [
      pointCode('pc-1', 'OLIVE-7K2M-9QXD', 15000, 12000, 'REGISTERED', '청년부 선물', TIMESTAMP),
      pointCode('pc-2', 'OLIVE-3H8R-TW4N', 10000, 10000, 'UNUSED', '청년부 선물'),
      pointCode('pc-3', 'OLIVE-5B6C-LP2V', 5000, 0, 'EXHAUSTED', '새가족 선물', TIMESTAMP),
      pointCode('pc-4', 'OLIVE-9D1F-ZK7J', 5000, 0, 'EXPIRED', '봄 행사'),
    ],
    business_hours: Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      is_closed: weekday === 6,
      opens_at: '08:00:00',
      closes_at: '21:00:00',
      updated_at: TIMESTAMP,
    })),
  };
}

const PRIMARY_KEY: Record<string, string> = { business_hours: 'weekday', store_settings: 'id' };

export type FakeSupabase = {
  client: TypedSupabaseClient;
  tables: Record<string, Row[]>;
  /** Makes every call to the named RPC fail, or every write to a table (`read:<table>` fails reads), with this message. */
  failWith: (name: string, message: string) => void;
  clearFailure: (name: string) => void;
  /** Delivers a broadcast event to every subscribed channel handler. */
  emit: (event: string) => void;
  setChannelStatus: (status: string) => void;
  calls: {
    rpc: { name: string; args: unknown }[];
    functions: { name: string; body: unknown }[];
    uploads: string[];
    removed: string[];
  };
};

/** In-memory stand-in for the Supabase client: just enough PostgREST, RPC, storage and Realtime for the store screens. */
export function createFakeSupabase(): FakeSupabase {
  const tables = seedTables();
  const failures = new Map<string, string>();
  const calls: FakeSupabase['calls'] = { rpc: [], functions: [], uploads: [], removed: [] };
  const handlers = new Map<string, (() => void)[]>();
  const statusListeners: ((status: string) => void)[] = [];
  let nextId = 1000;

  function builder(table: string) {
    let op: 'select' | 'insert' | 'update' | 'upsert' = 'select';
    let payload: Row | Row[] = {};
    let returning = false;
    let single: 'none' | 'one' | 'maybe' = 'none';
    const filters: ((row: Row) => boolean)[] = [];
    const orders: string[] = [];

    function run(): Result {
      const failure = failures.get(op === 'select' ? `read:${table}` : table);
      if (failure) return { data: null, error: { message: failure } };
      const rows = tables[table] ?? [];
      const matched = rows.filter((row) => filters.every((test) => test(row)));
      let affected: Row[] = matched;
      if (op === 'insert') {
        const incoming = Array.isArray(payload) ? payload : [payload];
        affected = incoming.map((row) => ({
          id: `00000000-0000-4000-8000-${String(nextId++).padStart(12, '0')}`,
          is_sold_out: false,
          is_active: true,
          sort_order: 0,
          archived_at: null,
          image_path: null,
          eligible_category_ids: [],
          eligible_menu_item_ids: [],
          created_at: TIMESTAMP,
          updated_at: TIMESTAMP,
          ...row,
        }));
        rows.push(...affected);
      } else if (op === 'update') {
        matched.forEach((row) => Object.assign(row, payload));
      } else if (op === 'upsert') {
        const key = PRIMARY_KEY[table] ?? 'id';
        const incoming = Array.isArray(payload) ? payload : [payload];
        affected = incoming.map((row) => {
          const existing = rows.find((candidate) => candidate[key] === row[key]);
          if (existing) return Object.assign(existing, row);
          rows.push({ ...row });
          return row;
        });
      }
      let result = op === 'select' ? [...matched] : affected;
      for (const column of orders) {
        result = [...result].sort((a, b) =>
          String(a[column]).localeCompare(String(b[column]), 'en', { numeric: true }),
        );
      }
      if (op !== 'select' && !returning) return { data: null, error: null };
      if (single === 'none') return { data: result, error: null };
      if (result[0]) return { data: result[0], error: null };
      return single === 'maybe'
        ? { data: null, error: null }
        : { data: null, error: { message: 'no rows', code: 'PGRST116' } };
    }

    const api = {
      select: () => {
        returning = true;
        return api;
      },
      insert: (row: Row | Row[]) => {
        op = 'insert';
        payload = row;
        return api;
      },
      update: (row: Row) => {
        op = 'update';
        payload = row;
        return api;
      },
      upsert: (rows: Row[]) => {
        op = 'upsert';
        payload = rows;
        return api;
      },
      eq: (column: string, value: unknown) => {
        filters.push((row) => row[column] === value);
        return api;
      },
      is: (column: string, value: unknown) => {
        filters.push((row) => (row[column] ?? null) === value);
        return api;
      },
      in: (column: string, values: unknown[]) => {
        filters.push((row) => values.includes(row[column]));
        return api;
      },
      not: (column: string, _operator: string, value: unknown) => {
        filters.push((row) => (row[column] ?? null) !== value);
        return api;
      },
      gte: (column: string, value: string) => {
        filters.push((row) => String(row[column]) >= value);
        return api;
      },
      lte: (column: string, value: string) => {
        filters.push((row) => String(row[column]) <= value);
        return api;
      },
      ilike: (column: string, pattern: string) => {
        const needle = pattern.replaceAll('%', '').toLowerCase();
        filters.push((row) => String(row[column]).toLowerCase().includes(needle));
        return api;
      },
      limit: () => api,
      order: (column: string) => {
        orders.unshift(column);
        return api;
      },
      single: () => {
        single = 'one';
        return api;
      },
      maybeSingle: () => {
        single = 'maybe';
        return api;
      },
      then: (resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve().then(run).then(resolve, reject),
    };
    return api;
  }

  function rpc(name: string, args: Row) {
    calls.rpc.push({ name, args });
    const failure = failures.get(name);
    if (failure) return Promise.resolve({ data: null, error: { message: failure, code: 'P0001' } });
    const settings = tables.store_settings?.[0];
    if (name === 'set_store_status' && settings) {
      if (typeof args.p_is_open === 'boolean') settings.is_open = args.p_is_open;
      if (typeof args.p_is_accepting_orders === 'boolean')
        settings.is_accepting_orders = args.p_is_accepting_orders;
    }
    if (name === 'set_menu_item_sold_out') {
      const target = tables.menu_items?.find((row) => row.id === args.p_menu_item_id);
      if (target) target.is_sold_out = args.p_is_sold_out;
    }
    if (name === 'admin_reorder_categories' && Array.isArray(args.p_ids)) {
      args.p_ids.forEach((id, index) => {
        const target = tables.menu_categories?.find((row) => row.id === id);
        if (target) target.sort_order = index + 1;
      });
    }
    if (name === 'admin_sales_summary') {
      return Promise.resolve({
        data: {
          days: [{ date: String(args.p_to), sales: 4500, orderCount: 1 }],
          total: 4500,
          orderCount: 1,
          averageAmount: 4500,
        },
        error: null,
      });
    }
    if (name === 'admin_popular_items') {
      return Promise.resolve({ data: [{ name: '아메리카노', quantity: 1 }], error: null });
    }
    if (name === 'admin_stamp_overview') {
      return Promise.resolve({
        data: { earnedThisMonth: 42, exchangedCoupons: 3, outstandingStamps: 120 },
        error: null,
      });
    }
    if (name === 'admin_set_stamp_policy') {
      // The server appends a version; the fake keeps only the newest row, which is all the screen reads.
      const row: Row = {
        id: `policy-${nextId++}`,
        version: nextId,
        earn_mode: args.p_earn_mode,
        stamps_per_order: args.p_stamps_per_order ?? null,
        amount_per_stamp: args.p_amount_per_stamp ?? null,
        earn_basis: args.p_earn_basis,
        earn_timing: 'COMPLETED',
        effective_from: TIMESTAMP,
        created_by: null,
        created_at: TIMESTAMP,
      };
      tables.stamp_policies = [row];
      return Promise.resolve({ data: row, error: null });
    }
    if (name.endsWith('_point_code') || name.endsWith('_point_codes')) {
      return Promise.resolve(pointCodeRpc(name, args));
    }
    if (name === 'staff_transition_order' || name === 'staff_cancel_order') {
      return Promise.resolve(moveOrder(name, args));
    }
    return Promise.resolve({ data: null, error: null });
  }

  /** The point-code RPCs in miniature: list (masked, exact search), issue (codes returned once) and void. */
  function pointCodeRpc(name: string, args: Row): Result {
    const codes = tables.point_codes ?? [];
    if (name === 'admin_list_point_codes') {
      const search = String(args.p_search ?? '').toUpperCase();
      const shown = codes.filter(
        (row) =>
          (args.p_status === undefined || row.status === args.p_status) &&
          (search === '' || row.code === search || String(row.memo).includes(search)),
      );
      const page = shown.slice(
        Number(args.p_offset ?? 0),
        Number(args.p_offset ?? 0) + Number(args.p_limit ?? 100),
      );
      const sum = (key: string) => codes.reduce((total, row) => total + Number(row[key]), 0);
      return {
        data: {
          codes: page.map(({ code: _secret, ...visible }) => visible),
          matching: shown.length,
          totals: {
            issued: sum('amount'),
            used: sum('amount') - sum('remaining'),
            remaining: sum('remaining'),
          },
        },
        error: null,
      };
    }
    if (name === 'admin_issue_point_codes') {
      const issuedNow = Array.from({ length: Number(args.p_quantity) }, (_, index) => {
        const code = `OLIVE-NEW${nextId}-${String(index).padStart(4, '0')}`.slice(0, 16);
        const row = pointCode(
          `pc-${nextId++}`,
          code,
          Number(args.p_amount),
          Number(args.p_amount),
          'UNUSED',
          String(args.p_memo ?? ''),
        );
        codes.unshift(row);
        return { id: row.id, code };
      });
      return { data: { batchId: 'batch-new', codes: issuedNow }, error: null };
    }
    if (name === 'admin_void_point_code') {
      const target = codes.find((row) => row.id === args.p_code_id);
      if (!target) return { data: null, error: { message: 'NOT_FOUND', code: 'P0001' } };
      if (target.status !== 'UNUSED' && target.status !== 'VOID') {
        return { data: null, error: { message: 'CODE_ALREADY_REGISTERED', code: 'P0001' } };
      }
      target.status = 'VOID';
      return { data: { status: 'VOID' }, error: null };
    }
    return { data: null, error: null };
  }

  const ACTION_EDGES: Record<string, [from: string, to: string]> = {
    ACCEPT: ['PAID', 'ACCEPTED'],
    REJECT: ['PAID', 'REJECTED'],
    START_PREPARING: ['ACCEPTED', 'PREPARING'],
    MARK_READY: ['PREPARING', 'READY'],
    COMPLETE: ['READY', 'COMPLETED'],
  };

  /** The order functions' checks in miniature: replay, STALE_STATUS, INVALID_TRANSITION. */
  function moveOrder(name: string, args: Row): Result {
    const target = tables.orders?.find((row) => row.id === args.p_order_id);
    const fail = (message: string): Result => ({ data: null, error: { message, code: 'P0001' } });
    if (!target) return fail('NOT_FOUND');
    const edge =
      name === 'staff_cancel_order'
        ? ['ACCEPTED', 'CANCELLED']
        : ACTION_EDGES[String(args.p_action)];
    if (!edge) return fail('INVALID_INPUT');
    const to = edge[1];
    if (target.status === to) return { data: { status: to, isReplay: true }, error: null };
    if (args.p_expected_status !== target.status) return fail('STALE_STATUS');
    const allowed = name === 'staff_cancel_order' ? ['PAID', 'ACCEPTED'] : [edge[0]];
    if (!allowed.includes(String(target.status))) return fail('INVALID_TRANSITION');
    target.status = to;
    if (args.p_action === 'REJECT') {
      target.reject_reason_code = args.p_reason_code;
      target.reject_reason = args.p_reason ?? null;
    }
    if (name === 'staff_cancel_order') target.cancel_reason = args.p_reason;
    return { data: { status: to, isReplay: false }, error: null };
  }

  const channel = {
    on(_type: string, filter: { event: string }, handler: () => void) {
      handlers.set(filter.event, [...(handlers.get(filter.event) ?? []), handler]);
      return channel;
    },
    subscribe(listener: (status: string) => void) {
      statusListeners.push(listener);
      queueMicrotask(() => listener('SUBSCRIBED'));
      return channel;
    },
  };

  const storage = {
    from: () => ({
      upload: (path: string) => {
        calls.uploads.push(path);
        return Promise.resolve({ error: null });
      },
      remove: (paths: string[]) => {
        calls.removed.push(...paths);
        return Promise.resolve({ error: null });
      },
      getPublicUrl: (path: string) => ({ data: { publicUrl: `http://fake.test/${path}` } }),
    }),
  };

  const client = {
    from: builder,
    rpc,
    channel: () => channel,
    functions: {
      invoke: (functionName: string, options: { body: unknown }) => {
        calls.functions.push({ name: functionName, body: options.body });
        return Promise.resolve({ data: {}, error: null });
      },
    },
    removeChannel: () => Promise.resolve('ok'),
    storage,
  };

  return {
    // The fake implements only the surface the screens use, so it cannot satisfy the full client type.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- test fake: partial client surface
    client: client as never,
    tables,
    clearFailure: (name) => {
      failures.delete(name);
    },
    failWith: (name, message) => {
      failures.set(name, message);
    },
    emit: (event) => {
      (handlers.get(event) ?? []).forEach((handler) => handler());
    },
    setChannelStatus: (status) => {
      statusListeners.forEach((listener) => listener(status));
    },
    calls,
  };
}
