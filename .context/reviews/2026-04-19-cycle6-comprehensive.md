# Comprehensive Code Review -- Cycle 6 (Re-review, 2026-04-19)

**Date:** 2026-04-19
**Reviewer:** Multi-angle comprehensive review (cycle 6 re-review)
**Scope:** Full repository -- all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage, type safety

---

## Methodology

Read every source file in the repository (40+ source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, apps/web). Cross-referenced with prior cycle 1-50 reviews and deferred items. Ran `bun test` (266 pass, 0 fail), `tsc --noEmit` per package (all pass), and `bun run build` (all 7 tasks succeed). Focused on finding genuinely NEW issues not previously reported.

---

## Verification of Prior Findings

All prior cycle 3-5, 47-50 findings are confirmed fixed:

| Finding | Status | Evidence |
|---|---|---|
| C3-M01 | **FIXED** | CLI `report.ts:139` passes `categoryLabels` to `buildConstraints` |
| C3-L01 | **FIXED** | CLI `report.ts:50-52` validates `Number.isNaN(prevSpending)` |
| C4-01 | **FIXED** | `SavingsComparison.svelte` has `Number.isFinite(raw)` guard |
| C4-02 | **FIXED** | `analyzeMultipleFiles` passes prebuilt `categoryLabels` |
| C4-03 | **FIXED** | Single-pass `monthlyTxCount` map in `analyzer.ts:298-302` |
| C4-04 | **FIXED** | `CategoryBreakdown.svelte` has `role="button"` and `tabindex="0"` |
| C4-05 | **FIXED** | `analyzer.ts:225` passes `categoryLabels` to `buildConstraints` |
| C4-08 | **FIXED** | `TransactionReview.svelte` uses `lastSyncedGeneration` counter |
| C4-12 | **FIXED** | `FileDropzone.svelte` uses `Math.round(Number(v))` with `Number.isFinite` guard |
| C4-15 | **FIXED** | `analyzer.ts:47,167-168` caches `cachedCoreRules` |
| C4R-M01 | **FIXED** | `report.ts:143` calls `printSpendingSummary(categorized, categoryLabels)` |
| C4R-M02 | **FIXED** | Server-side CSV adapters `parseAmount` returns NaN, callers use `Number.isNaN()` |
| C4R-L01 | **FIXED** | Content-signature adapter failures collected into `ParseResult.errors` |
| C5-M01 | **FIXED** | Server-side CSV `parseAmount` returns NaN, callers use `Number.isNaN()` |
| C5-M02 | **FIXED** | All server-side CSV adapters use `Number.isNaN()` instead of `isNaN()` |
| C5-L02 | **FIXED** | Unused `nextCount` variable removed from `table-parser.ts` |
| C47-L01 | **STILL FIXED** | Terminal `formatWon` has `Number.isFinite` guard + negative-zero normalization |
| C47-L02 | **STILL FIXED** | Terminal `formatRate` has `Number.isFinite` guard |
| C49-M01 | **STILL FIXED** | `llm-fallback.ts:84` has `let parsed: LLMTransaction[] = [];` |
| C50-M01 | **STILL FIXED** | Viz report generator and terminal summary accept `categoryLabels` parameter |
| C50-L01 | **STILL FIXED** | Report generator uses `replaceAll()` for template placeholder substitution |

Previous cycle 6 findings:

| Finding | Status | Evidence |
|---|---|---|
| C6-01 | **FIXED** | `SavingsComparison.svelte:33-38` no longer stores initial `rate`, only computed in `.map()` |
| C6-02 | **FIXED** | `persistWarningKind` implemented in `store.svelte.ts:106-135,247-296`, UI in `SpendingSummary.svelte:131` |
| C6-03 | **FIXED** | Count-up animation starts from `displayedSavings` (current value) instead of 0 |
| C6-07 | **FIXED** | `TransactionReview.svelte:118` adds `tx.subcategory = undefined` when AI changes category |
| C6-11 | **FIXED** | `formatRatePrecise` added to `formatters.ts:34` and used in `SavingsComparison.svelte:179,192` |

Deferred items (D-106, D-107, D-110) remain deferred with documented rationale.

---

## New Findings

### C6R-M01: `isNaN()` used instead of `Number.isNaN()` in server-side XLSX parser

