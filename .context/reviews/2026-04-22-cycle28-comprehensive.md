# Cycle 28 Comprehensive Code Review -- 2026-04-22

**Scope:** Full re-read of all source files in `apps/web/src/`, `packages/core/src/`, `packages/rules/src/`, `packages/parser/src/`, `packages/viz/src/`, verification of all prior open findings, targeted pattern search for new issues.

---

## Verification of Prior Open Findings

All previously open findings from the aggregate were verified against current source code:

| Finding | Status | Evidence |
|---|---|---|
| C7-04 | OPEN (LOW) | TransactionReview `$effect` re-sync still uses `generation` counter pattern -- fragile but functional |
| C7-06 | OPEN (LOW) | `analyzer.ts:329` still filters to latest month; `transactions` field includes all months |
| C7-07 | OPEN (LOW) | `BANK_SIGNATURES` duplicated between `apps/web/src/lib/parser/detect.ts` and `packages/parser/src/detect.ts` |
| C7-11 | OPEN (LOW) | `store.svelte.ts:156` persist warning message for 'corrupted' says "거래 내역을 불러오지 못했어요" -- could be more specific about corruption vs. truncation |
| C8-05/C4-09 | OPEN (LOW) | `CategoryBreakdown.svelte:6-49` still uses hardcoded `CATEGORY_COLORS` with poor dark mode contrast on some entries |
| C8-07/C4-14 | OPEN (LOW) | `build-stats.ts:16-18` still has hardcoded fallback values `683/24/45` that drift from actual data |
| C8-08 | OPEN (LOW) | `inferYear()` in `date-utils.ts:20` -- timezone-dependent near midnight Dec 31. Code is centralized but timezone issue remains |
| C8-09 | OPEN (LOW) | Test files still duplicate production code (`parser-date.test.ts`, `analyzer-adapter.test.ts`) |
| C18-01 | OPEN (MEDIUM) | `VisibilityToggle.svelte:26-78` -- $effect with DOM manipulation. Has cached element refs with isConnected check but pattern remains fragile |
| C18-02 | OPEN (LOW) | `VisibilityToggle.svelte:38-58` -- stat element queries guarded but effect still runs on dashboard page where stat elements don't exist |
| C18-03 | OPEN (LOW) | `SavingsComparison.svelte:218` annual projection still multiplies by 12. Qualifier text is present. |
| C18-04 | OPEN (LOW) | `xlsx.ts:247` `isHTMLContent()` still only checks first 512 bytes as UTF-8 |
| C19-04 | OPEN (LOW) | `FileDropzone.svelte:220` still uses `window.location.href` for navigation |
| C19-05 | OPEN (LOW) | `CardDetail.svelte:276` still uses `window.location.href` for navigation |
| C20-02 | OPEN (LOW) | `csv.ts:79-91` DATE_PATTERNS/AMOUNT_PATTERNS divergence risk with date-utils.ts |
| C20-04 | OPEN (LOW) | `pdf.ts:21-27` module-level regex constants not shared with date-utils.ts |
| C21-02 | OPEN (LOW) | cards.ts shared fetch AbortSignal race (deferred) |
| C21-04/C23-02/C25-02/C26-03 | OPEN (LOW->MEDIUM) | cachedCategoryLabels/cachedCoreRules invalidated on explicit reset but stale across long-lived tabs |
| C22-04 | OPEN (LOW) | CSV adapter registry only covers 10 of 24 detected banks (deferred) |
| C22-05 | OPEN (LOW) | TransactionReview changeCategory O(n) array copy (deferred) |
| C24-06 | OPEN (LOW) | buildCardResults totalSpending no negative amount guard (safe in practice) |
| C25-01 | OPEN (MEDIUM) | CATEGORY_COLORS poor dark mode contrast (water, gas, electricity) |
| C25-09 | OPEN (MEDIUM) | CardDetail performance tier header dark mode contrast |
| C27-01 | OPEN (MEDIUM) | Bare `catch {}` in loadFromStorage inner cleanup inconsistent with C24-02 and C26-01 fix patterns |
| C27-02 | OPEN (LOW) | Duplicate NaN/zero checks in parseGenericCSV vs isValidAmount() -- maintenance divergence |

---

## New Findings (This Cycle)

### C28-01 | LOW | High | `apps/web/src/components/ui/VisibilityToggle.svelte:13`

**Duplicated formatWonStat function diverges from formatters.ts formatWon**

