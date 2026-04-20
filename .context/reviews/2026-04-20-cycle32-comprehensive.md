# Cycle 32 Comprehensive Code Review -- 2026-04-20

**Scope:** Full re-read of all source files in `apps/web/src/`, `packages/core/src/`, `packages/rules/src/`, `packages/parser/src/`, `packages/viz/src/`, `tools/`, verification of all prior open findings, targeted divergence analysis between server-side and web-side parsers.

---

## Verification of Prior Open Findings

All previously open findings from the aggregate were verified against current source code:

| Finding | Status | Evidence |
|---|---|---|
| C7-04 | OPEN (LOW) | TransactionReview `$effect` re-sync still uses `generation` counter pattern |
| C7-06 | OPEN (LOW) | `analyzer.ts:329` still filters to latest month; `transactions` field includes all months |
| C7-07 | OPEN (LOW) | `BANK_SIGNATURES` duplicated between `apps/web/src/lib/parser/detect.ts` and `packages/parser/src/detect.ts` |
| C7-11 | OPEN (LOW) | `store.svelte.ts:156` persist warning message for 'corrupted' says "거래 내역을 불러오지 못했어요" |
| C8-05/C4-09 | OPEN (LOW) | `CategoryBreakdown.svelte:6-49` still uses hardcoded `CATEGORY_COLORS` -- utility colors fixed, non-utility entries unchanged |
| C8-07/C4-14 | OPEN (LOW) | `build-stats.ts:16-18` still has hardcoded fallback values `683/24/45` that drift |
| C8-08 | OPEN (LOW) | `inferYear()` in `date-utils.ts:20` -- timezone-dependent near midnight Dec 31 |
| C8-09 | OPEN (LOW) | Test files still duplicate production code |
| C18-01 | OPEN (MEDIUM) | `VisibilityToggle.svelte:26-78` -- $effect with DOM manipulation, fragile pattern with isConnected guards |
| C18-02 | OPEN (LOW) | `VisibilityToggle.svelte:38-58` -- stat element queries guarded but effect still runs on dashboard page |
| C18-03 | OPEN (LOW) | `SavingsComparison.svelte:218` annual projection still multiplies by 12 |
| C18-04 | OPEN (LOW) | `xlsx.ts:247` `isHTMLContent()` still only checks first 512 bytes |
| C19-04 | OPEN (LOW) | `FileDropzone.svelte:220` still uses `window.location.href` for navigation |
| C19-05 | OPEN (LOW) | `CardDetail.svelte:276` still uses `window.location.href` for navigation |
| C21-02 | OPEN (LOW) | cards.ts shared fetch AbortSignal race (deferred) |
| C21-04/C23-02/C25-02/C26-03 | OPEN (LOW->MEDIUM) | cachedCategoryLabels/cachedCoreRules invalidated on explicit reset but stale across long-lived tabs |
| C22-04 | OPEN (LOW) | CSV adapter registry only covers 10 of 24 detected banks (deferred) |
| C22-05 | OPEN (LOW) | TransactionReview changeCategory O(n) array copy (deferred) |
| C24-06 | OPEN (LOW) | buildCardResults totalSpending no negative amount guard (safe in practice) |
| C27-02 | OPEN (LOW) | Duplicate NaN/zero checks in parseGenericCSV vs isValidAmount() |
| C31-01 | FIXED | SpendingSummary dismiss catch now logs console.warn matching C27-01/C30-03 pattern |
| C31-02 | FIXED | Redundant Map.set() call in greedyOptimize now uses explicit first-insertion check |

---

## New Findings (This Cycle)

### C32-01 | MEDIUM | High | `packages/parser/src/csv/generic.ts:124`

**Server-side `parseGenericCSV` uses `parseInt` for amount parsing while web-side uses `Math.round(parseFloat(...))` -- produces different amounts for the same input**

At line 124:
```typescript
const n = parseInt(cleaned, 10);
```

The web-side `csv.ts:42` uses:
```typescript
const parsed = Math.round(parseFloat(cleaned));
```

The difference: `parseInt("1234.56")` returns 1234 (truncation), while `Math.round(parseFloat("1234.56"))` returns 1235 (rounding). Korean Won amounts should be integers, but formula-rendered CSV cells can contain decimal remainders. The web-side correctly rounds (C21-03), while the server-side truncates. This means the CLI/server parser produces different amounts than the web app for the same input data.

This affects the `packages/parser` module used by `tools/cli/` and `tools/scraper/`. The web app (`apps/web/`) is unaffected because it uses its own parser with the correct rounding.

**Fix:** Replace `parseInt(cleaned, 10)` with `Math.round(parseFloat(cleaned))` in `packages/parser/src/csv/generic.ts:124`, matching the web-side behavior.

### C32-02 | LOW | High | `packages/parser/src/csv/generic.ts:231-236`

**Server-side `parseGenericCSV` does not filter zero-amount transactions, while web-side does (C26-02)**

At line 231-236:
```typescript
const amount = parseAmount(amountRaw);
if (amount === null) {
  // ...
  continue;
}
// No zero-amount filter here
```

The web-side `csv.ts` uses `isValidAmount()` which explicitly filters zero-amount rows (C26-02). The server-side `parseGenericCSV` includes zero-amount transactions. While the optimizer's `tx.amount > 0` filter excludes them from optimization, they inflate transaction counts and appear in CLI output. This is an inconsistency between server and client parsers.

