# Cycle 8 — code-reviewer

Scope: full repo, focus on logic/invariant/data-flow bugs, with explicit re-audit of every D7-M deferral file.

## Inventory (review-relevant files)

Store/analyzer:
- `apps/web/src/lib/store.svelte.ts` (610 LoC)
- `apps/web/src/lib/analyzer.ts` (425 LoC)
- `apps/web/src/lib/cards.ts`
- `apps/web/src/lib/category-labels.ts`
- `apps/web/src/lib/formatters.ts`

Components:
- `apps/web/src/components/upload/FileDropzone.svelte` (543 LoC)
- `apps/web/src/components/dashboard/*.svelte`
- `apps/web/src/components/ui/*.svelte`

Layout + pages:
- `apps/web/src/layouts/Layout.astro`
- `apps/web/src/pages/*.astro`

Tests + config:
- `e2e/*.spec.js`
- `playwright.config.ts`
- `package.json`

## Re-audit of D7-M items (evidence-based)

| Id | Re-assessment |
|----|---------------|
| D7-M1 (dead `_loadPersistWarningKind = null` in reset at :601-602) | Confirmed dead. After initial construction (line 379-380) the module-level vars are never re-set; there is only one `createAnalysisStore()` call, so `reset()` resetting them is cosmetic. **Actionable this cycle** — zero risk, deletes 2 lines. |
| D7-M2 (`setResult` footgun at :452-459) | Confirmed zero callers outside tests via grep. Not a runtime bug; has doc-comment value for future API use. Safe to leave deferred OR annotate with `@deprecated-unused` — low priority. **Keep deferred** unless the plan explicitly calls for deletion. |
| D7-M3 (timer leak on rapid re-upload within 1.2s at :266-277) | Confirmed: `navigateTimeout` is assigned at line 276 but the existing timer is not cleared before reassignment. However, the upload button is disabled during `uploadStatus === 'uploading'|'success'`, making a rapid double-upload physically impossible from the UI. `handleRetry` does clear the timer. **Low real impact** — keep deferred unless user report. Alternative: add defensive `clearTimeout(navigateTimeout)` before re-assignment. **Actionable, defensive 1-line fix.** |
| D7-M4 (`-0` accepted in parsePreviousSpending at :228-234) | Confirmed: `Math.round(-0) === -0` and `-0 >= 0` is true. Cosmetic. Trivial 1-line fix (coerce `+0` via `|| 0` or `Math.abs(n) === 0 ? 0 : n`). **Actionable, trivial.** |
| D7-M5 (silent drop of malformed-date rows at analyzer.ts:322-333) | Confirmed behavior documented; C96-01 already throws if ALL rows malformed. Keep deferred. |
| D7-M6 (module-level mutable `_loadPersistWarningKind` at :216-220, :379) | Testability concern; extracting persistence is a refactor. Keep deferred (tied to A7-02). |
| D7-M7 (`reuseExistingServer` at playwright.config.ts:19) | Keep deferred — CI pipeline gates this. |
| D7-M8 (no axe-core gate) | Keep deferred — feature, not fix. |
| D7-M9 (`ui-ux-screenshots.spec.js` has no assertions) | Keep deferred — intentional smoke harness. |
| D7-M10 (spinner missing `aria-busy`) | **Actionable, 1-line add** to `aria-busy={uploadStatus === 'uploading'}` on the form container. Low risk. |
| D7-M11 (architectural refactors A7-01/02/03) | Keep deferred. |
| D7-M12 (`getAllCardRules` refetched per reoptimize) | Keep deferred — already cached via `cachedCoreRules`. Note: `getAllCardRules()` is called every reoptimize, but the adapter transform is cached in `cachedCoreRules`. So most of the cost is avoided. Keep deferred. |
| D7-M13 (`unsafe-inline` in script-src at Layout.astro:42) | Keep deferred — Astro upstream gate. |
| D7-M14 (test-selector polish) | Keep deferred — current selectors work. |

## New findings (cycle 8, fresh look)

### C8CR-01 — `reoptimize` `setResult` path also rebuilds derived state, `setResult` omits that (CONFIRMED design issue, LOW severity)

- File: `apps/web/src/lib/store.svelte.ts:452-459`
- Code: `setResult(r)` only assigns `result = r`, bumps generation, clears error, persists. It does NOT invalidate caches (analyzer caches, category-labels cache). If a future caller uses `setResult` to inject a synthesized result (e.g., from a test fixture or debug panel), `reoptimize()` will run against stale analyzer caches.
- Severity: LOW / Medium confidence.
- Fix: either delete `setResult` (no callers) or make it invalidate analyzer caches via `invalidateAnalyzerCaches()`.
- Recommendation: defer — no callers means no actual bug. Revisit when first caller lands.

### C8CR-02 — `isOptimizableTx` tightens validation but `loadFromStorage` accepts any `cardResults` with valid `byCategory` (OK, noted for tracer)

- File: `store.svelte.ts:266-275`
- `validCardResults` filter checks `cardId`, `totalReward`, `byCategory` but does not re-validate each `byCategory` entry. If the persisted payload was maliciously hand-edited, the dashboard could crash on a bad `CategoryReward` later. Real risk: zero (sessionStorage is per-origin, same user).
- Severity: LOW / Low. Not worth shipping.

### C8CR-03 — `_loadPersistWarningKind` reset in `reset()` is unreachable-after-construction (confirms D7-M1 actionability)

- See D7-M1 re-audit. Actionable, safe, 2-line deletion.

## Confirmed / Likely / Risk

Confirmed issues (new this cycle):
- None HIGH severity. C8CR-01 is a LOW design nit with no runtime impact.

Likely issues (need manual validation):
- None.

Risks (carry-over):
- CSP `unsafe-inline` (D7-M13) remains — Astro ecosystem gate.
- No axe-core regression gate (D7-M8) — a11y cycle gate.

## Recommendations

- Land D7-M1 (dead-code cleanup), D7-M4 (`-0` coerce), D7-M10 (aria-busy). All 3 are 1-2 line changes, zero-risk, preserve severity of the deferral's exit criterion (i.e., resolve rather than re-defer).
- Optionally land D7-M3 defensive `clearTimeout` before assignment. 1-line change.
- Leave the rest deferred with exit criteria unchanged.

Confidence: High on re-audit; Medium on C8CR-01 (design-only).