`VisibilityToggle.svelte` defines its own `formatWonStat()`:
```typescript
function formatWonStat(amount: number): string {
  return Number.isFinite(amount) ? amount.toLocaleString('ko-KR') + '원' : '0원';
}
```

This duplicates the logic in `formatters.ts:formatWon()`:
```typescript
export function formatWon(amount: number): string {
  if (!Number.isFinite(amount)) return '0원';
  if (amount === 0) amount = 0; // normalizes -0
  return amount.toLocaleString('ko-KR') + '원';
}
```

The divergence is subtle but real: `formatWon` normalizes `-0` to `+0`, while `formatWonStat` does not. In practice, this difference is unlikely to manifest (the optimizer never produces -0 amounts), but it's a maintenance risk -- if `formatWon` is updated (e.g., to add currency symbol, change locale, or handle a new edge case), `formatWonStat` will silently drift.

**Fix:** Replace `formatWonStat` with `formatWon` from `../../lib/formatters.js` and import it, matching the pattern used by all other dashboard components.

### C28-02 | LOW | Medium | `apps/web/src/lib/parser/xlsx.ts:386-395`

**XLSX parser does not filter zero-amount rows**

The CSV parser (via `isValidAmount`) and the PDF parser both skip zero-amount rows. The XLSX parser does not:
```typescript
const amount = parseAmount(amountRaw);
if (amount === null) {
  // ... error handling
  continue;
}
// No check for amount === 0
```

In practice, XLSX files from Korean card companies rarely contain zero-amount rows (balance inquiries, declined transactions are typically in CSV or PDF format). However, for consistency with the other parsers and to prevent zero-amount entries from reaching the optimizer (which would be filtered anyway by `greedyOptimize`'s `tx.amount > 0` check), a zero-amount guard should be added.

**Fix:** Add `if (amount === 0) continue;` after the null check, or create an `isValidXlsxAmount` helper similar to the CSV `isValidAmount`.

---

## Final Sweep -- Commonly Missed Issues

1. **No XSS risk**: All dynamic content rendered through Svelte/Astro template syntax which auto-escapes. No `innerHTML` patterns found.
2. **No secret leakage**: No API keys, tokens, or credentials in source code.
3. **CSP is properly configured**: Layout.astro has appropriate CSP headers with documented rationale for `unsafe-inline`.
4. **AbortController patterns are consistent**: CardGrid, CardDetail, CardPage all properly clean up with generation counters and AbortController.
5. **SessionStorage access is properly guarded**: All accesses check `typeof sessionStorage !== 'undefined'` and wrap in try/catch.
6. **No new security issues**: All fetch calls use same-origin URLs (static JSON files). No user-controlled URLs are fetched.
7. **prefers-reduced-motion**: Handled at both CSS level (global rule in app.css) and JS level (SavingsComparison rAF animation check). Consistent.
8. **parseAmount consistency**: All three parsers (csv.ts, xlsx.ts, pdf.ts) now use `Math.round(parseFloat(...))`. Confirmed consistent.
9. **parseInstallments shared helper**: csv.ts uses the shared `parseInstallments()` function. PDF parser uses `parseInt` directly in a simpler context. XLSX parser has its own `parseInstallments`.
10. **Duplicated BANK_SIGNATURES**: Still present between apps/web and packages/parser. Same as C7-07. Low priority.
11. **`as any` usage**: Only in test files (`analyzer-adapter.test.ts`), not in production code. Acceptable.
12. **console.warn usage**: Properly scoped with `[cherrypicker]` prefix. Only used for diagnostics, not user-facing errors.
13. **VisibilityToggle DOM mutation**: Still uses $effect with direct classList.toggle and textContent writes. Pattern is fragile but functional with isConnected guards. Same as C18-01.
14. **No race conditions in store.svelte.ts**: setResult, analyze, reoptimize all update result + generation atomically. The persistToStorage call is synchronous (sessionStorage.setItem). No async gap where result could be stale.
15. **Negative amounts handled**: parseAmount in CSV/XLSX handles negative amounts via `(1,234)` format and `-` prefix. PDF allows negative amounts. The optimizer's `tx.amount > 0` filter excludes negative amounts from optimization, which is correct (refunds/cancellations should not be optimized).

---

## Summary

- **2 new actionable findings** this cycle (both LOW; one is a code duplication risk, one is a missing consistency guard)
- **All prior open findings verified as still open** with accurate file/line references
- No security, correctness, or data-loss issues found this cycle
