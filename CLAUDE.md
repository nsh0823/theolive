# The O'live

Single-store cafe ordering platform: an Expo customer app (iOS/Android) and a React + Vite store web,
in a Turborepo + pnpm monorepo with a Supabase backend.

- **Customer app:** social login, menu, cart, dine-in/takeout ordering, payment, order history, stamps, coupons, coupon points.
- **Store Web:** tablet-first, real-time order receiving and preparation for staff.
- **Store Admin:** desktop-first menu, reward, store, and basic sales management.

<!-- Rules that stay true only. Progress/status/TODOs → docs/CONTEXT.md. Coding rules → docs/STANDARDS.md. -->

@docs/CONTEXT.md @docs/STANDARDS.md

## Docs map

| File                | What                                                              | When                                                  |
| ------------------- | ----------------------------------------------------------------- | ----------------------------------------------------- |
| `docs/STANDARDS.md` | Coding standards + quality checklist                              | Auto-loaded; every change                             |
| `docs/PRD.md`       | Requirement IDs, flows, data model, MVP scope/DoD, open decisions | Before feature work (read the relevant section)       |
| `docs/DESIGN.md`    | Brand assets, tokens, typography, components                      | Before UI work; if missing, ask — don't invent styles |
| `docs/DECISIONS.md` | Decisions + open questions                                        | Before architecture changes; log new decisions here   |
| `docs/CONTEXT.md`   | Current phase, in-progress work, next steps                       | Rewrite at end of each session                        |
| `docs/SESSIONS.md`  | Append-only per-session log                                       | Update during every session (see below)               |

## Product boundaries

- One store only: no store selection/switching, multi-branch, HQ/franchise, delivery, gift cards, membership tiers, or transfers.
- Customer app has exactly four tabs, in order: **Home → Order → Reward → Other**. Never add, remove, or reorder.
- **Olive Stamps** (earned by purchase → reward coupons) and **Coupon Points** (store-issued codes → checkout credit)
  stay separate: never merge balances, ledgers, or redemption rules.
- MVP menu customization is **HOT / ICE** only. Network-dependent: no offline ordering or local substitutes for server data.

## Layout

Inspect the actual repo first; don't create packages just because they're listed. Propose before restructuring.

- `apps/mobile` — Expo Router app. Routes in `app/` (`(auth)`/`(tabs)` gated with `Stack.Protected` in `app/_layout.tsx`); other code in `src/` (`@/…`).
- `apps/store` — React + Vite store web; Store Web and Admin split by routes/permissions (`/orders`, `/admin`).
- `packages/ui` — gluestack-ui v5 + Uniwind. Import `@theolive/ui/components/<name>`. Don't force shared mobile/web components.
- `packages/api` — Supabase client factory + TanStack Query hooks (platform-agnostic; app injects storage).
- `packages/types` — shared models + generated Supabase `Database` types. `packages/validation` — shared Zod schemas.
- `packages/config` — shared ESLint (flat), Prettier, tsconfig. `supabase/` — config, migrations, seed, Edge Functions.

## Commands (repo root — verify scripts exist in `package.json`)

```bash
pnpm dev | lint | typecheck | test | format
pnpm supabase start            # local Supabase (Docker)
pnpm gen:types                 # regenerate packages/types/src/supabase.ts
pnpm --filter mobile test:e2e  # Maestro flows in apps/mobile/e2e
```

## Implementation rules

- pnpm only. App deps: `pnpm --filter mobile exec expo install <pkg>`; others: `pnpm --filter <workspace> add`.
- gluestack components: run `npx gluestack-ui@latest add <name> --use-pnpm` inside `packages/ui`.
- Styling: Uniwind `className` (Tailwind v4, CSS config). Tokens in `apps/mobile/global.css`. Follow `docs/DESIGN.md`;
  default page bg `#EFF4F8`; fonts Pretendard (KO) / Manrope (EN). Use the official logo as-is.
- Safe area: `useSafeAreaInsets` on a plain RN `View`. Uniwind `className` only styles RN core components, so
  `className` on third-party components like `SafeAreaView` is silently dropped (blank screen); wrap with `withUniwind` if needed.
- Auth sessions persist via `LargeSecureStore` (`apps/mobile/src/services/secureStore.ts`) — never AsyncStorage.
- State: Zustand (`src/store`) for client/UI; TanStack Query for server state. Env via `src/env.ts` only (`EXPO_PUBLIC_*`).
- Keep `src/uniwind-types.d.ts` committed. Tests: Jest + jest-expo + RNTL 14 — `await render`/`fireEvent`.
- Data screens need loading, empty, error, disconnected, and success states. Realtime isn't guaranteed: refetch on reconnect.

## Server owns the truth

- Server is authoritative for identity, permissions, menu, prices, discounts, orders, payments, stamps, coupons, points.
- Never trust client prices, totals, balances, or payment-success flags; recompute totals server-side.
- Verify payment via the PG's approval/webhook flow — a redirect or success screen is not proof. Don't assume a payment
  method (Kakao/Naver/Toss Pay) is supported until verified against the PG contract.
- Payment confirmation, order creation, reward accrual, coupon redemption, and point deduction must be idempotent.
- Snapshot order items (name, option, qty, price). Stamps/points use append-only ledgers. Order status ≠ payment status.
- Enforce RLS + server-side authz (hidden UI is not a boundary). Never ship service-role keys, PG secrets, or PII to clients/logs.

## Guardrails

**Ask before:** deleting files or resetting data (`supabase db reset`); writing a migration (always a new one, never edit
an applied one); `git push`, PRs, deploys, prod data; anything outside PRD MVP scope; resolving open items in
`docs/DECISIONS.md`/PRD (propose options); changing auth, payment provider/flow, reward rules, order-state transitions,
data retention, roles, or authz; adding costly services/deps; changing brand assets.

**Never:** claim payment, push, or realtime works until tested in its real environment; run `eas build` or link
Maestro Cloud / hosted test services without approval.

**Scope:** fix what was asked; if the cause is elsewhere, say so and ask. Small, reviewable changes. Integrity beats polish.

## Definition of Done

- `pnpm lint`, `typecheck`, `test` pass; report commands actually run. Anything unchecked is "not verified".
- `docs/STANDARDS.md` checklist worked through; covered requirement IDs named (and referenced in tests where practical).
- User flow changed → E2E flow updated and run (or flagged not run).
- Schema changed → new migration + regenerated types, commands reported.
- Authz/RLS → tests for allowed and denied paths.
- Payments → success, failure, cancel, duplicate callbacks, interrupted-flow recovery; state sandbox vs prod accurately.
- Order lifecycle → valid/invalid transitions, duplicate events, realtime reconnect.
- Rewards → earn, redeem, insufficient balance, refund reversal, expiry, duplicates.
- Decisions logged in `docs/DECISIONS.md`; current `docs/SESSIONS.md` entry updated. Screens looking right ≠ done.

## Session log (`docs/SESSIONS.md`)

One entry per session, newest at bottom. Create it after the first task; update after every task.
Append-only (corrections go under "Corrections to earlier sessions"). Evidence only — real commands, results, hashes.
No blank fields ("None" / "Not done — <reason>" are fine). Keep the template exactly; `/report` parses it.