**Fix:** Add `if (amount === 0) continue;` after the null check in `parseGenericCSV`, matching the web-side behavior.

### C32-03 | LOW | Medium | `packages/parser/src/csv/index.ts:71-77`

**Server-side `parseCSV` generic fallback has no try/catch wrapper, while web-side does (C30-02)**

At lines 71-77:
```typescript
// Fall back to generic parser
const result = parseGenericCSV(content, resolvedBank);
// Collect any signature-detection adapter failures into the result
for (const msg of signatureFailures) {
  result.errors.unshift({ message: msg });
}
return result;
```

The web-side `csv.ts` wraps `parseGenericCSV` in try/catch (C30-02), returning a proper error result on failure. The server-side `parseCSV` does not wrap the generic parser call in try/catch. If `parseGenericCSV` throws unexpectedly, the error propagates uncaught to the caller. The bank-specific adapter path (lines 42-52) catches errors and falls back, but the generic parser has no such protection.

**Fix:** Wrap `parseGenericCSV` in try/catch, returning an error result on failure (matching the web-side pattern from C30-02).

---

## Final Sweep -- Commonly Missed Issues

1. **C31-01 FIX CONFIRMED:** SpendingSummary dismiss catch now logs `console.warn` when sessionStorage is available but setItem fails.
2. **C31-02 FIX CONFIRMED:** `greedyOptimize` no longer has redundant `Map.set()` after `push()` -- uses explicit first-insertion check.
3. **No XSS risk**: All dynamic content rendered through Svelte/Astro template syntax which auto-escapes. No `innerHTML` patterns found.
4. **No secret leakage**: No API keys, tokens, or credentials in source code.
5. **CSP is properly configured**: Layout.astro has appropriate CSP headers with documented rationale.
6. **parseAmount consistency (web-side)**: All three web-side parsers (csv.ts, xlsx.ts, pdf.ts) use `Math.round(parseFloat(...))`. Confirmed consistent.
7. **parseAmount inconsistency (server-side)**: `packages/parser/src/csv/generic.ts` uses `parseInt` while web-side uses `Math.round(parseFloat(...))`. This is the new C32-01 finding.
8. **Zero-amount filtering (web-side)**: All three web-side parsers skip zero-amount rows. Confirmed consistent.
9. **Zero-amount filtering (server-side)**: `packages/parser/src/csv/generic.ts` does NOT skip zero-amount rows. This is the new C32-02 finding.
10. **date-utils.ts is properly centralized**: Web-side parsers delegate to `date-utils.ts` via `parseDateStringToISO`. Server-side parsers have their own implementation (C7-07/C20-02 divergence, already tracked).
11. **Server-side date parsing has range validation**: `packages/parser/src/csv/generic.ts` now validates month/day ranges for all date formats (matching the web-side date-utils.ts). This was likely added as part of the C29-03/C29-04 fixes. Confirmed consistent.
12. **AbortController patterns are consistent**: CardGrid, CardDetail, CardPage all properly clean up with generation counters and AbortController.
13. **SessionStorage access is properly guarded**: All accesses check `typeof sessionStorage !== 'undefined'` and wrap in try/catch.
14. **prefers-reduced-motion**: Handled at both CSS level (global rule in app.css) and JS level (SavingsComparison rAF animation check).
15. **`as any` usage**: Only in test files and in the `loadFromStorage` validation function, not in production logic paths.
16. **console.warn usage**: Properly scoped with `[cherrypicker]` prefix. Only used for diagnostics.
17. **categoryLabels Map construction**: Duplicated in three places: `store.svelte.ts:316-329`, `analyzer.ts:218-231`, `analyzer.ts:274-295`. Maintenance risk but not a correctness bug (already noted in C31-01 sweep).
18. **No race conditions in store.svelte.ts**: setResult, analyze, reoptimize all update result + generation atomically.
19. **Negative amounts handled**: parseAmount in CSV/XLSX handles negative amounts via `(1,234)` format and `-` prefix. PDF allows negative amounts. The optimizer's `tx.amount > 0` filter excludes negative amounts from optimization.
20. **buildCardResults Math.abs guard**: Line 224 uses `Math.abs(tx.amount)` for `totalSpending`, but all transactions reaching this point have `amount > 0` due to the filter at line 270. The `Math.abs` is a no-op safety guard.
21. **rewardTierRateSchema mutual exclusivity**: Zod schema at `schema.ts:21-24` enforces that `rate` and `fixedAmount` are mutually exclusive. The runtime warning in `reward.ts:265-269` is a second line of defense.
22. **ilp.ts stub**: The ILP optimizer delegates to `greedyOptimize` with a `console.debug` message. Not a bug, just a TODO.

---

## Summary

- **2 prior findings FIXED this cycle** (confirmed C31-01 and C31-02 fixes from cycle 31)
- **3 new findings** this cycle
  - C32-01: Server-side `parseGenericCSV` uses `parseInt` vs web-side `Math.round(parseFloat(...))` (MEDIUM, High)
  - C32-02: Server-side `parseGenericCSV` doesn't filter zero-amount transactions (LOW, High)
  - C32-03: Server-side `parseCSV` generic fallback has no try/catch (LOW, Medium)
- **All prior open findings verified as still open** with accurate file/line references
- No security, correctness, or data-loss issues found in the web app
- Server-side parser (packages/parser) has consistency gaps with the web-side parser
