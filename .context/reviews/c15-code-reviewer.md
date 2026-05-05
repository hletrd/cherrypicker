# Cycle 15 — Code Review

**Date:** 2026-05-06
**Scope:** Full repository review post-C14-fix verification. Focus on code quality, logic, SOLID, maintainability.

## Inventory & Method

Reviewed:
- `packages/core/src/{calculator,optimizer,categorizer}/**`
- `packages/parser/src/**`
- `packages/rules/src/**`, `packages/viz/src/**`
- `apps/web/src/{lib,components,pages}/**`
- `tools/cli/**`, `tools/scraper/**`
- Test suites under `__tests__/`

Diffed against cycle 14 aggregate. C14 fixes implemented: isValidISODate validation, console.warn removal (partial), duplicate import fix, invalid-date tests.

## Verified Fixed (from Cycle 14)

| Finding | Status | Evidence |
|---------|--------|----------|
| C14-01: isValidISODate month/day validation | FIXED | Both server+web date-utils.ts validate year (1900-2100), month (1-12), and day ranges |
| C14-TEST-01: Invalid date boundary tests | FIXED | Both packages/parser/__tests__/date-utils.test.ts and apps/web/__tests__/parser-date.test.ts have comprehensive invalid-date tests covering month 99, day 99, month 00, day 00, Feb 30, Apr 31, year 0000 |
| C14-04: Duplicate imports in adapter-factory.ts | FIXED | Single import statement from column-matcher.ts |
| C14-02: console.warn in analyzer.ts | FIXED | analyzer.ts lines 58, 64 no longer have console.warn |

## New Findings

### C15-01: C14-02 incomplete — store.svelte.ts and build-stats.ts still have console.warn (MEDIUM)
- **Files:** `apps/web/src/lib/store.svelte.ts:191, 243, 246, 330, 338, 358`; `apps/web/src/lib/build-stats.ts:27, 31`
- **Issue:** Commit `90da9c8` (C14-02) only removed console.warn from analyzer.ts. Six console.warn calls remain in store.svelte.ts (persistence diagnostics, schema migration, sessionStorage failures) and two in build-stats.ts (malformed cards.json, missing stats). These leak internal data to production browsers and create noise.
- **Concrete scenario:** A user with a corrupted sessionStorage entry sees `[cherrypicker] Session storage has legacy (unversioned) data.` in their browser console — confusing and unprofessional.
- **Fix:** Remove all remaining console.warn calls. The UI already surfaces these conditions via error states and persistWarningKind.
- **Confidence:** High

### C15-02: Both rate and fixedAmount present — fixed reward silently dropped (MEDIUM)
- **File:** `packages/core/src/calculator/reward.ts:261`
- **Issue:** When a tier has both `normalizedRate !== null && normalizedRate > 0` AND `hasFixedReward`, the code enters the first branch (rate-based) and never reaches the fixed-reward branch. The comment says "Korean card rules do not currently use both together" but this is a silent data-loss hazard if a YAML rule ever has both. The fixed reward is discarded without warning or error.
- **Concrete scenario:** A card rule author adds both `rate: 1.5` and `fixedAmount: 1000` to a tier thinking both apply. The optimizer silently ignores the fixed 1000 won per transaction, under-reporting rewards.
- **Fix:** Add a Zod validation in `packages/rules/src/schema.ts` that rejects tiers with both `rate` and `fixedAmount` present. This moves the constraint from runtime ambiguity to schema-level clarity.
- **Confidence:** High

### C15-03: parseAmountString accepts scientific notation via parseFloat (LOW)
- **File:** `packages/parser/src/csv/shared.ts:160`
- **Issue:** `Math.round(parseFloat(cleaned))` accepts scientific notation (e.g., "1e5" → 100000, "1.2e3" → 1200). While unlikely in Korean bank exports, a malformed CSV could produce unexpected amounts.
- **Fix:** Add a guard after parseFloat to reject inputs containing 'e' or 'E' before rounding.
- **Confidence:** Low

### C15-04: adapter-factory quote stripping only handles one layer (LOW)
- **File:** `packages/parser/src/csv/adapter-factory.ts:163`
- **Issue:** `merchantRaw.replace(/^"(.*)"$/, '$1')` only strips a single pair of quotes. If a merchant name contains escaped quotes like `""Coffee""`, it becomes `"Coffee"` instead of `"Coffee"`.
- **Fix:** Use a while loop or a dedicated CSV unescape function that handles doubled quotes per RFC 4180.
- **Confidence:** Low

### C15-05: build-stats.ts console.warn not tracked in prior reviews (LOW)
- **File:** `apps/web/src/lib/build-stats.ts:27, 31`
- **Issue:** Two console.warn calls exist in build-stats.ts that were never flagged in any prior review cycle. They fire at build time (not runtime) but still produce console noise.
- **Fix:** Remove or convert to build-time-only logging.
- **Confidence:** High

## Deferred from Prior Cycles (Still Relevant)
- D-01: Parser duplication (web vs packages) — HIGH, major refactor
- C14-03: renderPageText hardcoded char width — MEDIUM, deferred
- C14-05: parseDateStringToISO fullMatch lacks end anchor — MEDIUM, deferred
- C14-DB03: Fallback values bypass type safety — MEDIUM, deferred

## Summary

Cycle 15 has 2 MEDIUM and 3 LOW new actionable findings. Priority: C15-01 (complete the C14-02 cleanup) and C15-02 (add schema validation for rate+fixedAmount mutual exclusion).
