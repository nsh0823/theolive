# Backend integration plan (Supabase)

Status: **PLAN ONLY, pending user review.** No migrations, generated types, or app code exist for anything below.
Author: solution-architect, 2026-11-05. Branch `feat/customer-app-screens`.

Inputs: CLAUDE.md, docs/PRD.md (§2, §5, §6, §7, §9, §10, §15), docs/DECISIONS.md, the existing migration
`20261022000000_create_profiles.sql`, `packages/api` and `packages/types`, and the view-models the fixtures already use
(`apps/mobile/src/models/index.ts`, `apps/mobile/src/fixtures/*`, `apps/store/src/domain/models.ts`,
`apps/store/src/domain/memberModels.ts`, `apps/store/src/domain/orderTransitions.ts`, `apps/store/src/data/*`).
docs/STANDARDS.md tilo leftovers (timer, monochrome) are ignored.

Conventions used in this doc:

- Money is integer KRW (`integer`, whole won, `>= 0`). No floats anywhere.
- Timestamps are `timestamptz`. "Business day" means the calendar date in `Asia/Seoul`.
- Tables are snake_case plural in `public`. Internal helpers live in schema `private` (not exposed by the API).
  The test payment provider's fake state lives in schema `test_pg` (not exposed).
- Every FK has an explicit `on delete` and an index. Every table has RLS enabled in the migration that creates it.
- RLS policies use `(select auth.uid())` and the `private.*` role helpers below, never bare `auth.uid()`.
- Anything multi-step or money-related is a `security definer` RPC (`set search_path = ''`) or an Edge Function.
  Plain CRUD goes through RLS.
- Errors from RPCs: `raise exception using errcode = 'P0001', message = '<APP_ERROR code>'` (optionally `detail` = JSON).
  Edge Functions return `{ "error": { "code": "<APP_ERROR code>", "message": "<plain Korean text>" } }` with an HTTP status.
  The code set is defined once in `packages/types` (§8).

PRD §9 name mapping: PRD names are used for orders, payments, refunds, rewards, notifications, announcements.
Menu tables are `menu_categories` / `menu_items` (PRD `categories` / `products`) because both apps already use the
`MenuCategory` / `MenuItem` vocabulary. PRD `product_options` / `order_item_options` collapse into a `temperatures`
column (menu) and a `temperature` column (order item), since MVP options are HOT/ICE only with no price difference.
PRD `users` = `auth.users` + `public.profiles`. PRD `store` + `store_settings` = one `store_settings` row.

---

## 1. Tables, columns, constraints, indexes, enums

### 1.1 Enums (Postgres enum types; mirrored as const objects in `packages/types`)

| Enum                  | Values                                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------------------------- |
| `temperature`         | `HOT`, `ICE`                                                                                                |
| `order_type`          | `DINE_IN`, `TAKEOUT`                                                                                        |
| `order_status`        | `PENDING_PAYMENT`, `PAID`, `ACCEPTED`, `PREPARING`, `READY`, `COMPLETED`, `REJECTED`, `CANCELLED` (PRD 7.1) |
| `payment_status`      | `READY`, `PAID`, `FAILED`, `CANCELLED`, `PARTIAL_REFUNDED`, `REFUNDED` (PRD 7.2)                            |
| `payment_method`      | `KAKAO_PAY`, `NAVER_PAY`, `TOSS_PAY`, `CARD`, `NONE` (`NONE` = zero-amount order, see OQ-18)                |
| `refund_status`       | `REQUESTED`, `SUCCEEDED`, `FAILED`                                                                          |
| `actor_role`          | `CUSTOMER`, `STAFF`, `ADMIN`, `SYSTEM`                                                                      |
| `staff_role`          | `ADMIN`, `STAFF`                                                                                            |
| `staff_permission`    | `PROCESS_ORDERS`, `MANAGE_OPERATIONS` (matches store fixture `STAFF_PERMISSION`)                            |
| `stamp_earn_mode`     | `PER_ORDER`, `PER_AMOUNT`                                                                                   |
| `stamp_earn_timing`   | `PAID`, `ACCEPTED`, `COMPLETED`                                                                             |
| `stamp_tx_kind`       | `EARN`, `REDEEM`, `EARN_REVERSAL`, `REDEEM_RESTORE`, `EXPIRE`, `FORFEIT`, `ADJUST`                          |
| `coupon_benefit_type` | `FIXED_AMOUNT`, `FREE_ITEM`                                                                                 |
| `user_coupon_status`  | `AVAILABLE`, `RESERVED`, `USED`, `EXPIRED`, `VOID`                                                          |
| `point_code_status`   | `UNUSED`, `REGISTERED`, `EXPIRED`, `VOID` (`EXHAUSTED` is derived: registered and remaining = 0)            |
| `point_tx_kind`       | `REGISTER`, `USE`, `REFUND_RESTORE`, `EXPIRE`, `FORFEIT`, `ADJUST`                                          |
| `point_hold_status`   | `HELD`, `CAPTURED`, `RELEASED`                                                                              |
| `notification_kind`   | `ORDER`, `PAYMENT`, `STAMP`, `COUPON`, `POINT`, `NOTICE` (matches mobile `NOTIFICATION_KIND`)               |
| `announcement_status` | `PUBLISHED`, `UNPUBLISHED` (matches store `NOTICE_STATUS`)                                                  |

`ADJUST` kinds exist in the enums so a later manual-adjustment feature needs no enum migration, but no MVP code path
writes them (DECISIONS 2026-11-05: manual adjustments deferred).

### 1.2 Role helpers (schema `private`, `security definer`, `stable`)

- `private.is_active_staff() returns boolean`: row in `staff_members` for `auth.uid()` with `is_active`.
- `private.has_staff_permission(p staff_permission) returns boolean`: active staff and (`role = 'ADMIN'` or `p = any(permissions)`).
- `private.is_admin() returns boolean`: active staff with `role = 'ADMIN'`.
- `private.current_actor_role() returns actor_role`.

These read the table on every call (not JWT claims) so deactivation and permission changes take effect immediately.
Policies call them as `(select private.is_admin())` so Postgres evaluates them once per statement.

Shared triggers: `private.set_updated_at()`; `private.prevent_update_delete()` (raises `APPEND_ONLY`) on every ledger
and history table; `private.audit_admin_change()` on admin-managed tables (writes `admin_audit_log`).

### 1.3 Identity and roles

**`profiles`** (exists; extended by a NEW migration, the applied one is not edited)

| Column       | Type        | Notes                                                                        |
| ------------ | ----------- | ---------------------------------------------------------------------------- |
| `id`         | uuid PK     | FK `auth.users(id)` on delete cascade (existing)                             |
| `username`   | text unique | existing; unused by the apps. Kept (dropping it is destructive, see OQ-40)   |
| `avatar_url` | text        | existing                                                                     |
| `updated_at` | timestamptz | existing; add `not null` default + `set_updated_at` trigger                  |
| `nickname`   | text        | NEW, not null, 1-20 chars, default from provider metadata or `'올리브 회원'` |
| `created_at` | timestamptz | NEW, not null default now()                                                  |
| `deleted_at` | timestamptz | NEW, null. Set during account deletion before the auth user is removed       |

Email, phone and login provider stay in `auth.users` only (never copied to `public`). `handle_new_user()` is replaced
(new migration, `create or replace`) to also fill `nickname` from `raw_user_meta_data`.
Column privileges: `revoke update on profiles from authenticated; grant update (nickname, avatar_url) on profiles to authenticated;`
so a customer can never write `deleted_at` or `id`.

**`staff_members`**

| Column                     | Type               | Notes                                                      |
| -------------------------- | ------------------ | ---------------------------------------------------------- |
| `user_id`                  | uuid PK            | FK `profiles(id)` on delete cascade                        |
| `role`                     | staff_role         | not null                                                   |
| `permissions`              | staff_permission[] | not null default `'{PROCESS_ORDERS}'`; ignored for `ADMIN` |
| `display_name`             | text               | not null, 1-20 chars (store fixture `StaffMember.name`)    |
| `is_active`                | boolean            | not null default true                                      |
| `invited_by`               | uuid               | FK `profiles(id)` on delete set null; indexed              |
| `created_at`, `updated_at` | timestamptz        |                                                            |

Check: at least one active `ADMIN` must remain (enforced in `admin_update_staff`, error `LAST_ADMIN`).

**`admin_audit_log`** (append-only): `id bigint identity PK`, `actor_id uuid` (FK profiles on delete set null, indexed),
`entity text`, `entity_id text`, `action text` (`INSERT`/`UPDATE`), `before jsonb`, `after jsonb`, `created_at`.
Index `(entity, entity_id, created_at desc)`. Satisfies SA-07 "정책 변경 이력" for stamp/coupon policy and gives an audit
trail for prices, store settings, point codes and staff (PRD 10.1).

### 1.4 Store

**`store_settings`** (exactly one row: `id smallint PK default 1 check (id = 1)`)

`name`, `phone`, `address`, `description` (text, not null; store `StoreInfo`); `is_open boolean`,
`is_accepting_orders boolean` (store `StoreStatus`, SW-08, SA-11); `pending_payment_ttl_minutes smallint default 15`
(OQ-14); `new_order_sound`, `new_order_banner`, `sold_out_reminder`, `daily_summary` booleans (store
`NotificationSettings`); `updated_at`, `updated_by uuid` (FK profiles on delete set null).

**`business_hours`**: `weekday smallint PK check (weekday between 0 and 6)` (0 = Monday, store `WEEKDAY`),
`is_closed boolean`, `opens_at time`, `closes_at time`, check `is_closed or closes_at > opens_at`, `updated_at`.

### 1.5 Menu

**`menu_categories`**: `id uuid PK default gen_random_uuid()`, `name text not null` (1-20 chars, unique among
non-archived), `sort_order integer not null default 0`, `is_active boolean not null default true`, `created_at`,
`updated_at`. Index `(sort_order)`.

**`menu_items`**

| Column                     | Type          | Notes                                                                                |
| -------------------------- | ------------- | ------------------------------------------------------------------------------------ |
| `id`                       | uuid PK       |                                                                                      |
| `category_id`              | uuid not null | FK `menu_categories(id)` on delete restrict; indexed                                 |
| `name`                     | text not null | 1-30 chars                                                                           |
| `description`              | text not null | default `''`, max 200                                                                |
| `price`                    | integer       | not null, `>= 0`                                                                     |
| `temperatures`             | temperature[] | not null; distinct values; `cardinality <= 2`. Empty = no temperature choice (OQ-16) |
| `image_path`               | text          | null; object path in Storage bucket `menu-images`                                    |
| `is_sold_out`              | boolean       | not null default false (SW-07)                                                       |
| `is_active`                | boolean       | not null default true; false = 판매 중지, hidden from customers                      |
| `sort_order`               | integer       | not null default 0                                                                   |
| `archived_at`              | timestamptz   | null. Admin "삭제" archives instead of deleting (PRD 9.1, OQ-41)                     |
| `created_at`, `updated_at` |               |                                                                                      |

Index `(category_id, sort_order) where archived_at is null`. Audit trigger on insert/update.

**Storage bucket `menu-images`** (public read, created in a migration): insert/update/delete on `storage.objects`
allowed only when `bucket_id = 'menu-images'` and `(select private.is_admin())`. Max 2 MB, `image/jpeg|png|webp`.

### 1.6 Orders

**`orders`**

