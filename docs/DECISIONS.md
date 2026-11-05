# Decisions

## 2026-11-05: Store Admin 회원관리 is view-only with masked PII; suspend/adjust deferred

- **Decision:** Store Admin gets a 회원관리 page (`/admin/members`, detail `/admin/members/:memberId`) that is view-only. It shows nickname, masked email, masked phone, login provider, join date, order history, and separate Olive Stamp and Coupon Point balances/ledgers. No suspend/reactivate, edit, delete, or manual stamp/point adjustment.
- **Reason:** Privacy: minimal, masked personal data limits exposure. Suspending members or adjusting stamp/point balances changes reward rules and ledgers (append-only, server-owned), which needs an owner decision on policy (PRD 15) before any UI exists.
- **Constraints:** Masking in the client is a display convention, not a privacy boundary. The server must return pre-masked data and enforce owner-only access (RLS + server authz). The UI "owner-only" label is not a security boundary. Search covers nickname and order number only, never email or phone.
- **Deferred / open:** member suspension, manual adjustments (with ledger reversal entries), member deletion and data-retention rules (PRD 15-12), whether staff accounts may see this page.
- **Requirement:** PRD SA-12 (P1).

## 2026-11-05: Backend contract proposals (Proposed 2026-11-05; approved, see below)

All entries below come from `docs/plans/backend-integration.md` and were proposed pending approval. **Approved 2026-11-05 (user): P1–P6 and plan recommendations OQ-1..OQ-41 as written** (stamps 1 per COMPLETED order; customers may cancel while PAID before staff accepts, with automatic refund; launch logins Kakao, Google, Apple, Naver later, email/password local/dev only). Implementation proceeds phase by phase. Open policy items stay in that plan's §12 and are not decided here.

### P1. Test payment adapter behind a provider boundary — Proposed; **Approved 2026-11-05 (user)**

- **Decision:** Payments go through Edge Functions (`payments-checkout`, `payments-confirm`, `payments-status`, `payments-webhook`, `payments-reconcile`, `payments-refund`) using a `PaymentProvider` interface. The `TEST` provider (`payments-test-pg`, disabled unless `ALLOW_TEST_PG=true`) simulates success, failure, cancel, webhook-only, duplicate webhook, late approval and amount mismatch. Clients only see `nextAction` (`REDIRECT` / `TEST_SHEET` / `NONE`) and statuses.
- **Reason:** No PG is chosen; a real PG with a hosted payment page can replace TEST without client changes.
- **Constraints:** Confirm, webhook, lookup and reconcile all converge on one idempotent SQL function (`private.apply_payment_result`). A PG that needs a native SDK would require client work.

### P2. Order exists before payment; coupon and points are held, not spent — Proposed; **Approved 2026-11-05 (user)**

- **Decision:** Checkout creates a `PENDING_PAYMENT` order (server-priced, snapshotted items) with a `READY` payment, reserves the coupon and places a Coupon Point hold. On verified payment the coupon becomes `USED` and the hold is captured as ledger `USE` rows; on failure or expiry (15 min) both are released with no ledger rows. A failed payment cancels the order; retry is a new order.
- **Reason:** Prevents overspending a balance between order creation and payment, keeps ledgers free of reverted noise, and gives idempotency via `(customer_id, client_request_id)`.

### P3. Roles in a `staff_members` table, checked on every request — Proposed; **Approved 2026-11-05 (user)**

- **Decision:** `staff_members(role ADMIN|STAFF, permissions PROCESS_ORDERS|MANAGE_OPERATIONS, is_active)`. RLS uses `security definer` helpers that read this table (not JWT claims), so deactivation is immediate. First admin via operator-run `private.bootstrap_admin(email)`; later staff via the admin-only `admin-staff` Edge Function (invite). The last active admin cannot be removed.

### P4. Separate reward ledgers with balance projections — Proposed; **Approved 2026-11-05 (user)**

- **Decision:** `stamp_transactions` and `coupon_point_transactions` are append-only (trigger blocks UPDATE/DELETE), each with its own `*_balances` projection maintained by an insert trigger and a unique idempotency key. Coupon Points are tracked per code lot (earliest expiry used first). No table, function or balance is shared between the two assets. Stamp policy is versioned (`stamp_policies`, latest effective row applies; snapshot on the order at payment).

### P5. Realtime via database Broadcast, refetch as the source of truth — Proposed; **Approved 2026-11-05 (user)**

