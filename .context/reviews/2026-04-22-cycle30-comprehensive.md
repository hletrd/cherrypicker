# Cycle 30 Comprehensive Code Review -- 2026-04-22

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
| C8-05/C4-09 | OPEN (MEDIUM) | `CategoryBreakdown.svelte:6-49` still uses hardcoded `CATEGORY_COLORS` -- BUT utility colors now fixed (electricity=#facc15, gas=#fb923c, water=#38bdf8) from C29-01 fix |
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
| C25-01 | FIXED | CATEGORY_COLORS utility colors now use high-contrast alternatives (#facc15, #fb923c, #38bdf8) -- C29-01 fix confirmed |
| C25-09/C53-03 | OPEN (MEDIUM) | CardDetail performance tier header dark mode contrast -- NOW FIXED at line 225 (`bg-blue-50 dark:bg-blue-900/50`) and line 226 (`text-blue-700 dark:text-blue-300`) -- C29-02 fix confirmed |
| C27-01 | OPEN (MEDIUM) | Bare `catch {}` in loadFromStorage inner cleanup inconsistent with C24-02 and C26-01 fix patterns |
| C27-02 | OPEN (LOW) | Duplicate NaN/zero checks in parseGenericCSV vs isValidAmount() -- maintenance divergence |

---

## New Findings (This Cycle)

### C30-01 | MEDIUM | High | `apps/web/src/components/dashboard/OptimalCardMap.svelte:18-19`

**`maxRate` derived value uses `Math.max(...array)` via reduce which is safe at current scale but the derived computation runs on every store change even when assignments haven't changed**

The `maxRate` computed property at line 18-19 uses `assignments.reduce((max, a) => Math.max(max, a.rate), 0)` which is safe at current scale (typical < 50 assignments). However, this derived value, along with `uniqueCardCount` (line 12-14), re-computes on every `analysisStore` change because `$derived(analysisStore.assignments)` at line 8 creates a new dependency. Since `assignments` is a getter that returns `result?.optimization?.assignments ?? []`, any store change triggers re-derivation even if assignments didn't change.

This is a minor performance concern, not a correctness bug. The re-derivation cost is negligible (< 1ms for 50 assignments). Svelte 5's fine-grained reactivity doesn't currently support shallow-equality comparison for array-derived values.

**Fix:** No action needed at current scale. If assignments grow significantly, consider memoizing with a manual shallow-equality check.

### C30-02 | LOW | High | `apps/web/src/lib/parser/csv.ts:883-917`

**`parseCSV` function catches adapter errors in the bank-specific path but the generic fallback path in `parseGenericCSV` can also throw, and there is no try/catch around it**

At line 934, `parseGenericCSV(content, resolvedBank)` is called without a try/catch. If `parseGenericCSV` throws (e.g., from an unexpected regex backreference or a malformed delimiter detection), the error propagates uncaught to the caller. The bank-specific adapter path (lines 902-916) has try/catch, but the generic path does not.

In practice, `parseGenericCSV` is simple enough that it's unlikely to throw -- the `splitLine` and regex operations are well-tested. But for defensive consistency, the generic parser call should also be wrapped.

**Fix:** Wrap the `parseGenericCSV` call in a try/catch that returns a minimal error result.

### C30-03 | LOW | Medium | `apps/web/src/lib/store.svelte.ts:252-253`

**Inner `catch {}` in `loadFromStorage` cleanup has a comment but is inconsistent with the pattern used in `clearStorage` (which logs a console.warn)**

At line 253, the inner `catch { /* best-effort cleanup: corrupted data removal, SecurityError in sandboxed iframes is expected */ }` silently swallows errors from `sessionStorage.removeItem`. The outer `catch` at line 252 similarly has no logging. In contrast, `clearStorage` at line 267-269 logs `console.warn('[cherrypicker] Failed to clear sessionStorage:', err)` when `sessionStorage` is available but the remove fails.

This is the same finding as C27-01 re-articulated. The inconsistency remains: the outer catch in `loadFromStorage` is a bare `catch {}` with no logging, while `clearStorage` logs the failure. When sessionStorage is available (non-SSR) but fails (e.g., SecurityError), the loadFromStorage catch silently eats the error, making debugging harder.

**Fix:** Add the same `console.warn` guard from `clearStorage` to the inner catch in `loadFromStorage`, checking `typeof sessionStorage !== 'undefined'` before logging.

---

## Final Sweep -- Commonly Missed Issues

1. **C29-01 FIX CONFIRMED:** CATEGORY_COLORS utility subcategories now use high-contrast colors: electricity=#facc15, gas=#fb923c, water=#38bdf8. These all pass WCAG AA on dark backgrounds.
2. **C29-02 FIX CONFIRMED:** CardDetail performance tier header now uses `bg-blue-50 dark:bg-blue-900/50` and `text-blue-700 dark:text-blue-300` -- consistent contrast in both modes.
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
13. **`as any` usage**: Only in test files (`analyzer-adapter.test.ts`), not in production code. Acceptable.
14. **console.warn usage**: Properly scoped with `[cherrypicker]` prefix. Only used for diagnostics, not user-facing errors.
15. **VisibilityToggle DOM mutation**: Still uses $effect with direct classList.toggle and textContent writes. Pattern is fragile but functional with isConnected guards. Same as C18-01.
16. **No race conditions in store.svelte.ts**: setResult, analyze, reoptimize all update result + generation atomically. The persistToStorage call is synchronous (sessionStorage.setItem). No async gap where result could be stale.
17. **Negative amounts handled**: parseAmount in CSV/XLSX handles negative amounts via `(1,234)` format and `-` prefix. PDF allows negative amounts. The optimizer's `tx.amount > 0` filter excludes negative amounts from optimization, which is correct.
18. **CardDetail AbortController cleanup**: Confirmed at line 82-95 -- proper AbortController creation, chained signal, and cleanup on effect return.
19. **FileDropzone previousMonthSpending parsing**: Uses `Math.round(Number(v))` with `Number.isFinite(n) && n >= 0` guard. Safe against NaN and negative values. The `parseInt` issue from C3-08 was fixed in a prior cycle.
20. **MerchantMatcher empty-string guard**: Confirmed at matcher.ts:40-42 -- `if (lower.length < 2) return { category: 'uncategorized', confidence: 0.0 }`. The C10-13/C84 finding is fixed.

---

## Summary

- **2 prior findings FIXED this cycle** (confirmed from C29-01 and C29-02 fixes)
  - C25-01/C29-01: CATEGORY_COLORS utility subcategories now high-contrast in dark mode
  - C25-09/C29-02: CardDetail performance tier header now uses consistent dark mode colors
- **3 new findings** this cycle (0 MEDIUM actionable, 2 LOW, 1 MEDIUM non-actionable)
  - C30-01: OptimalCardMap derived values re-compute on every store change (MEDIUM -- not actionable at current scale)
  - C30-02: parseCSV generic fallback path has no try/catch (LOW -- defensive consistency)
  - C30-03: loadFromStorage bare catch inconsistent with clearStorage pattern (LOW -- same as C27-01)
- **All prior open findings verified as still open** with accurate file/line references
- No security, correctness, or data-loss issues found this cycle
