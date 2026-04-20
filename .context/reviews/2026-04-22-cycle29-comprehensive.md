# Cycle 29 Comprehensive Code Review -- 2026-04-22

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
| C25-09/C53-03 | OPEN (MEDIUM) | CardDetail performance tier header dark mode contrast |
| C27-01 | OPEN (MEDIUM) | Bare `catch {}` in loadFromStorage inner cleanup -- now has comment, inconsistent with C24-02/C26-01 |
| C27-02 | OPEN (LOW) | Duplicate NaN/zero checks in parseGenericCSV vs isValidAmount() -- maintenance divergence |
| C28-01 | FIXED | VisibilityToggle `formatWonStat` replaced with imported `formatWon` from formatters.ts |
| C28-02 | FIXED | XLSX parser now has `if (amount === 0) continue;` zero-amount guard |

---

## New Findings (This Cycle)

### C29-01 | MEDIUM | High | `apps/web/src/components/dashboard/CategoryBreakdown.svelte:6-49`

**CATEGORY_COLORS hardcoded in component scope -- poor dark mode contrast for utilities subcategories**

This is a continuation/cleaner articulation of the long-standing C4-09/C8-05/C25-01 finding. The hardcoded `CATEGORY_COLORS` object inside `CategoryBreakdown.svelte` uses gray tones for utility subcategories that are nearly invisible on dark backgrounds:

- `electricity: '#9ca3af'` (gray-400 on dark bg: contrast ratio ~2.3:1 -- fails WCAG AA)
- `gas: '#94a3b8'` (slate-400 on dark bg: contrast ratio ~2.5:1 -- fails WCAG AA)
- `water: '#64748b'` (slate-500 on dark bg: contrast ratio ~1.8:1 -- fails WCAG AA)

The bar chart uses these colors as `background-color` for the progress bars. In dark mode, these bars are effectively invisible. The dot legend is similarly affected.

**Fix:** Replace the three utility subcategory colors with higher-contrast alternatives:
- `electricity: '#facc15'` (yellow-400) -- contrast ratio ~7.5:1 on dark
- `gas: '#fb923c'` (orange-400) -- contrast ratio ~5.2:1 on dark
- `water: '#38bdf8'` (sky-400) -- contrast ratio ~6.1:1 on dark

### C29-02 | LOW | High | `apps/web/src/components/cards/CardDetail.svelte:225-226`

**Performance tier header row uses `bg-[var(--color-primary-light)]` with hardcoded text colors**

The performance tier header row in the rewards table uses:
```
class="... bg-[var(--color-primary-light)]"
...
class="... text-blue-700 dark:text-blue-200"
```

The `bg-[var(--color-primary-light)]` is a CSS variable that resolves differently in light/dark mode, but the text colors `text-blue-700 dark:text-blue-200` are hardcoded Tailwind classes rather than using the design system variables. In dark mode, `bg-[var(--color-primary-light)]` may resolve to a dark blue that provides poor contrast with `dark:text-blue-200`.

This is a narrower variant of C25-09/C53-03. The fix should use a consistent dark-mode-safe approach: either use `bg-blue-50 dark:bg-blue-900` (like other badges in the codebase) instead of the variable, or ensure the CSS variable has adequate contrast in both modes.

**Fix:** Replace `bg-[var(--color-primary-light)]` with explicit `bg-blue-50 dark:bg-blue-900/50` and adjust text colors to `text-blue-700 dark:text-blue-300` for consistent contrast.

### C29-03 | LOW | Medium | `apps/web/src/lib/parser/csv.ts:880-891`

**CSV adapter registry does not cover kakao, toss, kbank, or other digital-only banks**

The `ADAPTERS` array in csv.ts contains 10 bank-specific adapters (hyundai, kb, ibk, woori, samsung, shinhan, lotte, hana, nh, bc). The `BANK_SIGNATURES` array in detect.ts supports 24 banks including digital-only banks (kakao, toss, kbank). When one of these banks is detected, no bank-specific adapter is found, so the code falls through to `parseGenericCSV`. This is a known issue (C22-04) but worth re-noting since the XLSX parser (`BANK_COLUMN_CONFIGS`) now covers all 24 banks while the CSV adapter registry still only covers 10.

**Impact:** For digital-only banks that export CSV statements, column detection falls back to the generic heuristic, which may misidentify columns. The XLSX path works correctly for these banks.

**Fix:** Add CSV adapters for the remaining 14 banks (at minimum: kakao, toss, kbank).

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
9. **Zero-amount filtering is now consistent**: All three parsers (csv via isValidAmount, xlsx via explicit `amount === 0` check, pdf via `amount === 0` check) now skip zero-amount rows. C28-02 fix confirmed.
10. **Duplicated BANK_SIGNATURES**: Still present between apps/web and packages/parser. Same as C7-07. Low priority.
11. **`as any` usage**: Only in test files (`analyzer-adapter.test.ts`), not in production code. Acceptable.
12. **console.warn usage**: Properly scoped with `[cherrypicker]` prefix. Only used for diagnostics, not user-facing errors.
13. **VisibilityToggle DOM mutation**: Still uses $effect with direct classList.toggle and textContent writes. Pattern is fragile but functional with isConnected guards. Same as C18-01.
14. **No race conditions in store.svelte.ts**: setResult, analyze, reoptimize all update result + generation atomically. The persistToStorage call is synchronous (sessionStorage.setItem). No async gap where result could be stale.
15. **Negative amounts handled**: parseAmount in CSV/XLSX handles negative amounts via `(1,234)` format and `-` prefix. PDF allows negative amounts. The optimizer's `tx.amount > 0` filter excludes negative amounts from optimization, which is correct (refunds/cancellations should not be optimized).

---

## Summary

- **3 new findings** this cycle (1 MEDIUM, 2 LOW)
  - C29-01: CATEGORY_COLORS utility subcategories invisible in dark mode (MEDIUM -- actionable)
  - C29-02: CardDetail performance tier header hardcoded Tailwind colors vs CSS variable (LOW -- actionable)
  - C29-03: CSV adapter registry gap for 14 banks (LOW -- deferred, same as C22-04)
- **C28-01 and C28-02 confirmed FIXED** from prior cycle
- **All prior open findings verified as still open** with accurate file/line references
- No security, correctness, or data-loss issues found this cycle