| Column                                                                                                                          | Type           | Notes                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                                                                                            | uuid PK        |                                                                                                                                                |
| `order_number`                                                                                                                  | text           | null until PAID; e.g. `A-41`; unique with `business_date` (OQ-13)                                                                              |
| `business_date`                                                                                                                 | date           | null until PAID (Asia/Seoul date of `paid_at`)                                                                                                 |
| `customer_id`                                                                                                                   | uuid           | FK `profiles(id)` on delete set null (order survives account deletion); indexed `(customer_id, created_at desc)`                               |
| `client_request_id`                                                                                                             | uuid not null  | idempotency key from the client; unique `(customer_id, client_request_id)`                                                                     |
| `request_hash`                                                                                                                  | text not null  | sha256 of the normalized checkout request; same key + different hash = `IDEMPOTENCY_CONFLICT`                                                  |
| `order_type`                                                                                                                    | order_type     | not null (ORD-08)                                                                                                                              |
| `status`                                                                                                                        | order_status   | not null default `PENDING_PAYMENT`                                                                                                             |
| `payment_status`                                                                                                                | payment_status | not null default `READY`. **Derived cache** of the current payment attempt, written only by payment RPCs in the same transaction as `payments` |
| `payment_method`                                                                                                                | payment_method | not null                                                                                                                                       |
| `note`                                                                                                                          | text           | null, max 100 chars (ORD-10, P1)                                                                                                               |
| `menu_amount`                                                                                                                   | integer        | `>= 0`, server-computed                                                                                                                        |
| `coupon_discount`                                                                                                               | integer        | `>= 0`, `<= menu_amount`                                                                                                                       |
| `points_used`                                                                                                                   | integer        | `>= 0`                                                                                                                                         |
| `paid_amount`                                                                                                                   | integer        | `>= 0`; check `paid_amount = menu_amount - coupon_discount - points_used`                                                                      |
| `user_coupon_id`                                                                                                                | uuid           | null; FK `user_coupons(id)` on delete restrict; indexed (added in phase d)                                                                     |
| `stamp_policy_id`                                                                                                               | uuid           | null until PAID; FK `stamp_policies(id)` on delete restrict (policy that applies, SA-07)                                                       |
| `reject_reason_code`                                                                                                            | text           | null; one of `ORDER_REJECT_REASON` (OQ-10)                                                                                                     |
| `reject_reason`                                                                                                                 | text           | null, max 100; free text                                                                                                                       |
| `cancel_reason`                                                                                                                 | text           | null                                                                                                                                           |
| `expires_at`                                                                                                                    | timestamptz    | not null; `created_at + pending_payment_ttl_minutes`                                                                                           |
| `created_at`, `paid_at`, `accepted_at`, `preparing_at`, `ready_at`, `completed_at`, `rejected_at`, `cancelled_at`, `updated_at` | timestamptz    |                                                                                                                                                |

Indexes: `(status, paid_at)` for the board, `(business_date)`, partial `(expires_at) where status = 'PENDING_PAYMENT'`,
unique `(business_date, order_number) where order_number is not null`.
View-model mapping: `placedAt = paid_at ?? created_at`; `lines` from `order_items`; `memberId = customer_id`.

**`order_items`** (snapshot, immutable after insert)

`id uuid PK`; `order_id uuid not null` FK `orders(id)` on delete cascade (indexed); `menu_item_id uuid` FK
`menu_items(id)` on delete set null (indexed; used by reorder); `name_snapshot text not null`; `temperature temperature`
(null only if the item had no temperature options); `quantity integer check (quantity between 1 and 20)` (matches
`MAX_LINE_QUANTITY`); `unit_price integer >= 0`; `line_total integer generated always as (unit_price * quantity) stored`;
`sort_order smallint`. Unique `(order_id, menu_item_id, temperature)` (the cart already merges same item+temperature).

**`order_status_history`** (append-only): `id bigint identity PK`, `order_id` FK cascade (indexed with `created_at`),
`from_status order_status` (null for creation), `to_status order_status not null`, `actor_id uuid` (FK profiles on
delete set null, indexed), `actor_role actor_role not null`, `reason text`, `created_at`.

**`order_number_counters`** (internal, no client access): `business_date date PK`, `last_value integer not null`.
`private.next_order_number(date)` does `insert ... on conflict do update set last_value = last_value + 1 returning`.

### 1.7 Payments

**`payments`** (one row per payment attempt; MVP has one attempt per order, see OQ-19)

| Column                                                                   | Type           | Notes                                                         |
| ------------------------------------------------------------------------ | -------------- | ------------------------------------------------------------- |
| `id`                                                                     | uuid PK        | also the merchant reference sent to the provider              |
| `order_id`                                                               | uuid not null  | FK `orders(id)` on delete restrict; indexed                   |
| `provider`                                                               | text not null  | `TEST` now; real PG id later                                  |
| `method`                                                                 | payment_method | not null                                                      |
| `amount`                                                                 | integer        | not null, `>= 0`; equals `orders.paid_amount` at creation     |
| `status`                                                                 | payment_status | not null default `READY`                                      |
| `idempotency_key`                                                        | text not null  | unique; `checkout:<customer_id>:<client_request_id>`          |
| `provider_payment_id`                                                    | text           | null until approved; unique `(provider, provider_payment_id)` |
| `failure_code`, `failure_message`                                        | text           | null                                                          |
| `requested_at`, `approved_at`, `failed_at`, `cancelled_at`, `updated_at` | timestamptz    |                                                               |

Partial unique indexes: one `READY` attempt per order; one captured attempt
(`status in ('PAID','PARTIAL_REFUNDED','REFUNDED')`) per order.

**`payment_events`** (append-only, service-role only): `id bigint identity PK`, `payment_id uuid` (FK payments on
delete restrict, indexed, null if unmatched), `provider text`, `event_id text`, `event_type text`, `source text`
(`CONFIRM`, `WEBHOOK`, `RECONCILE`), `payload jsonb` (provider payload with card/PII fields stripped), `result text`
(`APPLIED`, `DUPLICATE`, `REJECTED`), `received_at`. Unique `(provider, event_id)` = duplicate-callback guard.

**`refunds`**: `id uuid PK`, `payment_id` FK payments on delete restrict (indexed), `amount integer > 0`,
`reason text not null`, `status refund_status`, `idempotency_key text unique` (`refund:<order_id>:<reason>`),
`provider_refund_id text`, `requested_by uuid` (FK profiles on delete set null), `failure_message text`,
`created_at`, `completed_at`. Check: sum of succeeded refunds per payment `<= payments.amount` (enforced in RPC).

**`test_pg.transactions`** (schema not exposed; TEST provider only): `id uuid PK` (= provider_payment_id),
`payment_id uuid unique`, `amount integer`, `status text` (`PENDING`, `APPROVED`, `FAILED`, `CANCELLED`, `REFUNDED`),
`scenario text`, `created_at`, `updated_at`. Stands in for the PG's own database so lookups and reconciliation behave
like a real provider.

### 1.8 Olive Stamps and reward coupons (never shares a table, balance or function with Coupon Points)

**`stamp_policies`** (append-only, versioned; latest `effective_from <= now()` applies)

`id uuid PK`, `earn_mode stamp_earn_mode`, `stamps_per_order smallint check (> 0)` (PER_ORDER), `amount_per_stamp
integer check (> 0)` (PER_AMOUNT), `earn_basis text check in ('MENU_AMOUNT','PAID_AMOUNT')` (OQ-23),
`earn_timing stamp_earn_timing`, `effective_from timestamptz`, `created_by uuid` (FK profiles set null, indexed),
`created_at`. Admin "edit" = insert a new row (history kept, SA-07). Index `(effective_from desc)`.

**`stamp_balances`** (projection): `user_id uuid PK` FK profiles on delete cascade, `balance integer check (>= 0)`,
`updated_at`. Written only by the ledger trigger. Exists so redemption can `select ... for update` one row.

**`stamp_transactions`** (append-only ledger; PRD `stamp_transactions`)

`id bigint identity PK`; `user_id uuid` FK profiles on delete set null (indexed `(user_id, created_at desc)`);
`kind stamp_tx_kind`; `delta integer check (delta <> 0)`; `balance_after integer check (>= 0)`; `order_id uuid` FK
orders on delete restrict (indexed); `user_coupon_id uuid` FK user_coupons on delete restrict (indexed);
`idempotency_key text not null unique`; `label text not null` (display label, e.g. `주문 적립`); `actor_id uuid` (FK
profiles set null); `created_at`.
`BEFORE INSERT` trigger locks/creates the `stamp_balances` row, computes `balance_after`, raises `INSUFFICIENT_STAMPS`
if it would go negative, then updates the balance. `prevent_update_delete` trigger blocks UPDATE/DELETE.
Idempotency keys: `earn:<order_id>`, `earn_reversal:<order_id>`, `redeem:<user_id>:<client_request_id>`,
`redeem_restore:<user_coupon_id>`, `forfeit:<user_id>`.

**`coupons`** (definitions = store `StampExchangeRule`; PRD `coupons`)

`id uuid PK`, `title text` (1-30), `required_stamps smallint check (1..99)`, `valid_days smallint check (1..365)`,
`benefit_type coupon_benefit_type`, `discount_amount integer` (FIXED_AMOUNT: amount; FREE_ITEM: cap, null = no cap),
`eligible_category_ids uuid[] not null default '{}'`, `eligible_menu_item_ids uuid[] not null default '{}'`
(both empty = any item), `is_active boolean`, `sort_order`, `created_at`, `updated_at`. Audit trigger. No delete
(deactivate). Benefit model is OQ-26.

**`user_coupons`** (issued coupons; mutable status, every change also recorded via ledger/order history)

`id uuid PK`; `user_id` FK profiles on delete set null (indexed `(user_id, status)`); `coupon_id` FK coupons on delete
restrict (indexed); snapshots `title_snapshot`, `benefit_type_snapshot`, `discount_amount_snapshot`,
`eligible_category_ids_snapshot`, `eligible_menu_item_ids_snapshot` (definition edits never change issued coupons);
`status user_coupon_status default 'AVAILABLE'`; `issued_at`, `expires_at` (`issued_at + valid_days`, end of day KST);
`reserved_order_id` FK orders on delete restrict (indexed); `used_order_id` FK orders on delete restrict (indexed);
`used_at`; `redeem_transaction_id bigint` FK stamp_transactions on delete restrict; `idempotency_key text unique`.
Partial unique: one coupon `RESERVED`/`USED` per order. Display status: `EXPIRED` when `status = 'AVAILABLE' and
expires_at < now()` (computed in the read view; nightly job persists it).

### 1.9 Coupon Points (never shares a table, balance or function with stamps)

**`coupon_point_policy`** (single row, `id = 1`): `min_use_amount integer default 0`, `use_unit integer default 1`,
`max_use_per_order integer null` (null = no cap), `registration_attempt_limit smallint default 5`,
`registration_attempt_window_minutes smallint default 10`, `updated_at`. Values are OQ-30/OQ-32.

**`coupon_point_code_batches`**: `id uuid PK`, `amount integer check (1000..100000)` (store `POINT_AMOUNT_MIN/MAX`),
`quantity smallint check (1..50)` (`POINT_QUANTITY_MAX`), `expires_at timestamptz`, `memo text` (max 40),
`created_by` FK profiles set null (indexed), `created_at`.

**`coupon_point_codes`** (PRD `coupon_point_codes`)

`id uuid PK`; `batch_id` FK batches on delete restrict (indexed); `code text not null unique` (normalized uppercase,
`OLIVE-XXXX-XXXX`, 8 chars from the 32-char alphabet the store fixture uses, generated with `gen_random_bytes`);
`amount integer`; `expires_at timestamptz`; `status point_code_status default 'UNUSED'`; `registered_by uuid` FK
profiles on delete set null (indexed); `registered_at`; `voided_at`, `voided_by`; `created_at`.
Check: `status = 'UNUSED'` implies `registered_by is null`. `remaining` is derived from the ledger (lots, below).

