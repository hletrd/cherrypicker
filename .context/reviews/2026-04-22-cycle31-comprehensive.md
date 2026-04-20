# Cycle 31 Comprehensive Code Review -- 2026-04-22

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
| C8-05/C4-09 | OPEN (LOW) | `CategoryBreakdown.svelte:6-49` still uses hardcoded `CATEGORY_COLORS` -- utility colors fixed (C29-01), non-utility entries remain unchanged |
| C8-07/C4-14 | OPEN (LOW) | `build-stats.ts:16-18` still has hardcoded fallback values `683/24/45` that drift from actual data |
| C8-08 | OPEN (LOW) | `inferYear()` in `date-utils.ts:20` -- timezone-dependent near midnight Dec 31. Code is centralized but timezone issue remains |
| C8-09 | OPEN (LOW) | Test files still duplicate production code (`parser-date.test.ts`, `analyzer-adapter.test.ts`) |
| C18-01 | OPEN (MEDIUM) | `VisibilityToggle.svelte:26-78` -- $effect with DOM manipulation. Has cached element refs with isConnected check but pattern remains fragile |
| C18-02 | OPEN (LOW) | `VisibilityToggle.svelte:38-58` -- stat element queries guarded but effect still runs on dashboard page where stat elements don't exist |
| C18-03 | OPEN (LOW) | `SavingsComparison.svelte:218` annual projection still multiplies by 12. Qualifier text is present. |
| C18-04 | OPEN (LOW) | `xlsx.ts:247` `isHTMLContent()` still only checks first 512 bytes as UTF-8 |
| C19-04 | OPEN (LOW) | `FileDropzone.svelte:220` still uses `window.location.href` for navigation |
| C19-05 | OPEN (LOW) | `CardDetail.svelte:276` still uses `window.location.href` for navigation |
| C21-02 | OPEN (LOW) | cards.ts shared fetch AbortSignal race (deferred) |
| C21-04/C23-02/C25-02/C26-03 | OPEN (LOW->MEDIUM) | cachedCategoryLabels/cachedCoreRules invalidated on explicit reset but stale across long-lived tabs |
| C22-04 | OPEN (LOW) | CSV adapter registry only covers 10 of 24 detected banks (deferred) |
| C22-05 | OPEN (LOW) | TransactionReview changeCategory O(n) array copy (deferred) |
| C24-06 | OPEN (LOW) | buildCardResults totalSpending no negative amount guard (safe in practice) |
| C25-01/C29-01 | FIXED | CATEGORY_COLORS utility subcategories now high-contrast in dark mode |
| C25-09/C53-03/C29-02 | FIXED | CardDetail performance tier header now uses consistent dark mode colors |
| C27-01/C30-03 | FIXED | loadFromStorage inner catch now logs console.warn when sessionStorage is available but removeItem fails |
| C30-02 | FIXED | parseCSV generic fallback path now wrapped in try/catch for defensive consistency |
| C27-02 | OPEN (LOW) | Duplicate NaN/zero checks in parseGenericCSV vs isValidAmount() -- maintenance divergence |

---

## New Findings (This Cycle)

### C31-01 | LOW | High | `apps/web/src/components/dashboard/SpendingSummary.svelte:147`

**Dismiss button `catch {}` silently swallows sessionStorage errors without console.warn, inconsistent with the C27-01/C30-03 fix pattern**

At line 147, the dismiss button's onclick handler has:
```typescript
try { sessionStorage.setItem('cherrypicker:dismissed-warning', '1'); } catch { /* non-critical: dismissal just won't persist across loads */ }
```

After the C27-01/C30-03 fix, `loadFromStorage`'s inner catch and `clearStorage` both log `console.warn` when sessionStorage is available but the operation fails. This dismiss button catch has a code comment (added as part of the C26-01 fix) but does NOT log a warning. When sessionStorage is available but `setItem` fails (e.g., SecurityError in sandboxed iframes, or quota exceeded), the failure is silently swallowed with no diagnostic trail.

This is purely a consistency issue -- the dismissal is genuinely non-critical and the UI still functions correctly. But for debugging production issues, having consistent logging across all sessionStorage catch blocks makes it easier to diagnose why a user's dismiss preference isn't persisting.

**Fix:** Add the same `console.warn` guard from `clearStorage` and `loadFromStorage`:
```typescript
catch (err) {
  // Dismissal won't persist -- non-critical, but log when sessionStorage
  // is available and the failure isn't an expected SSR/sandbox scenario.
  if (typeof sessionStorage !== 'undefined') {
    console.warn('[cherrypicker] Failed to persist dismiss state:', err);
  }
}
```

### C31-02 | LOW | Medium | `packages/core/src/optimizer/greedy.ts:289-290`

**Redundant `Map.set()` call after `push()` on same array reference**

At line 289-290:
```typescript
const currentTransactions = assignedTransactionsByCard.get(best.cardId) ?? [];
currentTransactions.push(transaction);
assignedTransactionsByCard.set(best.cardId, currentTransactions);
```

The `?? []` fallback only creates a new array when the key doesn't exist in the map. When it does exist, `currentTransactions` is the same reference already stored in the map, so `push()` mutates the stored array in-place. The subsequent `.set()` call is then a no-op (same key, same reference). This isn't a bug -- it works correctly -- but the `.set()` call adds unnecessary cognitive overhead. A reader might assume `.set()` is needed because a new array was created, when in fact it's only needed on the first insertion (when `?? []` fires).

