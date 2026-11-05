# Decisions

## 2026-11-05: Store Admin 회원관리 is view-only with masked PII; suspend/adjust deferred

- **Decision:** Store Admin gets a 회원관리 page (`/admin/members`, detail `/admin/members/:memberId`) that is view-only. It shows nickname, masked email, masked phone, login provider, join date, order history, and separate Olive Stamp and Coupon Point balances/ledgers. No suspend/reactivate, edit, delete, or manual stamp/point adjustment.
- **Reason:** Privacy: minimal, masked personal data limits exposure. Suspending members or adjusting stamp/point balances changes reward rules and ledgers (append-only, server-owned), which needs an owner decision on policy (PRD 15) before any UI exists.
- **Constraints:** Masking in the client is a display convention, not a privacy boundary. The server must return pre-masked data and enforce owner-only access (RLS + server authz). The UI "owner-only" label is not a security boundary. Search covers nickname and order number only, never email or phone.
- **Deferred / open:** member suspension, manual adjustments (with ledger reversal entries), member deletion and data-retention rules (PRD 15-12), whether staff accounts may see this page.
- **Requirement:** PRD SA-12 (P1).