**`coupon_point_balances`** (projection): `user_id uuid PK` FK profiles cascade, `balance integer check (>= 0)`,
`updated_at`. Ledger trigger maintains it.

**`coupon_point_transactions`** (append-only ledger; PRD `coupon_point_transactions`)

`id bigint identity PK`; `user_id` FK profiles on delete set null (indexed `(user_id, created_at desc)`);
`kind point_tx_kind`; `delta integer <> 0`; `balance_after integer >= 0`; `code_id uuid not null` FK
`coupon_point_codes` on delete restrict (indexed; every row belongs to one code "lot"); `order_id` FK orders on delete
restrict (indexed); `idempotency_key text not null`; unique `(idempotency_key, code_id)` (a USE spanning two lots
writes two rows with one key); `label text`; `actor_id`; `created_at`.
Per-code remaining = `sum(delta) where code_id = ?`; the trigger also raises `POINTS_EXCEED_BALANCE` if a lot would go
negative. Keys: `register:<code_id>`, `use:<order_id>`, `refund_restore:<order_id>`, `expire:<code_id>`,
`forfeit:<user_id>`.

**`coupon_point_holds`** (reservation during checkout; not a ledger, never shown as history)

`id uuid PK`; `order_id uuid unique` FK orders on delete restrict; `user_id` FK profiles on delete cascade (indexed);
`amount integer > 0`; `status point_hold_status default 'HELD'`; `created_at`, `resolved_at`.
Available balance = `coupon_point_balances.balance - sum(HELD holds)`. On PAID the hold is `CAPTURED` and USE ledger
rows are written (earliest-expiring lot first); on failure/expiry it is `RELEASED` and nothing touches the ledger.

**`coupon_point_code_attempts`** (brute-force guard): `id bigint identity PK`, `user_id` FK profiles cascade,
`succeeded boolean`, `created_at`; index `(user_id, created_at desc)`. Retention per OQ-35.

### 1.10 Notifications and announcements

**`notifications`**: `id uuid PK`, `user_id` FK profiles on delete cascade (indexed `(user_id, created_at desc)`),
`kind notification_kind`, `title text`, `body text`, `order_id` FK orders on delete set null (indexed), `is_read boolean
default false`, `created_at`, plus `dedupe_key text unique` (e.g. `order:<id>:READY`). Written only by server
functions/triggers. In-app only; push is OQ-37.

**`notification_preferences`**: `user_id uuid PK` FK profiles cascade, `order_updates boolean default true`,
`notices boolean default true`, `updated_at` (mobile `NotificationPreferences`, OTH-05).

**`announcements`** (PRD; store `Notice`): `id uuid PK`, `title text` (1-60), `body text` (1-2000),
`status announcement_status default 'UNPUBLISHED'`, `published_at timestamptz` (check: set iff PUBLISHED),
`created_by` FK profiles set null (indexed), `created_at`, `updated_at`. Hard delete allowed for admin (no financial
meaning).

---

## 2. RLS policies per role

Roles: `anon` (signed out), customer (`authenticated` with no active `staff_members` row), staff (active
`staff_members`, permissions per row), admin (`role = 'ADMIN'`). Default is deny: a table without a policy for a
command rejects it. `service_role` (Edge Functions only) bypasses RLS and is never shipped to a client.

Legend: C = customer, S(P) = staff with permission P (`PO` = PROCESS_ORDERS, `MO` = MANAGE_OPERATIONS), A = admin.
"RPC only" means no direct-write policy exists; the security-definer RPC is the only write path.

| Table                             | select                                                                                                                                                                                                                   | insert / update / delete                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `profiles`                        | own row (C, S, A); A reads others only through `admin_*` RPCs                                                                                                                                                            | update own row, columns `nickname`, `avatar_url` only; no insert/delete (trigger / Edge Function) |
| `staff_members`                   | own row (any staff, so the app can read its role); A all                                                                                                                                                                 | RPC / Edge Function only (`admin-staff`, `admin_update_staff`)                                    |
| `admin_audit_log`                 | A                                                                                                                                                                                                                        | none (triggers)                                                                                   |
| `store_settings`                  | any authenticated                                                                                                                                                                                                        | update: S(MO) columns `is_open`, `is_accepting_orders`; A all columns (column grants + policy)    |
| `business_hours`                  | any authenticated                                                                                                                                                                                                        | update: A                                                                                         |
| `menu_categories`                 | C: `is_active`; S, A: all                                                                                                                                                                                                | insert/update: A; no delete                                                                       |
| `menu_items`                      | C: `is_active and archived_at is null` and category active; S, A: all non-archived (A also archived)                                                                                                                     | insert/update: A; update of `is_sold_out` only: S(MO) (column grant + policy); no delete          |
| `orders`                          | C: own rows of any status (`customer_id = (select auth.uid())`); the history screen hides `PENDING_PAYMENT` and failed checkouts; S(PO), A: `status <> 'PENDING_PAYMENT'` (PAY-05: only verified orders reach the store) | RPC only                                                                                          |
| `order_items`                     | same visibility as the parent order (`exists` on orders)                                                                                                                                                                 | RPC only                                                                                          |
| `order_status_history`            | C: own orders; S(PO), A: same as orders                                                                                                                                                                                  | RPC only                                                                                          |
| `order_number_counters`           | none                                                                                                                                                                                                                     | none (private function)                                                                           |
| `payments`                        | C: own orders, columns via view `my_payments` (no failure internals); S(PO), A: orders they can see                                                                                                                      | RPC / Edge Function only                                                                          |
| `payment_events`                  | none (service role only)                                                                                                                                                                                                 | none                                                                                              |
| `refunds`                         | A; C: own orders (status, amount only via view)                                                                                                                                                                          | RPC / Edge Function only                                                                          |
| `stamp_policies`                  | any authenticated (current policy shown in app); A all rows                                                                                                                                                              | A insert only (append-only)                                                                       |
| `stamp_balances`                  | C: own; A all (member detail via RPC)                                                                                                                                                                                    | none (trigger)                                                                                    |
| `stamp_transactions`              | C: own; A: all                                                                                                                                                                                                           | RPC only; UPDATE/DELETE blocked by trigger for everyone                                           |
| `coupons`                         | any authenticated: `is_active`; A: all                                                                                                                                                                                   | A insert/update; no delete                                                                        |
| `user_coupons`                    | C: own; A: all                                                                                                                                                                                                           | RPC only                                                                                          |
| `coupon_point_policy`             | any authenticated                                                                                                                                                                                                        | A update                                                                                          |
| `coupon_point_code_batches`       | A                                                                                                                                                                                                                        | RPC only (`admin_issue_point_codes`)                                                              |
| `coupon_point_codes`              | A only (customers never list codes; registration goes through the RPC)                                                                                                                                                   | RPC only (issue, void)                                                                            |
| `coupon_point_balances`           | C: own; A: all                                                                                                                                                                                                           | none (trigger)                                                                                    |
| `coupon_point_transactions`       | C: own; A: all                                                                                                                                                                                                           | RPC only; append-only trigger                                                                     |
| `coupon_point_holds`              | C: own                                                                                                                                                                                                                   | RPC only                                                                                          |
| `coupon_point_code_attempts`      | none                                                                                                                                                                                                                     | RPC only                                                                                          |
| `notifications`                   | C: own                                                                                                                                                                                                                   | update own `is_read` only (column grant); insert by server                                        |
| `notification_preferences`        | C: own                                                                                                                                                                                                                   | C: insert/update own                                                                              |
| `announcements`                   | any authenticated: `status = 'PUBLISHED'`; A: all                                                                                                                                                                        | A insert/update/delete                                                                            |
| `storage.objects` (`menu-images`) | public read                                                                                                                                                                                                              | A insert/update/delete                                                                            |
| `realtime.messages`               | see §6                                                                                                                                                                                                                   | none from clients                                                                                 |

Notes:

- Staff without `PROCESS_ORDERS` see no orders. Staff never read other customers' profiles, email or phone; the order
  board shows the order number only (no customer name) unless OQ-6 changes that.
- 회원관리 (SA-12) is admin-only, served exclusively by `admin_list_members` / `admin_get_member`, which return
  pre-masked email/phone computed in SQL (`private.mask_email`, `private.mask_phone`, same rules and test vectors as
  `apps/store/src/domain/masking.ts`). Raw `auth.users` data never leaves the database.
- Column grants are used alongside policies wherever a role may update only some columns (`profiles`,
  `store_settings`, `menu_items.is_sold_out`, `notifications.is_read`), because RLS alone cannot restrict columns.
- Every security-definer function re-checks the caller's role itself (RLS does not apply inside it) and sets
  `search_path = ''`. `execute` is revoked from `public`/`anon` and granted to `authenticated` (or `service_role`
  for internal ones).

---

## 3. RPCs and Edge Functions

All money is computed server-side from `menu_items.price`, coupon snapshots and ledger balances. Client-sent amounts
are never read. Error codes come from `APP_ERROR` (§8).

### 3.1 Customer RPCs (Postgres, `security definer`, caller must be authenticated and not deleted)

