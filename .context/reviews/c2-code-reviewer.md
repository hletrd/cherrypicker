# Cycle 2 — code-reviewer pass

**Date:** 2026-05-03

## Scope

Net-new code-quality issues across the full repo. Deep sweep of core, parser, rules, viz, web, CLI, and scraper.

## Findings

### C2-R01: `MIGRATIONS` dict uses `(data: any) => any` — type safety gap (re-confirmed from C1-R04)

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/lib/store.svelte.ts:114`
- **Description:** The `MIGRATIONS` record types its values as `(data: any) => any`. While there are currently no migrations (v1 is the first schema), when migrations are eventually added, the `any` types will bypass TypeScript's structural checking. A malformed migration could silently corrupt the persisted data shape.
- **Status:** Unchanged from C1-R04.

### C2-R02: `loadFromStorage` catch block at line 324 has bare `catch {}` — missing diagnostic

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/lib/store.svelte.ts:324`
- **Description:** The outer catch block in `loadFromStorage` is `catch {}` with no diagnostic message. The inner nested catch at line 325 correctly logs the error, but the outer catch itself swallows the initial `JSON.parse` or validation failure silently. This makes debugging persistence issues harder when the inner catch doesn't apply (e.g., `sessionStorage.getItem` throws SecurityError).
- **Fix:** Add `console.warn('[cherrypicker] Failed to load persisted data:', err)` in the outer catch, or at minimum move the diagnostic to the outer catch and remove the redundant inner catch.

### C2-R03: `inferYear` in both `packages/parser/src/date-utils.ts` and `apps/web/src/lib/parser/date-utils.ts` uses `new Date()` — timezone-dependent (re-confirmed from C1-D01)

- **Severity:** LOW
- **Confidence:** Medium
- **File+line:** `packages/parser/src/date-utils.ts:25-31`, `apps/web/src/lib/parser/date-utils.ts:35-43`
- **Description:** Both copies of `inferYear` use `new Date()` which is timezone-dependent. Near midnight on Dec 31 in UTC-X timezones, `now.getFullYear()` may already be the next year. Known limitation (C8-08). The two copies are also a DRY violation — the web version is a near-identical copy of the packages version.
- **Status:** Known limitation, re-confirmed.

### C2-R04: `scoreCardsForTransaction` computes full `calculateCardOutput` twice per card per transaction — O(C*T*N)

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `packages/core/src/optimizer/greedy.ts:136-142`
- **Description:** For each transaction, `scoreCardsForTransaction` calls `calculateCardOutput` twice for each card — once "before" and once "after" pushing the transaction. With M cards, T transactions, and N transactions per card, this is O(2*M*T*N) where N grows linearly with assignments. For typical usage (3-5 cards, <500 transactions) this is fast enough, but large datasets could be slow.
- **Fix:** Consider an incremental delta computation that avoids recomputing the full reward from scratch. Known optimization opportunity, not a bug.

### C2-R05: `detectBank` in both `packages/parser/src/detect.ts` and `apps/web/src/lib/parser/detect.ts` are duplicated

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `packages/parser/src/detect.ts:109-146`, `apps/web/src/lib/parser/detect.ts:127-164`
- **Description:** The `detectBank` function and `BANK_SIGNATURES` array are duplicated between the packages/parser and apps/web copies. Both are functionally identical. This is a DRY violation that can lead to drift. Part of the broader D-01 deferred item.
- **Status:** Known deferred item (D-01).

## Verified prior fixes still in place

| ID | File/Line | Verification |
|---|---|---|
| C97-01 | `analyzer.ts:376-390` | Filter `length >= 10` on `allDates` and `optimizedDates` confirmed. |
| C96-01 | `analyzer.ts:344-346` | Empty-months `throw` confirmed. |
| C1-P01 | `xlsx.ts:299-301` | XLSX parser now uses `XLSX.read(html, { type: 'string' })`. |
| ILP stub | `ilp.ts:45-49` | Console.debug removed, `@deprecated` JSDoc added. |

## Summary

1 net-new actionable finding (C2-R02, LOW — silent catch block). 4 re-confirmations of known items.
