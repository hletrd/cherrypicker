# Cycle 1 (fresh) — code-reviewer pass

**Date:** 2026-05-03

## Scope

Net-new code-quality issues across the full repo. Deep sweep of core, parser, rules, viz, web, CLI, and scraper.

## Findings

### C1-R01: `parseDateStringToISO` returns unparseable input as-is, creating a leaky abstraction

- **Severity:** MEDIUM
- **Confidence:** High
- **File+line:** `apps/web/src/lib/parser/date-utils.ts:134-142`
- **Description:** When no date format matches, `parseDateStringToISO` returns the raw string unchanged and logs a `console.warn`. This is a known issue (documented at line 134 as "10 cycles have flagged this"), but the root cause remains unfixed. The function's return type is `string`, so callers cannot distinguish valid ISO dates from garbage strings at the type level. The C97-01 filter at `analyzer.ts:376-390` patches one downstream symptom (period bounds), but the parser contract leak persists. Transactions with unparseable dates still enter `allTransactions`, get categorized, and appear in the UI — they just get excluded from monthly aggregation. This is a semantic correctness issue: the user sees transactions that were never properly date-parsed.
- **Failure scenario:** User uploads a CSV with an unusual date format (e.g., "25.Jan.15"). The function returns "25.Jan.15" as-is. The transaction appears in the UI with this raw string as its date, which renders as a malformed label. The C97-01 filter correctly excludes it from period computation, but the transaction still shows in TransactionReview with a broken date display.
- **Fix:** Change the return type to `{ iso: string | null; raw: string }` or throw on unparseable input. At minimum, mark the returned string as invalid so downstream code can display a warning badge on the transaction row.

### C1-R02: ILP optimizer is a dead stub that logs to console in production

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `packages/core/src/optimizer/ilp.ts:48-49`
- **Description:** `ilpOptimize()` is a stub that delegates to `greedyOptimize()` and logs `console.debug('[cherrypicker] ILP optimizer is not yet implemented...')` on every call. Since nothing currently calls `ilpOptimize` (only `greedyOptimize` is used), this is dead code. However, if someone switches to it, every optimization call will produce a console message.
- **Fix:** Either remove the stub entirely or change the log to a one-time warning (e.g., a module-level flag).

### C1-R03: Empty catch blocks swallow errors silently in production components

- **Severity:** LOW
- **Confidence:** Medium
- **File+line:** Multiple Svelte components:
  - `FileDropzone.svelte:297` — Astro View Transitions import fallback
  - `TransactionReview.svelte:110` — category change handler
  - `CardDetail.svelte:34` — card data loading
  - `CardDetail.svelte:291` — expand toggle
  - `SpendingSummary.svelte:39` — period display
- **Description:** Five empty `catch {}` blocks in Svelte components. Most are intentional fallbacks (e.g., `import('astro:transitions/client')` failing when View Transitions is not enabled), but `TransactionReview.svelte:110` and `CardDetail.svelte:34/291` are user-facing error paths that produce no diagnostic output. If these catch blocks fire due to a real bug (not the expected fallback case), the error is silently swallowed.
- **Fix:** Add `console.warn` or `console.debug` in each catch block with a brief diagnostic message. This matches the pattern used elsewhere in the codebase (e.g., `store.svelte.ts:325,345`).

### C1-R04: MIGRATIONS dict uses `(data: any) => any` — type safety gap

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/lib/store.svelte.ts:110`
- **Description:** The `MIGRATIONS` record types its values as `(data: any) => any`. While there are currently no migrations (v1 is the first schema), when migrations are eventually added, the `any` types will bypass TypeScript's structural checking. A malformed migration could silently corrupt the persisted data shape.
- **Fix:** Type the parameter as the `PersistedAnalysisResult` type and the return as the same. At minimum, add a JSDoc note that migrations must preserve the `PersistedAnalysisResult` shape.

## Summary

4 net-new findings (1 MEDIUM, 3 LOW). C1-R01 is the most impactful — the parser's return-type contract leak is a known root cause that has produced multiple downstream symptoms (C96-01, C97-01) patched at the analyzer boundary.