| RPC                                                                                                                                                       | Input                                                           | Output                                                                                                                                                                                       | Errors                                                                                                                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_my_reward_summary()`                                                                                                                                 | none                                                            | `{ stamps: { balance, nextGoal }, points: { balance, available }, availableCouponCount }` (HOME-04; `nextGoal` = smallest active `required_stamps` above balance, else largest)              | none                                                                                                                                                                                                                                                                                           |
| `quote_checkout(p_lines jsonb, p_user_coupon_id uuid, p_points_to_use int)`                                                                               | lines `[{ menuItemId, temperature, quantity }]`                 | `{ lines:[{ menuItemId, name, temperature, quantity, unitPrice, lineTotal }], menuAmount, couponDiscount, pointsUsed, paidAmount, usableCouponIds[] }` (PAY-01; read-only preview, no holds) | same validation errors as checkout                                                                                                                                                                                                                                                             |
| `create_checkout_order(p_client_request_id uuid, p_order_type, p_lines jsonb, p_user_coupon_id uuid, p_points_to_use int, p_payment_method, p_note text)` | called by Edge Function `payments-checkout` with the user's JWT | `{ orderId, paymentId, amount, status, paymentStatus, isReplay }`                                                                                                                            | `STORE_CLOSED`, `NOT_ACCEPTING_ORDERS`, `EMPTY_CART`, `INVALID_QUANTITY`, `ITEM_UNAVAILABLE`, `ITEM_SOLD_OUT`, `INVALID_TEMPERATURE`, `COUPON_NOT_USABLE`, `COUPON_EXPIRED`, `POINTS_EXCEED_BALANCE`, `POINTS_EXCEED_PAYABLE`, `POINTS_BELOW_MINIMUM`, `IDEMPOTENCY_CONFLICT`, `NOTE_TOO_LONG` |
| `customer_cancel_order(p_order_id uuid, p_expected_status order_status)`                                                                                  | own order                                                       | `{ status, paymentStatus, refundStatus }`                                                                                                                                                    | `NOT_FOUND`, `INVALID_TRANSITION`, `STALE_STATUS` (allowed sources per OQ-8)                                                                                                                                                                                                                   |
| `redeem_stamps_for_coupon(p_coupon_id uuid, p_client_request_id uuid)`                                                                                    |                                                                 | `{ userCouponId, stampBalance, isReplay }` (RW-02, flow 6.4)                                                                                                                                 | `NOT_FOUND`, `REWARD_INACTIVE`, `INSUFFICIENT_STAMPS`                                                                                                                                                                                                                                          |
| `register_coupon_point_code(p_code text)`                                                                                                                 | raw input; normalized server-side (`trim`, `upper`)             | `{ status: 'REGISTERED', amount, balance }` (RW-05, flow 6.5)                                                                                                                                | `CODE_INVALID`, `CODE_ALREADY_REGISTERED` (by anyone, incl. self), `CODE_EXPIRED`, `CODE_VOID`, `TOO_MANY_ATTEMPTS`                                                                                                                                                                            |
| `mark_notifications_read(p_ids uuid[] or null)`                                                                                                           | null = all                                                      | `{ updated }`                                                                                                                                                                                | none                                                                                                                                                                                                                                                                                           |

`create_checkout_order` steps, one transaction:

1. Replay check: if `(customer_id, client_request_id)` exists, compare `request_hash`; same → return existing result
   with `isReplay = true`; different → `IDEMPOTENCY_CONFLICT`.
2. Lazily expire the caller's stale `PENDING_PAYMENT` orders (`private.expire_order`).
3. Validate store (`is_open`, `is_accepting_orders`; hours per OQ-11), lines (1-20 qty, active, not archived, not sold
   out, temperature in `temperatures` or null when empty, merge duplicates).
4. Price lines from `menu_items.price`; `menu_amount = sum`.
5. Coupon: lock `user_coupons` row `for update`; must be own, `AVAILABLE`, not expired, eligible line present →
   discount per benefit rule (OQ-26) capped at `menu_amount`; set `RESERVED`, `reserved_order_id`.
6. Points: lock `coupon_point_balances` row; `available = balance - held`; validate against policy
   (`min_use_amount`, `use_unit`, `max_use_per_order`) and `<= menu_amount - coupon_discount`; insert hold `HELD`.
7. Insert order (`PENDING_PAYMENT`, `expires_at`), items (snapshots), history row (`null → PENDING_PAYMENT`, CUSTOMER),
   payment (`READY`, `amount = paid_amount`, `idempotency_key`).

### 3.2 Staff and admin RPCs

| RPC                                                                                        | Who                         | Input                                                                                               | Output                                                                                                                                                        | Errors                                                                                     |
| ------------------------------------------------------------------------------------------ | --------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `get_my_staff_role()`                                                                      | any authenticated           | none                                                                                                | `{ role, permissions, isActive }                                                                                                                              | null` (route gating only; RLS is the boundary)                                             | none |
| `staff_transition_order(p_order_id, p_action, p_expected_status, p_reason_code, p_reason)` | S(PO), A                    | action = `ACCEPT` / `REJECT` / `START_PREPARING` / `MARK_READY` / `COMPLETE` (store `STAFF_ACTION`) | `{ status, paymentStatus, isReplay }`                                                                                                                         | `FORBIDDEN`, `NOT_FOUND`, `INVALID_TRANSITION`, `STALE_STATUS`, `REASON_REQUIRED` (REJECT) |
| `staff_cancel_order(p_order_id, p_expected_status, p_reason)`                              | per OQ-9 (recommend A only) |                                                                                                     | `{ status, paymentStatus, refundStatus }`                                                                                                                     | as above                                                                                   |
| `set_store_status(p_is_open bool, p_is_accepting_orders bool)`                             | S(MO), A                    |                                                                                                     | `store_settings` row                                                                                                                                          | `FORBIDDEN`                                                                                |
| `set_menu_item_sold_out(p_menu_item_id, p_is_sold_out)`                                    | S(MO), A                    |                                                                                                     | `{ id, isSoldOut }`                                                                                                                                           | `FORBIDDEN`, `NOT_FOUND`                                                                   |
| `admin_reorder_categories(p_ids uuid[])`                                                   | A                           |                                                                                                     | `{ updated }`                                                                                                                                                 | `FORBIDDEN`, `INVALID_INPUT`                                                               |
| `admin_set_stamp_policy(...)`                                                              | A                           | earn mode, stamps/amount, basis, timing                                                             | new `stamp_policies` row                                                                                                                                      | `FORBIDDEN`, `INVALID_INPUT`                                                               |
| `admin_issue_point_codes(p_amount, p_quantity, p_expires_on date, p_memo)`                 | A                           |                                                                                                     | `{ batchId, codes:[{ id, code }] }` (codes generated with `gen_random_bytes`, retry on unique clash)                                                          | `FORBIDDEN`, `INVALID_INPUT`                                                               |
| `admin_void_point_code(p_code_id)`                                                         | A                           | only `UNUSED` codes (registered codes: deferred, OQ-31)                                             | `{ status }`                                                                                                                                                  | `FORBIDDEN`, `CODE_ALREADY_REGISTERED`                                                     |
| `admin_list_point_codes(p_status, p_search, p_limit, p_offset)`                            | A                           |                                                                                                     | store `PointCode[]` (`remaining` derived) + `{ issued, used, remaining }` totals                                                                              | `FORBIDDEN`                                                                                |
| `admin_sales_summary(p_from date, p_to date)`                                              | A                           | KST business dates                                                                                  | `{ days:[{ date, sales, orderCount }], total, orderCount, averageAmount }` (SA-01/02; counted = payment PAID and status in PAID..COMPLETED, refunds excluded) | `FORBIDDEN`                                                                                |
| `admin_popular_items(p_from, p_to, p_limit)`                                               | A                           |                                                                                                     | `[{ name, quantity }]` (by `name_snapshot`)                                                                                                                   | `FORBIDDEN`                                                                                |
| `admin_stamp_overview()`                                                                   | A                           |                                                                                                     | `{ earnedThisMonth, exchangedCoupons, outstandingStamps }`                                                                                                    | `FORBIDDEN`                                                                                |
| `admin_list_orders(p_from, p_to, p_status, p_order_number, p_limit, p_offset)`             | A                           | SA-06                                                                                               | store `Order[]`                                                                                                                                               | `FORBIDDEN`                                                                                |
| `admin_list_members(p_search, p_limit, p_offset)`                                          | A                           | search = nickname or order number only                                                              | `[{ id, nickname, maskedEmail, maskedPhone, provider, joinedAt, orderCount, totalSpent, lastOrderAt }]`                                                       | `FORBIDDEN`                                                                                |
| `admin_get_member(p_member_id)`                                                            | A                           |                                                                                                     | member + `stampBalance`, `pointBalance`, `stampLedger[]`, `pointLedger[]`, `orders[]` (separate arrays, never merged)                                         | `FORBIDDEN`, `NOT_FOUND`                                                                   |
| `admin_list_staff()`                                                                       | A                           |                                                                                                     | store `StaffMember[]` (`email` from `auth.users`; staff email is not customer PII)                                                                            | `FORBIDDEN`                                                                                |
| `admin_update_staff(p_user_id, p_role, p_permissions, p_display_name, p_is_active)`        | A                           |                                                                                                     | updated row                                                                                                                                                   | `FORBIDDEN`, `NOT_FOUND`, `LAST_ADMIN`, `CANNOT_CHANGE_SELF_ROLE`                          |

Plain admin CRUD through RLS (no RPC): `menu_categories`, `menu_items` (archive = update `archived_at`),
`coupons`, `announcements`, `business_hours`, `store_settings` info columns, `coupon_point_policy`.

### 3.3 Internal functions (schema `private`, `service_role` / trigger only)

- `private.apply_payment_result(p_payment_id, p_outcome, p_provider_payment_id, p_amount, p_event_id, p_source)`:
  the **single** place a payment changes state. Locks `payments` then `orders` `for update`. Idempotent:
  - already in the target state → return `DUPLICATE` (no side effects);
  - `APPROVED` and `amount <> payments.amount` → payment `FAILED` (`AMOUNT_MISMATCH`), order `CANCELLED`, release holds,
    request provider cancel;
  - `APPROVED` and order still `PENDING_PAYMENT` → payment `PAID`, order `PAID` (number assigned, `stamp_policy_id`
    set), coupon `RESERVED → USED`, point hold `CAPTURED` + USE ledger rows (FEFO), stamp earn if timing = `PAID`,
    notification `PAYMENT`, history row (SYSTEM);
  - `APPROVED` but order already `CANCELLED` (expired first) → payment `PAID`, then immediately enqueue a full refund
    (`refunds` REQUESTED) → see payment state machine; order stays `CANCELLED`;
  - `FAILED` / `CANCELLED` → payment `FAILED`/`CANCELLED`, order `CANCELLED`, coupon back to `AVAILABLE`, hold
    `RELEASED`.
- `private.expire_order(p_order_id)`: `PENDING_PAYMENT` past `expires_at` → order `CANCELLED` (reason `EXPIRED`),
  payment `CANCELLED`, releases coupon and hold. Never touches an order whose payment is not `READY`.
- `private.on_order_paid_or_progressed(order_id, to_status)`: stamp earn when `to_status` equals the order's policy
  timing (`earn:<order_id>` key makes retries no-ops); order notifications (`dedupe_key`).
- `private.reverse_order_rewards(p_order_id)`: on refund of a paid order: coupon `USED → AVAILABLE` (or per OQ-28),
  points `REFUND_RESTORE` rows back to the same lots, stamps `EARN_REVERSAL` if earned (OQ-29). All keyed, idempotent.
- `private.record_refund_result(p_refund_id, p_succeeded, p_provider_refund_id, p_message)`: updates refund and
  payment status (`REFUNDED` / `PARTIAL_REFUNDED`); calls `reverse_order_rewards` on success.
- `private.expire_rewards()`: nightly; `AVAILABLE` coupons past `expires_at` → `EXPIRED`; point lots past expiry with
  remaining > 0 → `EXPIRE` ledger rows (OQ-30); `UNUSED` codes past expiry → `EXPIRED`.
- `private.mask_email(text)`, `private.mask_phone(text)`.
- `private.bootstrap_admin(p_email text)`: run manually by the operator (SQL editor / psql), see §7.

### 3.4 Edge Functions (`supabase/functions/`, Deno; shared code in `supabase/functions/_shared/`)

Provider boundary (`_shared/payments/provider.ts`):

```ts
export interface PaymentProvider {
  readonly id: string; // 'TEST' now
  prepare(input: {
    paymentId: string;
    amount: number;
    orderName: string;
    method: PaymentMethod;
    returnUrl: string;
  }): Promise<NextAction>;
  verifyApproval(input: {
    paymentId: string;
    providerPaymentKey: string;
    expectedAmount: number;
  }): Promise<ProviderResult>;
  lookup(input: { paymentId: string }): Promise<ProviderResult>; // recovery + reconciliation
  parseWebhook(request: Request): Promise<WebhookEvent>; // verifies signature, throws WEBHOOK_SIGNATURE_INVALID
  refund(input: {
    providerPaymentId: string;
    amount: number;
    idempotencyKey: string;
    reason: string;
  }): Promise<RefundResult>;
}
type NextAction =
  | { type: 'REDIRECT'; url: string } // hosted payment page (real PG target shape)
  | { type: 'TEST_SHEET'; checkoutToken: string } // TEST provider only
  | { type: 'NONE' }; // amount 0 (OQ-18)