- **Decision:** Private broadcast topics `store:orders`, `store:catalog`, `user:<uid>` with RLS on `realtime.messages`; payloads carry ids and statuses only; clients invalidate and refetch on every event, on reconnect, on foreground, and on a polling backstop (30 s board, 15 s active order).

### P6. Naming and menu model — Proposed; **Approved 2026-11-05 (user)**

- **Decision:** Menu tables are `menu_categories` / `menu_items` (app vocabulary) with a `temperatures temperature[]` column instead of PRD `product_options`; order items snapshot `name_snapshot`, `temperature`, `quantity`, `unit_price`. PRD names are used for everything else. Menu "삭제" archives (`archived_at`) rather than deleting (PRD 9.1). Order numbers (`A-<n>`) are assigned at payment and restart each KST business day. `orders.payment_status` is a cache written only by payment functions; `payments` is authoritative.

## 2026-11-05: Phase (b) catalog decisions (menu, store status)

- **Decision:** Staff change only the two store switches and sold-out, through the `set_store_status` and `set_menu_item_sold_out` RPCs (MANAGE_OPERATIONS or admin); every other menu and settings write is an admin-only table write under RLS. Categories are never deleted, only deactivated (names are unique). Menu description max is 100 characters (matches the existing form). Business hours stay display-only (OQ-11).
- **Reason:** Narrow RPCs avoid column-level grants for staff; deactivation keeps order history references intact (OQ-41); one limit constant is shared by SQL and the Zod schemas (a test compares them).
- **Deferred / open:** a connectivity listener for mobile (`@react-native-community/netinfo`, needs approval) would replace the 10 s offline poll; category deletion if the owner wants it.

## 2026-11-05: Phase (c) orders and payments decisions (TEST payment gateway only)

- **Decision:** Orders are created by `create_checkout_order` (server-priced, snapshotted, idempotent per customer and `client_request_id`) and paid only when `private.apply_payment_result` records a verified provider result from confirm, webhook, status lookup or reconcile. Customers may cancel while unpaid or PAID (automatic full refund, OQ-8); only admins cancel an ACCEPTED order, with a reason (OQ-9); rejection reasons are `SOLD_OUT`, `CLOSING`, `TOO_BUSY`, `OTHER` + text (OQ-10) with an automatic refund; order numbers are `A-<n>` per KST day assigned at payment (OQ-13); an unpaid checkout lives 15 minutes (OQ-14); zero-amount orders are paid at once with method `NONE` (OQ-18). Staff see only orders with `paid_at`. A payment cancelled by expiry or by the customer can still be approved later: it is recorded as PAID and refunded, the order stays CANCELLED.
- **Reason:** One idempotent state-change function keeps duplicate callbacks, races and late approvals safe; refunds are decided in the same transaction as the order change and executed through `payments-refund` or the reconcile job.
- **Constraints:** The `TEST` provider and `payments-test-pg` are for development only (`ALLOW_TEST_PG=true`, never where real money moves). Choosing a real gateway, its supported methods and its integration shape (OQ-20) is still open and needs the owner. Coupons and points reuse the same contract in phases (d)/(e).

## 2026-11-05: Dependency approvals (user)

