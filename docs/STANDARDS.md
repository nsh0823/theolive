# Coding standards

How code in tilo is written, reviewed, and tested. These are hard rules. If one truly can't be followed in a specific spot, leave a comment saying why (with `eslint-disable-next-line <rule> -- <reason>` where lint flags it) and mention the exception when reporting.

## Architecture

- Keep task, timer, audio, and persistence logic separate from UI and from each other. Timer and cue scheduling are pure, unit-testable modules with no React imports.
- Timer engine: deadline/timestamp-based. Remaining time is always computed from stored timestamps, never from counting ticks. `setInterval` may only drive re-renders.
- Cues are derived from elapsed/remaining time. Each scheduled cue fires at most once: returning to the foreground never replays it, and cues missed during a pause are skipped (PRD §3.4).
- Timers never go negative, and completion fires exactly once per session.
- Persist enough session state to rebuild the correct timer after a restart; the app must never come back stuck in a stale "running" state.
- Use the PRD §6 data model names (`Task`, `TimerPreset`, `TimerSession`, `SoundAsset`, `UserPreferences`).
- Single responsibility: a function does one job. If describing it needs "and", split it.

## TypeScript

- `strict` is on. Never loosen `tsconfig` to make code compile.
- No `any`, explicit or implicit. Data whose shape isn't known ahead of time (storage contents, parsed JSON, route params, third-party callbacks) is typed `unknown` and narrowed with `typeof`, `instanceof`, or a type-guard/validation function before use.
- No non-null assertions (`!`). Narrow the type or handle the null case.
- No `as` casts to silence the checker (`as const` is fine).
- No `var`. Use `const` by default; use `let` only when the variable is reassigned.
- Use `??` for defaults, not `||`, so valid falsy values survive (a volume of `0`, a setting of `false`).
- "No value" is explicit: optional fields are typed `T | null` (as in PRD §6, e.g. `dueAt: string | null`) and the `null` case is handled wherever they're used. Values are never left silently `undefined`.

## Constants, not magic values

- No unexplained numeric literals in logic or config. Name them (`MS_PER_SECOND`, `SHOWER_DEFAULT_DURATION_SECONDS`). Self-evident values (`0`, `1`, `-1`, array indexes) are fine.
- Time math uses shared unit constants/helpers. Never inline `60 * 1000`.
- No repeated literal strings for statuses, kinds, event names, storage keys, preset IDs, or routes. Define each set once as a const object with a matching union type (e.g. `TimerSession.status`), then reference it.
- Product defaults and limits (preset durations, cue intervals, min/max durations, default volumes) live in one config module, not inside components.
- Tests may use literal values for inputs and expected results.

## Validation & error handling

- Validate at the boundary and fail fast: user input (e.g. durations, volumes), data loaded from storage, route params, and anything external are checked before entering app logic. Past the boundary, trust the types.
- Never swallow errors: no empty `catch`, no `.catch(() => {})`.
- A `catch` either rethrows, or recovers with an explicit, valid fallback and logs with context (e.g. corrupt preferences → `DEFAULT_PREFERENCES`, unreadable task list → `[]`). State is never left `null`, `undefined`, or half-written after a failure. Production code never falls back to fake or mock data.
- Errors the user can act on get a visible, plain-language message; unexpected ones are logged with context.
- The root layout must keep an error boundary.

## Async & concurrency

- No floating promises: `await` or return every promise. For deliberate fire-and-forget, prefix with `void` and handle errors inside the background function.
- Every async path handles rejection at a clear boundary: the hook, store action, or event handler that started it. A `try/catch` around every single `await` isn't required.
- Async results never apply to stale state. Effects clean up after unmount (cleanup function or `AbortController`). Timer and audio callbacks check that their session is still the active one (e.g. compare session id) before acting; this is what prevents stale or duplicate cues.
- The same action can't run twice in parallel: double-tapping Start must not create two sessions or start two sounds.

## Code style