type ProviderResult = {
  status: 'APPROVED' | 'PENDING' | 'FAILED' | 'CANCELLED';
  providerPaymentId: string | null;
  amount: number | null;
  failureCode: string | null;
};
```

The provider is chosen by env `PAYMENT_PROVIDER` (server secret). Clients only ever see `NextAction`, `paymentId` and
statuses, so swapping TEST for a real PG that offers a hosted payment page (REDIRECT) needs no client change. A PG that
requires a native SDK would need client work (OQ-20).

| Function             | Auth                                                                           | Input                                                                                                                                                                                                                              | Output                                                                                                                                                                                                                                                                                                                                              | Errors                                                                                             |
| -------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `payments-checkout`  | customer JWT                                                                   | Zod `CheckoutRequest`: `{ clientRequestId, orderType, lines[], userCouponId                                                                                                                                                        | null, pointsToUse, paymentMethod, note                                                                                                                                                                                                                                                                                                              | null }`                                                                                            | `{ orderId, paymentId, amount, nextAction, isReplay }`. Calls `create_checkout_order` as the user, then `provider.prepare`. Replays return the same `nextAction` | RPC errors, `INVALID_INPUT` (400), `PAYMENT_PROVIDER_UNAVAILABLE` (502)                                                           |
| `payments-confirm`   | customer JWT (own payment)                                                     | `{ paymentId, providerPaymentKey }`                                                                                                                                                                                                | `{ orderId, orderStatus, paymentStatus, orderNumber }`                                                                                                                                                                                                                                                                                              | `NOT_FOUND`, `PAYMENT_NOT_APPROVED`, `PAYMENT_AMOUNT_MISMATCH`, `PAYMENT_EXPIRED` (refund started) |
| `payments-status`    | customer JWT                                                                   | `{ paymentId }` or `{ orderId }`                                                                                                                                                                                                   | same as confirm. If the payment is `READY` and older than 30 s, calls `provider.lookup` and applies the result (interrupted-flow recovery, PRD 7.3)                                                                                                                                                                                                 | `NOT_FOUND`                                                                                        |
| `payments-webhook`   | none (provider signature, HMAC with `PAYMENT_WEBHOOK_SECRET`)                  | provider payload                                                                                                                                                                                                                   | `200 { received: true }` always after signature check (duplicates included)                                                                                                                                                                                                                                                                         | `401` bad signature                                                                                |
| `payments-reconcile` | service role / cron                                                            | none                                                                                                                                                                                                                               | `{ checked, applied, expired, refundsRetried }`: `READY` payments older than TTL → lookup → apply or expire; `REQUESTED`/`FAILED` refunds → retry                                                                                                                                                                                                   | none                                                                                               |
| `payments-refund`    | admin JWT, or internal call after REJECT / cancel                              | `{ orderId, reason }`                                                                                                                                                                                                              | `{ refundId, refundStatus, paymentStatus }`                                                                                                                                                                                                                                                                                                         | `FORBIDDEN`, `NOT_REFUNDABLE`, `REFUND_FAILED`                                                     |
| `payments-test-pg`   | **TEST only**; refuses unless `PAYMENT_PROVIDER=TEST` and `ALLOW_TEST_PG=true` | `{ checkoutToken, scenario }` with scenario `SUCCESS`, `FAIL`, `CANCEL`, `SUCCESS_WEBHOOK_ONLY` (simulates app killed after approval), `SUCCESS_DUPLICATE_WEBHOOK`, `SUCCESS_LATE` (approve after order expiry), `AMOUNT_MISMATCH` | `{ result: 'APPROVED'                                                                                                                                                                                                                                                                                                                               | 'FAILED'                                                                                           | 'CANCELLED', providerPaymentKey                                                                                                                                  | null }`; writes `test_pg.transactions`and posts a signed webhook to`payments-webhook` (once, or twice for the duplicate scenario) | `TEST_PG_DISABLED` (403) |
| `admin-staff`        | admin JWT                                                                      | `{ action: 'INVITE', email, displayName, role, permissions }`                                                                                                                                                                      | `{ userId }`: `auth.admin.inviteUserByEmail` + `staff_members` insert                                                                                                                                                                                                                                                                               | `FORBIDDEN`, `ALREADY_STAFF`, `INVALID_INPUT`                                                      |
| `account-delete`     | customer JWT                                                                   | `{ confirm: true }`                                                                                                                                                                                                                | `{ deleted: true }`: cancels the caller's `PENDING_PAYMENT` orders, refuses if an order is `PAID`..`READY` (`ACTIVE_ORDER_EXISTS`), writes `FORFEIT` rows for stamps and points, voids coupons, sets `profiles.deleted_at`, then `auth.admin.deleteUser` (profile cascade; orders/ledgers keep rows with `user_id` null). Exact retention per OQ-34 | `ACTIVE_ORDER_EXISTS`                                                                              |

TEST checkout UX: on `TEST_SHEET` the mobile app shows an in-app "테스트 결제" sheet (clearly labelled as test) with
승인 / 실패 / 취소 buttons (and, in dev builds only, the extra scenarios). It calls `payments-test-pg`, then
`payments-confirm` with the returned key (skipped for `SUCCESS_WEBHOOK_ONLY`, which then resolves through the
webhook and `payments-status`). On `REDIRECT` the app opens the URL in an auth session and resumes on the
`theolive://payment/return?paymentId=...` deep link (scheme already set in `app.json`), then calls `payments-confirm`.
Neither path treats the client-side result as proof: the order is paid only when `apply_payment_result` says so.
Secrets (`PAYMENT_WEBHOOK_SECRET`, future PG keys, service role) exist only as Edge Function secrets.

---

## 4. State machines (PRD §7)

### 4.1 Order status (`orders.status`), enforced only in SQL

| From → To                            | Trigger                                                          | Who                        | Side effects                                                                                                               |
| ------------------------------------ | ---------------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| (new) → `PENDING_PAYMENT`            | `create_checkout_order`                                          | CUSTOMER                   | coupon `RESERVED`, point hold `HELD`, payment `READY`                                                                      |
| `PENDING_PAYMENT` → `PAID`           | `apply_payment_result(APPROVED)`                                 | SYSTEM                     | order number, coupon `USED`, hold `CAPTURED` + ledger USE, stamp earn if timing `PAID`, appears on Store Web, notification |
| `PENDING_PAYMENT` → `CANCELLED`      | payment `FAILED`/`CANCELLED`, expiry, or `customer_cancel_order` | SYSTEM / CUSTOMER          | coupon `AVAILABLE`, hold `RELEASED` (no ledger rows)                                                                       |
| `PAID` → `ACCEPTED`                  | `staff_transition_order(ACCEPT)`                                 | STAFF(PO), ADMIN           | stamp earn if timing `ACCEPTED`, notification                                                                              |
| `PAID` → `REJECTED`                  | `staff_transition_order(REJECT)` with reason                     | STAFF(PO), ADMIN           | full refund requested (OQ-10 recommends automatic), rewards reversed on refund success, notification                       |
| `PAID` → `CANCELLED`                 | `customer_cancel_order` (if OQ-8 allows) or `staff_cancel_order` | CUSTOMER / ADMIN           | full refund, rewards reversed                                                                                              |
| `ACCEPTED` → `PREPARING`             | `START_PREPARING`                                                | STAFF(PO), ADMIN           | notification                                                                                                               |
| `ACCEPTED` → `CANCELLED`             | `staff_cancel_order` with reason                                 | per OQ-9 (recommend ADMIN) | full refund, rewards reversed                                                                                              |
| `PREPARING` → `READY`                | `MARK_READY`                                                     | STAFF(PO), ADMIN           | notification ("준비 완료")                                                                                                 |
| `READY` → `COMPLETED`                | `COMPLETE`                                                       | STAFF(PO), ADMIN           | stamp earn if timing `COMPLETED` (default), notification                                                                   |
| `COMPLETED`, `REJECTED`, `CANCELLED` | terminal                                                         |                            |                                                                                                                            |

Rules: every change writes `order_status_history` in the same transaction; `p_expected_status` must equal the
current status (`STALE_STATUS` otherwise, so two tablets cannot double-apply); repeating the same action on an order
already in its target status returns `{ isReplay: true }` without side effects; any other pair is
`INVALID_TRANSITION`. The table matches `ORDER_TRANSITIONS` in `apps/store/src/domain/orderTransitions.ts`; that TS
module moves to `packages/types` as display/validation only and a test asserts it equals the SQL table.
Payment-side failures never move a non-pending order. Customer-visible history hides `PENDING_PAYMENT` and
expired/failed checkouts (shown only on the checkout result screen).

### 4.2 Payment status (`payments.status`, mirrored to `orders.payment_status`)

| From → To                                                     | Trigger                                                                                                  |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| (new) → `READY`                                               | `create_checkout_order`                                                                                  |
| `READY` → `PAID`                                              | verified approval (confirm, webhook, status lookup or reconcile; first one wins, others are `DUPLICATE`) |
| `READY` → `FAILED`                                            | provider failure, amount mismatch                                                                        |
| `READY` → `CANCELLED`                                         | user cancel in the payment window, order expiry                                                          |
| `PAID` → `REFUNDED`                                           | refund of the full amount succeeded (reject, cancel, late approval after expiry)                         |
| `PAID` → `PARTIAL_REFUNDED` → `PARTIAL_REFUNDED` / `REFUNDED` | partial refund (state reserved; no MVP UI, OQ-22)                                                        |
| `FAILED`, `CANCELLED`, `REFUNDED`                             | terminal                                                                                                 |

A failed refund call leaves the payment `PAID` with a `refunds` row `FAILED`; `payments-reconcile` retries and Store
Admin shows "환불 확인 필요". `orders.status` and `payments.status` move independently (e.g. order `REJECTED` +
payment `PAID` while the refund is pending, then `REFUNDED`).

### 4.3 Payment edge cases, how the design handles them

| Case (PRD 7.3)                             | Handling                                                                                                                                           |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Double tap / network retry of checkout     | same `clientRequestId` → replay of the same order and payment; mobile generates one id per checkout attempt and keeps it until the result is known |
| Duplicate webhook / confirm + webhook race | `payment_events (provider, event_id)` unique + row locks in `apply_payment_result`; second call returns `DUPLICATE`                                |
| App killed after approval                  | webhook applies it; on relaunch `payments-status` (and order queries) return the server state; reconcile job covers lost webhooks                  |
| Approval arrives after order expired       | payment `PAID` then automatic full refund; order stays `CANCELLED`; customer notified                                                              |
| Amount tampering                           | approval amount checked against `payments.amount`; mismatch fails and cancels                                                                      |
| Payment fails                              | order `CANCELLED`, holds released, cart stays on device; retry = new checkout with a new `clientRequestId` (OQ-19)                                 |
| Item sold out after payment                | staff `REJECT` with reason `SOLD_OUT` → refund                                                                                                     |

---

## 5. Reward rules

Olive Stamps and Coupon Points have separate tables, balances, ledgers, RPCs, hooks, types and screens. No function
reads both balances except the two display-only summaries (`get_my_reward_summary`, `admin_get_member`), which return
them as separate fields.

### 5.1 Stamp earn

- Trigger: the order reaches the status equal to its snapshotted policy's `earn_timing`. The user brief and the
  current store fixture use `COMPLETED`; seed uses `COMPLETED`. Whether admins may change the timing is OQ-24.
- Amount: `PER_ORDER` → `stamps_per_order` (seed 1); `PER_AMOUNT` → `floor(basis / amount_per_stamp)` where basis is
  `menu_amount` or `paid_amount` per policy (OQ-23). Zero-stamp results write no row.
- Policy applied = `orders.stamp_policy_id`, captured at `PAID` ("이후 주문에 적용", SA-07).
- Idempotent: key `earn:<order_id>`; retrying the transition or replaying events cannot earn twice.
- Expiry: none in MVP (OQ-25).
- Ledger row label: `주문 적립`, linked `order_id`.

### 5.2 Reward coupon issuance (stamp exchange, RW-02, flow 6.4)

