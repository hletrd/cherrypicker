# Cycle 27 Comprehensive Code Review -- 2026-04-21

**Scope:** Full re-read of all source files in `apps/web/src/`, `packages/core/src/`, `packages/rules/src/`, `packages/parser/src/`, `packages/viz/src/`, verification of all prior open findings, targeted pattern search for new issues.

---

## Verification of Prior Open Findings

All previously open findings from the aggregate were verified against current source code:

| Finding | Status | Evidence |
|---|---|---|
| C7-04 | OPEN (LOW) | TransactionReview `$effect` re-sync still uses `generation` counter pattern -- fragile but functional |
| C7-06 | OPEN (LOW) | `analyzer.ts:321` still filters to latest month; `transactions` field includes all months |
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
| C21-01 | OPEN (MEDIUM) | VisibilityToggle $effect caches elements and checks isConnected, but getElementById pattern remains fragile |
| C21-02 | OPEN (LOW) | cards.ts shared fetch AbortSignal race (deferred) |
| C21-04/C23-02/C25-02/C26-03 | OPEN (LOW->MEDIUM) | cachedCategoryLabels/cachedCoreRules never invalidated across sessions -- C26-03 added `invalidateAnalyzerCaches()` for cachedCoreRules; cachedCategoryLabels is reset in store.reset(). Both now handled on explicit reset, but stale across long-lived tabs without reset. |
| C22-04 | OPEN (LOW) | CSV adapter registry only covers 10 of 24 detected banks (deferred) |
| C22-05 | OPEN (LOW) | TransactionReview changeCategory O(n) array copy (deferred) |
| C24-06 | OPEN (LOW) | buildCardResults totalSpending no negative amount guard (safe in practice) |
| C25-01 | OPEN (MEDIUM) | CATEGORY_COLORS poor dark mode contrast (water, gas, electricity) |
| C25-09 | OPEN (MEDIUM) | CardDetail performance tier header dark mode contrast |
| C26-01 | **FIXED** | SpendingSummary dismiss catch block now has explanatory comment inside catch |
| C26-02 | **FIXED** | parseGenericCSV now skips zero-amount rows after isValidAmount check (line 193) |
| C26-03 | **FIXED** | analyzer.ts now exports `invalidateAnalyzerCaches()` and store.reset() calls it (line 492) |

---

## New Findings (This Cycle)

### C27-01 | MEDIUM | High | `apps/web/src/lib/store.svelte.ts:253`

**Bare `catch {}` in loadFromStorage error handler**

In `loadFromStorage()`, the outer catch block has:
```typescript
catch {
  try { if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(STORAGE_KEY); } catch {}
}
```

The inner `catch {}` is a bare catch with no logging or comment. While this is a best-effort cleanup (removing corrupt data from sessionStorage), it's inconsistent with the C24-02 fix pattern that added `console.warn` for non-SSR sessionStorage failures, and the C26-01 fix that added an explanatory comment to the SpendingSummary dismiss catch. This specific catch could silently swallow a SecurityError in sandboxed iframes, which would be useful to know during debugging.

**Fix:** Add a comment explaining why the catch is empty (best-effort cleanup of corrupted data, SecurityError in sandboxed iframes is expected), or add a minimal `console.warn` matching the pattern in `clearStorage()`.

### C27-02 | LOW | High | `apps/web/src/lib/parser/csv.ts:187-189`

**Duplicate NaN/zero checks in parseGenericCSV**

After the C26-02 fix, `parseGenericCSV` now has two sequential checks:
```typescript
const amount = parseAmount(amountRaw);
if (Number.isNaN(amount)) {  // line 187 -- NaN check
  if (amountRaw) errors.push(...);
  continue;
}
if (amount === 0) continue;  // line 193 -- zero check (C26-02)
```

The bank-specific adapters use `isValidAmount()` which combines both checks. The generic parser has them inline, creating a subtle maintenance divergence. If a new check is added to `isValidAmount()` (e.g., a negative-amount guard), it would need to be duplicated here. The code works correctly as-is, but the inconsistency is a risk.

**Fix:** Replace the inline NaN + zero checks with `if (!isValidAmount(amount, amountRaw, i, errors)) continue;` to match the bank adapter pattern, and add a comment explaining that `isValidAmount` now also handles zero-amount filtering (C26-02).

### C27-03 | LOW | Medium | `apps/web/src/components/dashboard/SpendingSummary.svelte:133-137`

**parseInt without NaN guard in template reactive block**

The template computes month differences using `parseInt` in `{@const}` blocks:
```svelte
{@const m1 = parseInt(latestMonth.month.slice(5, 7), 10)}
{@const m2 = parseInt(prevMonth.month.slice(5, 7), 10)}
{@const y1 = parseInt(latestMonth.month.slice(0, 4), 10)}
{@const y2 = parseInt(prevMonth.month.slice(0, 4), 10)}
{@const monthDiff = (Number.isFinite(y1) && Number.isFinite(y2) && Number.isFinite(m1) && Number.isFinite(m2)) ? (y1 - y2) * 12 + (m1 - m2) : NaN}
```

The `Number.isFinite` guard on line 137 correctly catches NaN from `parseInt` (since `Number.isFinite(NaN)` is `false`). However, `parseInt` never returns `Infinity`, so the guard could use `!Number.isNaN(...)` for clarity. More importantly, `parseInt` returns `NaN` for non-numeric strings, and `Number.isFinite(NaN)` is indeed `false`, so the guard works correctly. No bug here -- just noting the defensive coding pattern is adequate.

**Status:** No action needed -- the existing guard is sufficient.

---

## Final Sweep -- Commonly Missed Issues

1. **No XSS risk**: All dynamic content rendered through Svelte/Astro template syntax which auto-escapes. No `innerHTML` patterns found.
2. **No secret leakage**: No API keys, tokens, or credentials in source code.
3. **CSP is properly configured**: Layout.astro has appropriate CSP headers with documented rationale for `unsafe-inline`.
4. **AbortController patterns are consistent**: CardGrid, CardDetail, CardPage all properly clean up with generation counters and AbortController.
5. **SessionStorage access is properly guarded**: All accesses check `typeof sessionStorage !== 'undefined'` and wrap in try/catch.
6. **No new security issues**: All fetch calls use same-origin URLs (static JSON files). No user-controlled URLs are fetched.
7. **prefers-reduced-motion**: Handled at both CSS level (global rule in app.css) and JS level (SavingsComparison rAF animation check). Consistent.
8. **Dead code removal confirmed**: `categorizer-ai.ts` is gone, TransactionReview has no AI categorizer import.
9. **parseAmount consistency**: All three parsers (csv.ts, xlsx.ts, pdf.ts) now use `Math.round(parseFloat(...))`. Confirmed consistent.
10. **parseInstallments shared helper**: csv.ts uses the shared `parseInstallments()` function (C24-01 fix). PDF parser uses `parseInt` directly in a simpler context (installment text matching).
11. **Duplicated BANK_SIGNATURES**: Still present between apps/web and packages/parser. Same as C7-07. Low priority.
12. **`as any` usage**: Only in test files (`analyzer-adapter.test.ts`), not in production code. Acceptable.
13. **console.warn usage**: Properly scoped with `[cherrypicker]` prefix. Only used for diagnostics, not user-facing errors.

---

## Summary

- **2 new actionable findings** this cycle (1 MEDIUM, 1 LOW; plus 1 no-action observation)
- **3 prior findings confirmed fixed** since last aggregate (C26-01, C26-02, C26-03)
- **All other prior open findings verified as still open** with accurate file/line references