- **Severity:** MEDIUM (consistency / correctness)
- **Confidence:** High
- **File+line:** `packages/parser/src/xlsx/index.ts:137,147`
- **Description:** The server-side XLSX parser's `parseAmount` function uses `isNaN(n)` at line 137 and `parseInstallments` uses `isNaN(n)` at line 147. All 10 server-side CSV adapters were fixed in cycle 5 to use `Number.isNaN()`, but the XLSX parser was missed. The web-side XLSX parser at `apps/web/src/lib/parser/xlsx.ts:294` correctly uses `Number.isNaN(parsed)`, but line 304 also uses bare `isNaN(n)` for installment parsing.

  While `parseInt()` always returns a number (making `isNaN` and `Number.isNaN` functionally equivalent for this specific case), the inconsistency violates the principle established in cycle 5 that all parsers should use `Number.isNaN()`.

- **Concrete failure scenario:** Currently no functional difference since `parseInt()` always returns `number`. However, if `parseAmount` were changed to accept `unknown` and a string value like `"abc"` were passed, `isNaN("abc")` returns `true` (coerces to NaN) while `Number.isNaN("abc")` returns `false` (not NaN, just a string).
- **Fix:** Replace `isNaN(n)` with `Number.isNaN(n)` in `packages/parser/src/xlsx/index.ts:137,147`.

### C6R-M02: Web-side CSV adapters use `isNaN()` for installment parsing -- inconsistency with server-side

- **Severity:** LOW (consistency)
- **Confidence:** High
- **File+line:** `apps/web/src/lib/parser/csv.ts:258,334,399,465,531,596,662,728,793,859,924` (11 occurrences) and `apps/web/src/lib/parser/xlsx.ts:304`
- **Description:** The web-side CSV bank adapters use `isNaN(inst)` for installment parsing in all 10 bank-specific adapters. The server-side CSV adapters were fixed in cycle 5 to use `Number.isNaN(inst)`. The web-side `parseAmount()` at line 121 correctly uses `Number.isNaN()`, and the `isValidAmount()` helper at line 128 uses `Number.isNaN()`, but the installment parsing in the individual bank adapters was not updated.

  Similarly, `apps/web/src/lib/parser/xlsx.ts:304` uses `!isNaN(n)` for installment parsing.

- **Concrete failure scenario:** Same as C6R-M01 -- `parseInt()` always returns a number, so `isNaN()` and `Number.isNaN()` are functionally equivalent here. The issue is consistency.
- **Fix:** Replace all `isNaN(inst)` with `Number.isNaN(inst)` in the web-side CSV adapters and `isNaN(n)` with `Number.isNaN(n)` in the web-side XLSX parser.

---

## Final Sweep -- Cross-File Interactions

1. **All `formatWon` implementations are consistent** -- all 4 implementations have `Number.isFinite` guards and negative-zero normalization.
2. **All `formatRate` implementations are consistent** -- all 5 implementations have `Number.isFinite` guards.
3. **TypeScript build is clean** for all packages. Apps/web test file errors (`bun:test` module) are pre-existing and documented.
4. **Reward calculation consistency** -- all calculator functions delegate correctly.
5. **Category labels resolution** is consistent across CLI, viz, and web.
6. **`reoptimize()` increments `generation`** -- C5-01 (old) is fixed.
7. **No new security issues found.** CSP present, LLM fallback guarded, no secrets.
8. **No new performance issues found.**
9. **No new UI/UX issues found.** All dashboard components render correctly.
10. **`isNaN` consistency gap** -- The only remaining `isNaN()` usages in parser code are: (a) server-side XLSX parser (C6R-M01), (b) web-side CSV adapter installment parsing (C6R-M02), and (c) web-side XLSX parser installment parsing (C6R-M02). All other parser code uses `Number.isNaN()`.

---

## Summary of Active Findings

| ID | Severity | Confidence | File | Description | Status |
|---|---|---|---|---|---|
| C6R-M01 | MEDIUM | High | `packages/parser/src/xlsx/index.ts:137,147` | Server-side XLSX parser uses `isNaN()` instead of `Number.isNaN()` | NEW, needs fix |
| C6R-M02 | LOW | High | `apps/web/src/lib/parser/csv.ts` (11 occurrences), `apps/web/src/lib/parser/xlsx.ts:304` | Web-side CSV/XLSX adapters use `isNaN()` for installment parsing | NEW, consistency fix |