- `redeem_stamps_for_coupon`: lock `stamp_balances`; coupon definition must be active; balance `>= required_stamps`;
  insert `REDEEM` row (`-required_stamps`, label `쿠폰 교환`) and `user_coupons` row with snapshots and
  `expires_at = issued_at + valid_days` (seed 90). Key `redeem:<user_id>:<client_request_id>`.
- Use at checkout (RW-04, PAY-02): one coupon per order (OQ-27). Discount rule (OQ-26) recommendation:
  `FREE_ITEM` = the unit price of the most expensive eligible line, capped by `discount_amount` when set, customer
  pays any difference; `FIXED_AMOUNT` = fixed won off. The discount never exceeds `menu_amount`.
- Status lifecycle: `AVAILABLE → RESERVED → USED`, `RESERVED → AVAILABLE` (payment failed/expired),
  `AVAILABLE → EXPIRED` (nightly), any non-used → `VOID` (account deletion).

### 5.3 Coupon point code redemption (RW-05..08, flow 6.5)

- `register_coupon_point_code`: count the caller's failed attempts in the window → `TOO_MANY_ATTEMPTS`; normalize the
  code; lock the code row; check status `UNUSED`, not expired, not void; set `REGISTERED`, `registered_by`,
  `registered_at`; insert `REGISTER` ledger row (`+amount`, `code_id`, key `register:<code_id>`). The unique key makes a
  second registration impossible even under concurrency (the second caller gets `CODE_ALREADY_REGISTERED`). Every
  attempt is logged.
- Use at checkout: hold at order creation, capture at `PAID` as `USE` rows, earliest `expires_at` lot first, one row
  per lot. `RW-07` (cannot exceed balance) is enforced against `balance - held`.
- Policy limits (`min_use_amount`, `use_unit`, `max_use_per_order`, full coverage allowed) per OQ-30. Seed: no
  minimum, unit 1, no cap.
- Expiry of registered points per lot (OQ-30 recommendation: lot inherits the code's `expires_at`; nightly `EXPIRE`
  rows for the remainder).

### 5.4 Refund reversal (order `REJECTED` or `CANCELLED` after `PAID`, on refund success)

| Asset                                             | Rule (recommendation, decision in OQ list)                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Coupon used on the order                          | `USED → AVAILABLE` with the original `expires_at`; if already past expiry, restore as `EXPIRED`, unless the owner prefers a grace extension (OQ-28)                                                                                                                                                                                          |
| Points used                                       | `REFUND_RESTORE` rows back to the same lots (`refund_restore:<order_id>`); a lot already past expiry is restored and expired by the next nightly run (OQ-30)                                                                                                                                                                                 |
| Stamps earned                                     | With timing `COMPLETED` there is nothing to reverse (completed orders are not refunded in MVP). If timing is `PAID`/`ACCEPTED`: `EARN_REVERSAL` row for the earned amount; if the balance is now lower because the stamps were redeemed, reverse only what is available and log the shortfall in `admin_audit_log` (OQ-29 lists the options) |
| Stamps redeemed for a coupon that is later voided | not an MVP path                                                                                                                                                                                                                                                                                                                              |

Before payment (`PENDING_PAYMENT → CANCELLED`) nothing was captured, so only holds/reservations are released and no
ledger rows are written.

---

## 6. Realtime

Realtime is a hint to refetch, never the source of truth. Recommended mechanism: **Broadcast from the database**
(trigger calls `realtime.send(...)` with `private => true`) with RLS on `realtime.messages`, instead of
`postgres_changes`. Reasons: payloads stay minimal (ids and statuses only, no row data or PII), authorization is one
policy per topic, and it does not depend on per-row RLS checks of the WAL stream. Fallback if it misbehaves locally:
`postgres_changes` on `orders` (RLS-filtered) with the same refetch handling.

| Topic           | Subscribers (policy on `realtime.messages`, `extension = 'broadcast'`) | Events and payload                                                                                                         |
| --------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `store:orders`  | `private.has_staff_permission('PROCESS_ORDERS')`                       | `order_paid` (new order; plays the alert sound, SW-01/02), `order_updated` `{ orderId, status, paymentStatus, updatedAt }` |
| `store:catalog` | any authenticated                                                      | `menu_updated` `{ menuItemId }`, `store_status_updated` `{ isOpen, isAcceptingOrders }` (SW-07, SA-05)                     |
| `user:<uid>`    | `realtime.topic() = 'user:'                                            |                                                                                                                            | (select auth.uid())::text` | `order_updated` `{ orderId, status, paymentStatus }`, `notification_created` `{ id, kind }`, `reward_updated` `{ asset: 'STAMP' | 'POINT' | 'COUPON' }` |

Client rules (both apps):

- On every event: `queryClient.invalidateQueries` for the matching keys; do not patch caches from payloads.
- On channel `SUBSCRIBED` (including after reconnect), app foreground (mobile `AppState`), browser `online` and
  `visibilitychange`: refetch the board / active order / catalog (PRD 7.3, SW "재연결 후 동기화").
- Store Web also refetches the board every 30 s while visible, and shows the disconnected banner when the channel
  status is not `SUBSCRIBED` (existing `connectionStore` becomes channel status).
- Customer order-complete and order-detail screens refetch every 15 s while the order is not terminal, as a backstop.
- Checkout always re-validates sold-out/status on the server, so a missed catalog event can't produce a bad order.

---

## 7. Role bootstrap

- **Customers**: social sign-in via Supabase Auth (AUTH-01). `handle_new_user` creates the profile. No staff row.
  Provider setup is OQ-1..OQ-3 (Kakao, Google, Apple are Supabase Auth providers; Naver is not built in and needs a
  decision). Local dev keeps email/password sign-in for seeded test customers only.
- **First admin (production)**: there is no client path to become admin. The operator creates the owner account in
  the Supabase dashboard (invite by email), then runs `select private.bootstrap_admin('owner@example.com');` once in
  the SQL editor. The function refuses if any active admin already exists.
- **Local**: `seed.sql` creates the auth users (`auth.users` + `auth.identities` with known passwords) and their
  `staff_members` rows (§9).
- **More staff**: an admin uses Store Admin 직원 관리 → `admin-staff` Edge Function (`INVITE`): service role calls
  `auth.admin.inviteUserByEmail`, inserts `staff_members` with role and permissions. Locally the invite email lands in
  the local mail catcher. Staff sign in to Store Web with email + password (OQ-4).
- **Change / deactivate**: `admin_update_staff`. Deactivation takes effect on the next request because every policy
  reads `staff_members`. Optionally the Edge Function also bans the auth user so the session can't refresh. The last
  active admin cannot be demoted or deactivated; an admin cannot change their own role.
- **Route gating**: Store Web and Admin call `get_my_staff_role()` after sign-in: `/orders` requires `PROCESS_ORDERS`,
  quick store controls require `MANAGE_OPERATIONS`, `/admin` requires `ADMIN`. This is UX only; RLS/RPC checks are the
  boundary. Whether staff accounts may also use the customer app is OQ-5.

---

## 8. packages/api hooks, shared types and Zod schemas

All hooks take the injected `TypedSupabaseClient` (existing pattern in `packages/api/src/profiles.ts`) and live in one
file per domain (`menu.ts`, `orders.ts`, `checkout.ts`, `stamps.ts`, `coupons.ts`, `points.ts`, `notifications.ts`,
`announcements.ts`, `store.ts`, `staff.ts`, `admin.ts`, `realtime.ts`). Row → view-model mappers live next to the
fetchers and return the shapes the screens already consume (mobile `src/models`, store `src/domain/models.ts`,
`memberModels.ts`), so wiring replaces `fixtures/queries.ts` and `data/queries.ts` one hook at a time. Query keys are
added to `query-keys.ts`. Mutations invalidate the keys they affect; none applies optimistic money changes.

### 8.1 Customer app (`apps/mobile`)

| Hook                                                             | Backed by                                                                | Replaces fixture                                                       |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `useProfile`, `useUpdateNickname`                                | `profiles`                                                               | `useProfileQuery` (email/provider from the session user, own data)     |
| `useMenuCategories`, `useMenu`, `useMenuItem(id)`                | `menu_categories`, `menu_items`                                          | `useCategoriesQuery`, `useMenuQuery`, `useMenuItemQuery`               |
| `useStoreStatus`                                                 | `store_settings`, `business_hours`                                       | (new: closed/not-accepting banner)                                     |
| `useCheckoutQuote(lines, couponId, points)`                      | `quote_checkout`                                                         | `previewCheckoutAmounts` stays only as an instant preview              |
| `useCheckout()`                                                  | `payments-checkout` → `payments-test-pg` / redirect → `payments-confirm` | `submitFixtureOrder`                                                   |
| `usePaymentStatus(paymentId)`                                    | `payments-status`                                                        | (new: recovery on relaunch)                                            |
| `useMyOrders`, `useMyOrder(id)`, `useCancelOrder`                | `orders` + `order_items`, `customer_cancel_order`                        | `useOrdersQuery`, `useOrderQuery`                                      |
| `useRewardSummary`                                               | `get_my_reward_summary`                                                  | `useStampsQuery`, `usePointsQuery` (HOME-04)                           |
| `useStampLedger`, `useStampExchangeOptions`, `useRedeemStamps`   | `stamp_transactions`, `coupons`, `redeem_stamps_for_coupon`              | `useStampLedgerQuery`, `useStampExchangeQuery`, `requestStampExchange` |
| `useMyCoupons`                                                   | `user_coupons`                                                           | `useCouponsQuery`                                                      |
| `usePointLedger`, `useRegisterPointCode`                         | `coupon_point_transactions`, `register_coupon_point_code`                | `usePointLedgerQuery`, `registerPointCode`                             |
| `useNotifications`, `useMarkNotificationsRead`                   | `notifications`, `mark_notifications_read`                               | `useNotificationsQuery`                                                |
| `useNotificationPreferences`, `useUpdateNotificationPreferences` | `notification_preferences`                                               | `useNotificationPreferencesQuery`                                      |
| `useAnnouncements`, `useAnnouncement(id)`                        | `announcements`                                                          | `useNoticesQuery`                                                      |
| `useDeleteAccount`                                               | `account-delete`                                                         | `requestAccountDeletion`                                               |
| `useUserChannel()`                                               | realtime `user:<uid>`                                                    | (new)                                                                  |

Terms, inquiry channel and inquiries stay static content for now (OTH-04/06 have no backend in this plan).

### 8.2 Store Web (`apps/store` `/orders`)