**Fix:** Replace with a pattern that only sets on first insertion:
```typescript
let currentTransactions = assignedTransactionsByCard.get(best.cardId);
if (!currentTransactions) {
  currentTransactions = [transaction];
  assignedTransactionsByCard.set(best.cardId, currentTransactions);
} else {
  currentTransactions.push(transaction);
}
```

Or add a comment explaining why the `.set()` is intentionally kept (defensive against future refactoring that might break the aliasing assumption).

---

## Final Sweep -- Commonly Missed Issues

1. **C27-01/C30-03 FIX CONFIRMED:** `loadFromStorage` inner catch now logs `console.warn` when sessionStorage is available but removeItem fails. Consistent with `clearStorage` pattern.
2. **C30-02 FIX CONFIRMED:** `parseCSV` generic fallback path now wrapped in try/catch, returning a proper error result on failure.
3. **No XSS risk**: All dynamic content rendered through Svelte/Astro template syntax which auto-escapes. No `innerHTML` patterns found.
4. **No secret leakage**: No API keys, tokens, or credentials in source code.
5. **CSP is properly configured**: Layout.astro has appropriate CSP headers with documented rationale for `unsafe-inline`.
6. **AbortController patterns are consistent**: CardGrid, CardDetail, CardPage all properly clean up with generation counters and AbortController.
7. **SessionStorage access is properly guarded**: All accesses check `typeof sessionStorage !== 'undefined'` and wrap in try/catch.
8. **No new security issues**: All fetch calls use same-origin URLs (static JSON files). No user-controlled URLs are fetched.
9. **prefers-reduced-motion**: Handled at both CSS level (global rule in app.css) and JS level (SavingsComparison rAF animation check). Consistent.
10. **parseAmount consistency**: All three parsers (csv.ts, xlsx.ts, pdf.ts) now use `Math.round(parseFloat(...))`. Confirmed consistent.
11. **Zero-amount filtering is now consistent**: All three parsers skip zero-amount rows. Confirmed.
12. **Duplicated BANK_SIGNATURES**: Still present between apps/web and packages/parser. Same as C7-07. Low priority.
13. **`as any` usage**: Only in test files (`analyzer-adapter.test.ts`) and in the `loadFromStorage` validation function (line 203 and 242 where it iterates parsed JSON), not in production logic paths. Acceptable.
14. **console.warn usage**: Properly scoped with `[cherrypicker]` prefix. Only used for diagnostics, not user-facing errors. Except for SpendingSummary dismiss catch (C31-01).
15. **VisibilityToggle DOM mutation**: Still uses $effect with direct classList.toggle and textContent writes. Pattern is fragile but functional with isConnected guards. Same as C18-01.
16. **No race conditions in store.svelte.ts**: setResult, analyze, reoptimize all update result + generation atomically. The persistToStorage call is synchronous (sessionStorage.setItem). No async gap where result could be stale.
17. **Negative amounts handled**: parseAmount in CSV/XLSX handles negative amounts via `(1,234)` format and `-` prefix. PDF allows negative amounts. The optimizer's `tx.amount > 0` filter excludes negative amounts from optimization, which is correct.
18. **CardDetail AbortController cleanup**: Confirmed at line 82-95 -- proper AbortController creation, chained signal, and cleanup on effect return.
19. **FileDropzone previousMonthSpending parsing**: Uses `Math.round(Number(v))` with `Number.isFinite(n) && n >= 0` guard. Safe against NaN and negative values.
20. **MerchantMatcher empty-string guard**: Confirmed at matcher.ts -- `if (lower.length < 2) return { category: 'uncategorized', confidence: 0.0 }`. The C10-13 finding is fixed.
21. **isOptimizableTx validation**: Checks `typeof obj.amount === 'number' && Number.isFinite(obj.amount) && obj.amount !== 0` -- properly guards against NaN/Infinity. No issue.
22. **greedyOptimize transaction filter**: Line 270 filters with `tx.amount > 0 && Number.isFinite(tx.amount)` -- properly guards against NaN/Infinity in the optimizer.
23. **buildCategoryKey consistency**: Both `analyzer.ts` (line 227, 290) and `greedy.ts` (line 149, 28) use `buildCategoryKey(category, subcategory)` which produces `category.subcategory` format. Consistent across the codebase.
24. **categoryLabels Map construction**: Duplicated in three places: `store.svelte.ts:316-329`, `analyzer.ts:218-231`, `analyzer.ts:274-295`. The store caches its own copy, the analyzer builds fresh copies. This is a maintenance risk but not a correctness bug.

---

## Summary

- **2 prior findings FIXED this cycle** (confirmed from C27-01/C30-03 and C30-02 fixes applied in cycle 30)
  - C27-01/C30-03: loadFromStorage inner catch now logs console.warn
  - C30-02: parseCSV generic fallback wrapped in try/catch
- **2 new findings** this cycle (both LOW)
  - C31-01: SpendingSummary dismiss catch inconsistent with C27-01/C30-03 console.warn pattern (LOW, High)
  - C31-02: Redundant Map.set() call in greedyOptimize after in-place push (LOW, Medium)
- **All prior open findings verified as still open** with accurate file/line references
- No security, correctness, or data-loss issues found this cycle