- Readability over cleverness: explicit, straightforward code instead of compressed one-liners.
- Self-documenting names. Comments explain _why_ (a business rule, a platform workaround, a PRD reference), never _what_ the code does.
- DRY with restraint: business rules and validation have exactly one source; don't abstract simple code just to save lines.
- Keep source files under ~200 lines. Past that, split along responsibilities (e.g. a screen → its hooks, subcomponents, and pure logic modules), never by arbitrary cut points or by compressing code. Exempt: generated files, tests, and static data/constant tables.

## Security & configuration

- No secrets in the app at all: not in code, logs, or `EXPO_PUBLIC_*`. Everything bundled into a mobile app, including all `EXPO_PUBLIC_*` env vars, can be extracted by users, so env vars are for configuration, not for hiding secrets (e.g. never the Supabase service-role key).
- Env: `EXPO_PUBLIC_*` vars in `apps/mobile/.env.local`, read only via `src/env.ts`, which throws when a variable is missing. Don't read `process.env` anywhere else.
- Never commit `.env.local` or any file with real values. Keep `.env.example` listing every variable, with empty values.
- Check `.gitignore` covers new local files.
- If Supabase sessions return, they persist through `LargeSecureStore` (`apps/mobile/src/services/secureStore.ts`), never AsyncStorage.
- Request no permission without a feature that needs it.
- Flag anything that would send data off the device.

## Tooling & dependencies

- Use pnpm only. Add app deps with `pnpm --filter mobile exec expo install <pkg>` so versions match the Expo SDK; use `pnpm --filter <workspace> add` for the other packages.
- New deps: check they're maintained, and run `pnpm audit` after adding them.
- Add gluestack components from inside `packages/ui`: `npx gluestack-ui@latest add <name> --use-pnpm`. The CLI finds `components/gluestack-ui-provider` there and writes the component and its deps into this package.
- `src/uniwind-types.d.ts` is regenerated by Metro; keep it committed so CI can typecheck without running Metro.
- Don't hand-edit `packages/types/src/supabase.ts`; regenerate it with `pnpm gen:types`.
- Packages that ship untranspiled code go in the `transpiled` list in `apps/mobile/jest.config.js`.

## UI conventions

- Monochrome only. Colors, spacing, and radii come from theme tokens in `global.css`; never hard-code hex values or add colors outside the token map.
- Timer numerals: light weight, tabular numerals (no jitter).
- Never convey state (priority, completion, selection) by color alone.
- Icon-only controls get accessibility labels. Touch targets are at least 44×44pt, and primary buttons at least 48px tall.
- Any duration control offers +/- or numeric input, not only a slider.
- Respect reduced motion and system text scaling.
- The mini-player sits above the tab bar and never covers controls or navigation.

## Quality checklist (every change)

Work through each area for every change. If an area doesn't apply, say so in the session log; never skip it silently.

- **Testing**
  - New or changed logic gets unit tests (Jest) in the same change: the happy path, edge cases (empty, zero, max, invalid input), and failure paths.
  - A bug fix starts with a test that reproduces it.
  - UI changes are run in the simulator (iOS, and Android when available), and the screens actually viewed are named. Lint, typecheck and Jest don't catch layout or routing bugs.
  - Report test counts from the real command output (e.g. Jest's `Tests: N passed`), never estimated.
- **Review**
  - Before reporting, read the full diff (`git diff`, including untracked files) as a reviewer would, checking correctness, leftover debug code, dead code, and violations of `CLAUDE.md` or this file.
  - For substantial changes, offer `/code-review`; for anything touching storage, env, permissions, or network, offer `/security-review`.
- **Fixing and finding errors**
  - Find the root cause before changing code.
  - After a fix, rerun the failing check and confirm it now passes.
- **Error handling**: the change follows "Validation & error handling" and "Async & concurrency" above.
- **Refactoring**
  - Refactor only behavior that tests pin down. If there are no tests, add them first.
  - Keep refactors in separate commits from behavior changes, and never mix them into a bug fix without saying so.
- **Security**: the change follows "Security & configuration" and "Tooling & dependencies" above.