`useStaffRole` (`get_my_staff_role`), `useBoardOrders` (orders `status in PAID..READY` plus today's terminal ones),
`useOrderDetail(id)`, `useTransitionOrder` (`staff_transition_order`, sends `expectedStatus`), `useSetStoreStatus`,
`useSetSoldOut`, `useStoreOrdersChannel` (realtime `store:orders`, exposes connection status for the banner),
`useCatalogChannel`. Replaces `useOrdersQuery`, `applyOrderAction`, `setStoreStatus`, `setItemSoldOut`,
`useConnection`.

### 8.3 Store Admin (`apps/store` `/admin`)

`useSalesSummary`, `usePopularItems`, `useAdminOrders(filters)`, `useAdminMenu`, `useAdminCategories`,
`useSaveMenuItem`, `useArchiveMenuItem`, `useSaveCategories`/`useReorderCategories`, `useUploadMenuImage`,
`useStampPolicy`, `useSetStampPolicy`, `useCouponDefinitions` (`exchangeRules`), `useSaveCouponDefinition`,
`useStampOverview`, `useIssuedCoupons`, `usePointCodes`, `useIssuePointCodes`, `useVoidPointCode`,
`useAnnouncementsAdmin`, `useSaveAnnouncement`, `useSetAnnouncementStatus`, `useDeleteAnnouncement`, `useStoreInfo`,
`useSaveStoreInfo`, `useBusinessHours`, `useSaveBusinessHours`, `useStoreNotificationSettings`, `useStaff`,
`useInviteStaff`, `useUpdateStaff`, `useMembers(search)`, `useMember(id)`. One-to-one with `data/queries.ts` and
`data/actions.ts`.

### 8.4 `packages/types`

- `supabase.ts` regenerated with `pnpm gen:types` (never hand-edited).
- `index.ts` exports `Tables<'…'>` aliases for every table, and `Enums<'…'>`.
- New `src/constants.ts`: const objects for every enum (`ORDER_STATUS`, `PAYMENT_STATUS`, `TEMPERATURE`,
  `ORDER_TYPE`, `PAYMENT_METHOD`, `STAFF_ROLE`, `STAFF_PERMISSION`, `STAMP_EARN_MODE`, `STAMP_EARN_TIMING`,
  `USER_COUPON_STATUS`, `POINT_CODE_STATUS`, `NOTIFICATION_KIND`, `ANNOUNCEMENT_STATUS`), each typed with
  `satisfies Record<string, Enums<'…'>>` so drift fails typecheck. Both apps import these instead of their local copies.
- `src/errors.ts`: `APP_ERROR` const + `AppErrorCode` type + `isAppErrorCode(value: unknown)` guard, plus the Korean
  user-facing message map.
- `src/orderTransitions.ts`: the transition table and `STAFF_ACTION` moved from `apps/store/src/domain`.
- `src/viewModels.ts`: the shared view-model types (Order, OrderLine, MenuItem, Coupon, ledger entries…) that both apps
  currently duplicate.

### 8.5 `packages/validation` (new workspace, listed in CLAUDE.md layout but not created yet)

Zod schemas, used by clients for forms and by Edge Functions for request validation:
`checkoutRequestSchema` (lines 1-20 qty, max 30 lines, uuid ids, `pointsToUse` int >= 0, note <= 100),
`paymentConfirmSchema`, `pointCodeInputSchema` (`OLIVE-XXXX-XXXX` after normalization), `stampExchangeSchema`,
`menuItemFormSchema` (moves `apps/store/src/domain/menuForm.ts` rules), `categorySchema`, `exchangeRuleSchema`
(moves `exchangeRule.ts`), `stampPolicySchema`, `pointIssueSchema` (moves `pointCodes.ts` limits),
`announcementSchema`, `storeInfoSchema`, `businessHoursSchema`, `staffInviteSchema`, `staffUpdateSchema`,
`nicknameSchema`. Limits are exported constants and the SQL checks use the same numbers (a test compares them).
Edge Functions import the schemas through a relative import map entry; if the Supabase bundler cannot resolve paths
outside `supabase/functions`, the fallback is a generated copy in `supabase/functions/_shared/validation.ts` checked by
a CI diff test. Verify in phase (a).

---

## 9. Migration breakdown and seed

New files only (the applied `20261022000000_create_profiles.sql` is never edited). Created with
`pnpm supabase migration new <name>`; timestamps below are placeholders for order. Each migration enables RLS and
writes the policies for every table it creates. **None is destructive** (no drop/rename).

| #   | Phase | Migration                         | Contents                                                                                                                                                                                                                                                                                                                               |
| --- | ----- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | a     | `foundation_enums_and_helpers`    | schemas `private`, `test_pg`; all enums; `set_updated_at`, `prevent_update_delete`; `admin_audit_log` + `audit_admin_change`; `mask_email`, `mask_phone`                                                                                                                                                                               |
| 2   | a     | `extend_profiles`                 | `nickname`, `created_at`, `deleted_at`, `updated_at` not null + trigger, column grants, `create or replace handle_new_user`                                                                                                                                                                                                            |
| 3   | a     | `staff_members_and_roles`         | `staff_members`, role helpers, `get_my_staff_role`, `admin_list_staff`, `admin_update_staff`, `bootstrap_admin`                                                                                                                                                                                                                        |
| 4   | b     | `store_settings`                  | `store_settings`, `business_hours`, `set_store_status`                                                                                                                                                                                                                                                                                 |
| 5   | b     | `menu`                            | `menu_categories`, `menu_items`, bucket `menu-images` + storage policies, `set_menu_item_sold_out`, `admin_reorder_categories`, audit triggers                                                                                                                                                                                         |
| 6   | c     | `orders`                          | `orders` (without `user_coupon_id`), `order_items`, `order_status_history`, `order_number_counters`, `next_order_number`                                                                                                                                                                                                               |
| 7   | c     | `payments`                        | `payments`, `payment_events`, `refunds`, `test_pg.transactions`                                                                                                                                                                                                                                                                        |
| 8   | c     | `order_and_payment_functions`     | `quote_checkout`, `create_checkout_order` (no coupon/points yet: rejects non-null coupon / points > 0), `apply_payment_result`, `expire_order`, `staff_transition_order`, `staff_cancel_order`, `customer_cancel_order`, `record_refund_result`, `admin_list_orders`                                                                   |
| 9   | c     | `realtime_broadcast`              | broadcast triggers on `orders`, `menu_items`, `store_settings`; `realtime.messages` policies                                                                                                                                                                                                                                           |
| 10  | c     | `scheduled_jobs`                  | `pg_cron` jobs: expire stale orders (every minute), call `payments-reconcile` (every 5 min via `pg_net`), `expire_rewards` (daily 00:05 KST). Needs approval (OQ-38)                                                                                                                                                                   |
| 11  | d     | `stamps_and_coupons`              | `stamp_policies`, `stamp_balances`, `stamp_transactions` + ledger trigger, `coupons`, `user_coupons`, `alter table orders add user_coupon_id, stamp_policy_id`, `redeem_stamps_for_coupon`, `admin_set_stamp_policy`, `admin_stamp_overview`, `create or replace` checkout/payment functions to handle coupons and stamp earn/reversal |
| 12  | e     | `coupon_points`                   | `coupon_point_policy`, batches, codes, balances, transactions + trigger, holds, attempts, `register_coupon_point_code`, `admin_issue_point_codes`, `admin_void_point_code`, `admin_list_point_codes`, `create or replace` checkout/payment functions for holds/capture/restore                                                         |
| 13  | f     | `notifications_and_announcements` | `notifications`, `notification_preferences`, `announcements`, notification triggers, `mark_notifications_read`, `get_my_reward_summary`                                                                                                                                                                                                |
| 14  | f     | `admin_reporting_and_members`     | `admin_sales_summary`, `admin_popular_items`, `admin_list_members`, `admin_get_member`                                                                                                                                                                                                                                                 |

Edge Functions by phase: (a) `admin-staff`, `account-delete`; (c) `payments-checkout`, `payments-confirm`,
`payments-status`, `payments-webhook`, `payments-reconcile`, `payments-refund`, `payments-test-pg`.

**Seed (`supabase/seed.sql`, local only, deterministic uuids)**

- `store_settings` row (fixture `createStoreInfo`, open + accepting, TTL 15, notification flags) and 7
  `business_hours` rows (fixture `createHours`).
- 5 categories and 7 menu items from `apps/mobile/src/fixtures/data.ts` (prices, temperatures; 바닐라 라떼 sold out),
  plus the store fixture extras if any differ.
- Auth users (email/password, local only): `admin@theolive.local` (ADMIN), `staff@theolive.local` (STAFF,
  PROCESS_ORDERS + MANAGE_OPERATIONS), `barista@theolive.local` (STAFF, PROCESS_ORDERS only),
  `inactive@theolive.local` (STAFF, inactive), `customer1@theolive.local`, `customer2@theolive.local`. Passwords are
  documented local test values, never reused remotely.
- Stamp policy (PER_ORDER, 1 stamp, basis MENU_AMOUNT, timing COMPLETED); coupons 10 stamps "아메리카노 또는 라떼
  쿠폰" (FREE_ITEM over americano/latte, 90 days) and 15 stamps "전체 음료 쿠폰" (FREE_ITEM over drink categories,
  90 days).
- Coupon point policy defaults; one batch with 3 `UNUSED` codes, one expired code, one code registered by
  customer1 (via the RPC call inside the seed so the ledger is consistent).
- customer1: 7 stamps (earned through completed seed orders created with the same internal functions), 1 available
  coupon. customer2: empty (empty states).
- 3 announcements (2 published, 1 unpublished, from `createNotices`).
- No seeded payments other than those produced by seed orders through `apply_payment_result` with provider `TEST`.

Commands for implementation (approved locally only): `pnpm supabase start`, `pnpm supabase db reset`,
`pnpm gen:types`, `pnpm supabase test db`, `pnpm supabase functions serve`, `pnpm typecheck`.

---

## 10. Phased implementation order (vertical slices)

Each slice ends with: migration(s) applied via `db reset`, types regenerated, pgTAP tests for the slice, hooks wired,
fixtures for that slice deleted, `pnpm lint/typecheck/test` green, and the screens checked in simulator / browser.

**(a) Auth and roles.** Migrations 1-3, `admin-staff`, `account-delete`. Store app gets a sign-in page and
`useStaffRole` gating for `/orders` and `/admin`. Mobile keeps the existing session flow (`LargeSecureStore`); social
providers are configured only after OQ-1..3 are answered (local uses email/password test users). Also: create
`packages/validation`, move shared constants into `packages/types`, verify Edge Function import of validation.
Exit: RLS role tests pass; inactive staff and customers are denied staff/admin data.

**(b) Menu read + admin menu CRUD.** Migrations 4-5. Mobile menu/category/detail hooks; Store Admin menu, categories,
images, store info/hours; Store Web sold-out and store-status toggles. Exit: SA-03/04/05, SW-07/08, ORD-01/03/04/09.

**(c) Cart → order → test payment → Store Web → customer status.** Migrations 6-10 and the payment Edge Functions.
Checkout without coupons/points first. Mobile checkout, test payment sheet, complete screen, history/detail;
Store Web board, transitions, reject with reason + auto refund, realtime + refetch; customer realtime + refetch.
Exit: PAY-01, 05, 06, 07, ORD-05..08, SW-01..06, OTH-01/02, all §11.3 payment cases.

**(d) Stamps and coupons.** Migration 11. Earn on completion, exchange, coupon at checkout, reversal on refund, admin
stamp policy and coupon definitions, overview. Exit: RW-01..04, PAY-02, SA-07.

**(e) Coupon points.** Migration 12. Admin issue/list/void codes; customer register, balance, ledger, use at checkout
with holds; refund restore. Exit: RW-05..08, PAY-03, SA-08.

**(f) Notices, settings, sales, members.** Migrations 13-14. Notifications list and preferences, announcements,
dashboard sales, order history search, 회원관리. Exit: HOME-01/02/04, OTH-03/05, SA-01/02/06/09/10/12.

---

## 11. Test plan

Tools: pgTAP via `pnpm supabase test db` (`supabase/tests/database/*.test.sql`), running each case as a specific
seeded user with `set local role authenticated` + `request.jwt.claims`. Edge Function integration tests (Vitest, in a
new `supabase/tests/integration` package or `packages/api`) against the local stack with real test-user sessions.
Requirement IDs go in test names.

### 11.1 RLS allowed / denied (one test per cell)

- customer1 reads own orders, items, history, ledgers, coupons, holds, notifications; **denied** for customer2's rows,
  for `payment_events`, `coupon_point_codes`, batches, attempts, `admin_audit_log`, other profiles and `staff_members`.