- **Decision:** Approved by the user: (1) keep the dev deps `@types/node` and `vitest` in `packages/validation`, `packages/api` and `packages/types`; (2) add `expo-web-browser` (Supabase OAuth now starts with `WebBrowser.openAuthSessionAsync` and hands the returned code to `(auth)/callback`); (3) add `@react-native-community/netinfo` (drives TanStack Query's `onlineManager` and the disconnected states).
- **Reason:** The in-app auth session returns the redirect to the app without relying on a deep link; NetInfo replaces the 10 s offline poll (`pollWhileOffline`, removed) so queries pause offline and refetch on reconnect.
- **Deferred / open:** None. Resolves the phase (b) deferred netinfo item.

## 2026-11-05: Olive Stamps and reward coupons (phase d, rules OQ-23..29 approved by the user)

- **Decision:** One stamp per order, earned when the order reaches COMPLETED (timing fixed in the schema, admin selector removed); no stamp expiry; one coupon per order, a coupon plus points is allowed; a coupon reserved at checkout becomes USED when the payment is verified and is released on failure, expiry or cancel; a full refund restores a used coupon (as EXPIRED if it ended meanwhile) and reverses the earned stamp (what is left; a shortfall is logged in `admin_audit_log`); FREE_ITEM discounts the most expensive eligible unit price up to an optional cap, FIXED_AMOUNT a fixed won amount, never above the menu amount; stamp policies are append-only versions, written only through `admin_set_stamp_policy`; exchange rules are never deleted, only deactivated.
- **Reason:** Server owns the truth: the discount, the paid amount and every balance come from the database; idempotency keys (`earn:<order>`, `redeem:<user>:<request>`, `earn_reversal:<order>`) make accrual, exchange and reversal safe to repeat.
- **Constraints:** Coupon Points (phase e) must not reuse any of these tables or functions. Stamp/coupon notifications are phase (f). Eligible categories/items of a new rule are not editable in the admin UI yet.

## 2026-11-05: Backend phase (e) Coupon Points: shape of the implementation (approved rules OQ-30..33)

- **Decision:** Coupon Points are implemented with the approved rules (no minimum, 1-won unit, no per-order cap, points may cover 100%; registered points end with the code and the earliest-ending lot is spent first; a refund restores the points to the same lots; admin-only issue, 1,000..100,000 won, at most 50 per batch, only unregistered codes can be voided; 5 failed entries per 10 minutes per account; no manual adjustments). Implementation choices inside those rules: (1) `register_coupon_point_code` RETURNS a rejection (`{status:'REJECTED', errorCode}`) instead of raising, because a raised error would roll back the failed-attempt row and the brute-force limit could never count; the app turns it into an error. A call blocked by the limit is not recorded, so the wait ends when the oldest failure leaves the window. (2) Codes are stored in clear (`coupon_point_codes.code`, admin-only RLS, per the plan) but never listed back: `admin_issue_point_codes` returns them once, `admin_list_point_codes` returns `OLIVE-••••-<last 4>`, and a full code typed by the admin finds its row. Audit rows never contain a code. (3) Spendable points exclude lots whose code has ended (`usable_points`); holds are counted against the balance under a row lock, so parallel checkouts cannot overspend; the nightly job skips a member with an open hold and writes one `EXPIRE` row per ended lot (a refund that restores points into an ended lot is expired again by the next run). (4) The quote clamps the requested points (balance, total after coupon, rules) and returns `pointsAvailable` and `maxPointsUsable`; checkout is strict and raises `POINTS_EXCEED_BALANCE` / `POINTS_EXCEED_PAYABLE` / `POINTS_BELOW_MINIMUM`. The app sends the amount the server quote applied.
- **Reason:** Server owns the truth; an attempt log that rolls back is useless; clear storage with masked listing keeps admin lookups possible without a second place where a full code can leak; holds + row lock make "no overdraft, ever" a database property.
- **Constraints:** Stamps, coupons and Coupon Points share no table, balance, ledger, function or enum (a pgTAP catalog check enforces it). Admin-edited use rules apply to later checkouts only. The member-detail point ledger in 회원관리 stays on fixtures until phase (f).

## 2026-11-05: Backend phase (f) account deletion never hard-deletes a profile; notifications and reporting shape

- **Decision:** (1) Deleting an account keeps the `profiles` row and the auth user but empties them (scrubbed nickname/avatar/username, emailless, passwordless, no identity or session, banned), forfeits rewards with FORFEIT rows on both separate ledgers, voids unused coupons, and retains orders/payments (still linked to the scrubbed profile). A profile with orders or ledger rows cannot be hard-deleted (a trigger refuses with `ACCOUNT_DELETE_REQUIRED`). (2) In-app notifications are written only by database triggers, one per source event, and only if the member's preference for that kind is on; `order_updates` covers order, payment, stamp, coupon and point messages, `notices` covers 공지. (3) Sales count paid orders minus succeeded refunds on the Asia/Seoul day of `paid_at`; unpaid, cancelled, rejected and fully refunded orders are excluded. (4) 회원관리 data is masked in SQL and only `admin_list_members` / `admin_get_member` return it, to admins only. (5) Terms and the inquiry channel are static app content, not tables.
- **Reason:** The ledgers are append-only and reference profiles with `on delete set null`, so a real delete of a member with history would fail or break `balance = sum(ledger)`; scrubbing gives the same privacy result. Triggers keep notifications consistent with committed facts and idempotent. Server-side aggregates keep money numbers out of the client.
- **Constraints:** The legally required retention period for orders/payments is still the owner's and accountant's to confirm (OQ-34). Until an access token expires, a deleted member's token is blocked by restrictive policies and write guards. Push notifications stay out of the MVP (OQ-37). Notices fan out one row per member at publish time; move to a job if the member count grows.
- **Requirement:** AUTH-04, OTH-03, OTH-05, SA-01, SA-02, SA-12.
