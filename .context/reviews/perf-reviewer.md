# Performance Reviewer — Cycle 1 (Fresh Review 2026-04-24)

## Inventory of Reviewed Files

- `apps/web/src/lib/store.svelte.ts` — State management, sessionStorage persistence
- `apps/web/src/lib/analyzer.ts` — Analysis orchestration, caching
- `apps/web/src/lib/cards.ts` — Card data loading, index lookup
- `apps/web/src/lib/parser/csv.ts` — CSV parsing
- `apps/web/src/lib/parser/xlsx.ts` — XLSX parsing
- `apps/web/src/lib/parser/pdf.ts` — PDF parsing
- `apps/web/src/components/dashboard/SavingsComparison.svelte` — Count-up animation
- `packages/core/src/optimizer/greedy.ts` — Greedy optimizer
- `packages/core/src/calculator/reward.ts` — Reward calculator
- `packages/parser/src/detect.ts` — Server-side bank detection

## New Findings

### P1-01: `persistToStorage` serializes entire result on every reoptimize
- **File:** `apps/web/src/lib/store.svelte.ts:576`
- **Severity:** LOW
- **Confidence:** High
- **Description:** Every call to `reoptimize()` triggers `persistToStorage(result)` which does `JSON.stringify()` of the full analysis result including the optimization object. For rapid category edits, this produces repeated O(n) serializations. Previously noted as P8-02 (deferred). No change in status.
- **Fix:** Debounce `persistToStorage` calls (e.g., 300ms) since the store is in-memory.

### P1-02: Server-side `detectCSVDelimiter` scans all lines (same as C1-02)
- **File:** `packages/parser/src/detect.ts:148-165`
- **Severity:** LOW
- **Confidence:** High
- **Description:** Duplicate finding with C1-02. The server-side version lacks the 30-line limit that the web version has (C83-05).

## Previously Deferred (Acknowledged)

D-09, D-51, D-86 (scoreCardsForTransaction double computation), D-100 (taxonomy findCategory O(n*m)), P8-01/P8-02 (reoptimize rebuild/persist), D-12/D-61 (getAllCardRules refetch, toCoreCardRuleSets cache miss).