- customer cannot: insert/update orders, items, payments, ledgers, user_coupons, balances; update `profiles.deleted_at`
  or another profile; update `notifications` other than own `is_read`; read inactive / archived menu items or
  unpublished announcements; call any `admin_*` / `staff_*` RPC (`FORBIDDEN`).
- staff with PROCESS_ORDERS: reads `PAID`..terminal orders, never `PENDING_PAYMENT`; can transition; cannot toggle
  sold-out or store status (barista). Staff with MANAGE_OPERATIONS: can toggle `is_sold_out` and store status, cannot
  change price/name (column grant) or any other `store_settings` column.
- inactive staff: denied everything staff-only, immediately after deactivation in the same session.
- admin: full admin CRUD; `admin_list_members` returns masked email/phone only (assert no raw value appears in the
  result); can't deactivate the last admin or change own role.
- anon: denied on every table (except public `menu-images` objects).
- realtime: customer1 can join `user:<own id>`, not `user:<customer2>` nor `store:orders`; barista can join
  `store:orders`.
- ledgers: UPDATE/DELETE raise `APPEND_ONLY` even for admin and `service_role` paths through the API.

### 11.2 Order state transitions

- every valid edge in §4.1 by an allowed actor succeeds and writes exactly one history row;
- every invalid pair (full 8×8 matrix minus valid edges) returns `INVALID_TRANSITION`;
- wrong actor (customer accepting, barista cancelling per OQ-9) → `FORBIDDEN`;
- `STALE_STATUS` when `expected_status` differs (two tablets);
- repeated same action → `isReplay`, no extra history, no extra stamps/notifications;
- `PENDING_PAYMENT` expiry releases coupon and hold, writes no ledger rows;
- order number sequence per business day, assigned only at `PAID`, no gaps from abandoned checkouts, KST midnight
  rollover;
- TS transition table equals the SQL table (unit test in `packages/types` against a fixture exported from SQL tests).

### 11.3 Payment edge cases (integration, TEST provider)

success (confirm path); success via webhook only (app killed) + `payments-status` recovery; failure; user cancel;
duplicate webhook (`SUCCESS_DUPLICATE_WEBHOOK`); confirm + webhook concurrently (`Promise.all`), exactly one apply;
checkout replay with the same `clientRequestId` (same order) and with a changed body (`IDEMPOTENCY_CONFLICT`);
double-tap (two parallel checkouts, same key → one order); approval after expiry → auto refund, order stays
`CANCELLED`; amount mismatch → failed and cancelled; reject after payment → refund → `REFUNDED`, coupon/points restored;
refund provider failure → `FAILED` refund, reconcile retries; sold-out or closed store at checkout; client-sent prices
ignored (request body with extra price fields is rejected or ignored, totals equal server prices); zero-amount order
behavior per OQ-18; `payments-test-pg` refuses when `ALLOW_TEST_PG` is not set; webhook with a bad signature → 401 and
no state change. Assert in each case: order status, payment status, ledger sums = balances, holds resolved.

### 11.4 Rewards

stamp earn once on COMPLETED (retry, replay); none on REJECTED/CANCELLED; PER_AMOUNT floor math and zero result; policy
change applies only to orders paid after it; exchange success, insufficient stamps, inactive rule, replay; coupon
use, reservation release on failure, expiry, restore on refund (expired / not expired); code register success,
invalid, duplicate by self and by another user, concurrent double registration (one wins), expired, void,
`TOO_MANY_ATTEMPTS` and window reset; points use within balance, exceed balance, exceed payable, concurrent checkouts
competing for the same balance (holds prevent overspend), FEFO across two lots, refund restore to the same lots, lot
expiry; account deletion forfeits and voids; invariant check `balance = sum(ledger)` after every test.

### 11.5 Client

Hook unit tests with a mocked client for mapping and error-code handling; mobile Maestro flow for order → test payment
→ status (phase c), and store Playwright flow for the board (if qa-validator adds it). Realtime reconnect: kill the
channel and assert a refetch happens (unit) and a manual local test (stop/start realtime container) is reported.

---

## 12. Open questions for the user

Each item lists options and a recommendation. Nothing here is decided; the design keeps each one configurable or
isolated in one function so the answer does not reshape the schema.

### Auth and accounts

- **OQ-1 Naver login.** Naver is not a built-in Supabase Auth provider (the local `config.toml` provider list has no
  `naver`). Options: (a) custom OIDC/OAuth provider if available on the chosen Supabase plan (verify); (b) an Edge
  Function that verifies the Naver token and creates/links the Supabase user server-side; (c) ship MVP with Kakao,
  Google, Apple and add Naver later. Recommend (c) unless Naver is a launch requirement, then (a) after verification.
- **OQ-2 Kakao/Google/Apple profile data.** Which scopes to request: nickname only, or also email / phone? Recommend
  nickname + email only; no phone (see OQ-36). Kakao support and email availability must be verified against the
  Kakao developer app settings.
- **OQ-3 Email/password for customers.** Recommend local/dev only, disabled in production.
- **OQ-4 Staff sign-in method.** Recommend email + password via admin invite (needs production SMTP); alternative:
  social login for staff too.
- **OQ-5 Can a staff/admin account also order as a customer?** Recommend separate accounts (staff accounts are
  rejected by the customer app sign-in), simpler RLS and cleaner sales data.
- **OQ-6 Staff visibility of customer identity.** Should the board show a customer nickname for pickup calls, and may
  staff (non-admin) open 회원관리? Recommend order number only on the board; 회원관리 admin-only (DECISIONS deferral).
- **OQ-7 Roles and permissions.** Is `ADMIN` + `STAFF` with `PROCESS_ORDERS` / `MANAGE_OPERATIONS` enough, may there
  be more than one admin, and does MANAGE_OPERATIONS mean exactly sold-out + open/accepting toggles? Recommend yes to
  all three.

### Orders

- **OQ-8 Customer cancellation (PRD 15-9).** Options: (a) only before payment; (b) also while `PAID` (before staff
  accept), with automatic refund; (c) never after payment. Recommend (b).
- **OQ-9 `ACCEPTED → CANCELLED`.** Who may do it and when? Recommend admin only, with a reason, automatic refund.
- **OQ-10 Rejection (PRD 15-8, 7.1).** Reason codes (recommend `SOLD_OUT`, `CLOSING`, `TOO_BUSY`, `OTHER` + free
  text) and refund: automatic full refund (recommended) vs admin-confirmed refund.
- **OQ-11 Business hours enforcement.** (a) hours are display-only, the manual `is_open` / `is_accepting_orders`
  toggles decide (recommended for MVP); (b) server also rejects orders outside hours.
- **OQ-12 Dine-in table/seat number (PRD 15-7).** Recommend none.
- **OQ-13 Order number format.** Recommend `A-<n>` restarting at 1 each KST business day, assigned at payment
  (no gaps from abandoned checkouts).
- **OQ-14 Unpaid checkout lifetime.** Recommend 15 minutes, admin-configurable.
- **OQ-15 Uncollected orders.** Should `READY` orders auto-complete after N hours (affects stamp earn timing)?
  Recommend no auto-complete in MVP; admin sees a "미수령" filter.
- **OQ-16 Items without temperature.** Fixtures give 플레인 스콘 HOT/ICE. Recommend allowing an empty temperature set
  for non-drinks (order line temperature null).
- **OQ-17 Order note (ORD-10, P1).** Include in MVP? Max length (recommend 100)?

### Payment

- **OQ-18 Zero-amount orders** (fully covered by coupon and/or points). Recommend allow, confirmed server-side with
  method `NONE` and no PG call.
- **OQ-19 Retry after payment failure.** Recommend: failed attempt cancels the order and releases holds; retry
  creates a new order (cart kept on device). Alternative: retry on the same order within its TTL.
- **OQ-20 PG integration shape.** The design guarantees no client change only for PGs with a hosted payment page /
  redirect. If the chosen PG needs a native SDK, the client will change. Please weigh this when choosing the PG.
- **OQ-21 Payment method list before a PG exists.** Recommend showing the four methods labelled "테스트 결제" in
  dev builds only.
- **OQ-22 Partial refunds.** Recommend out of MVP (status kept for later).

### Rewards

- **OQ-23 Stamp earn basis (PRD 15-1).** Per order vs per amount; if per amount, on menu amount or paid amount;
  excluded items (e.g. desserts); do zero-amount or coupon-paid orders earn? Recommend 1 stamp per completed order,
  any items, including coupon/point-paid orders.
- **OQ-24 Stamp earn timing (PRD 15-2).** Brief says completion. Confirm `COMPLETED`, and whether admins may change it
  (the current admin UI exposes PAID/ACCEPTED/COMPLETED). Recommend fixed at `COMPLETED`, hide the selector.
- **OQ-25 Stamp expiry.** Recommend none.
- **OQ-26 Coupon value (PRD 15-4).** (a) FREE_ITEM: one eligible item free, capped at a set amount, customer pays the
  difference (recommended); (b) fixed won amount. Which items count as "아메리카노 또는 라떼" and "전체 음료"?
- **OQ-27 Coupon stacking (PRD 15-3).** Recommend one coupon per order; coupon + points together allowed.
- **OQ-28 Coupon restore on refund if already expired.** Restore as expired (recommended) vs extend N days.
- **OQ-29 Stamp reversal when earned stamps were already redeemed** (only if timing is not COMPLETED). Options:
  reverse what is available and log the shortfall (recommended), allow a negative balance, or void the issued coupon.
- **OQ-30 Points use and expiry (PRD 15-5).** Minimum use, unit, per-order cap, can points cover 100%, do registered
  points expire with the code's expiry date, restore rule on refund. Recommend: no minimum, 1-won unit, no cap, 100%
  allowed, points expire with the code (earliest-expiring used first), restore to the original lot.
- **OQ-31 Code issuance (PRD 15-6).** Who issues (admin only?), limits (fixture: 1,000-100,000 won, max 50 per batch),
  reissue policy, voiding registered codes. Recommend admin only, keep fixture limits, void only unregistered codes.
- **OQ-32 Brute-force limit for code entry.** Recommend 5 failures per 10 minutes per account.
- **OQ-33 Manual stamp/point adjustments.** Confirm they stay out of MVP (DECISIONS 2026-11-05).

### Data retention and privacy

- **OQ-34 Account deletion (PRD 15-12, AUTH-04).** Recommend: rewards forfeited (ledger `FORFEIT` rows), coupons
  voided, profile and auth user deleted, orders/payments kept with the customer link removed for the legally
  required period (period to be confirmed by the owner/accountant). Block deletion while an order is in progress.
- **OQ-35 Retention of technical logs.** `payment_events` payloads, `admin_audit_log`, code attempts,
  notifications: recommend 1 year for attempts/notifications, payment events and audit logs with the order
  retention period.
- **OQ-36 Phone numbers.** Collect at all? Recommend no (회원관리 then shows no phone).

### Notifications, infrastructure, naming

- **OQ-37 Push notifications (PRD 15-11).** Recommend in-app list only for MVP; push later.
- **OQ-38 `pg_cron` / `pg_net`** (Supabase-bundled extensions) for expiry and reconciliation jobs. Recommend approve;
  alternative is lazy expiry on reads plus a manually triggered reconcile.
- **OQ-39 Realtime mechanism.** Broadcast-from-database with private channels (recommended) vs `postgres_changes`.
- **OQ-40 `profiles.username`.** Leave unused (recommended) or drop later (destructive; needs a data plan).
- **OQ-41 Menu "삭제".** Recommend archive (hidden, kept for history, PRD 9.1) instead of the current fixture's hard
  delete; the admin UI label stays "삭제".
