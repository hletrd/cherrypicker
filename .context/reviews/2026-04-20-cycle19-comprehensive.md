# Cycle 19 Comprehensive Code Review -- 2026-04-20

**Scope:** Full re-read of all source files in `apps/web/src/`, verification of all prior open findings, targeted pattern search for new issues.

---

## Verification of Prior Open Findings

All previously open findings from the aggregate were verified against current source code:

| Finding | Status | Evidence |
|---|---|---|
| C7-04 | OPEN (LOW) | TransactionReview `$effect` re-sync still uses `generation` counter pattern -- fragile but functional |
| C7-06 | OPEN (LOW) | `analyzer.ts:321` still filters to latest month; `transactions` field includes all months |
| C7-07 | OPEN (LOW) | `BANK_SIGNATURES` duplicated between `apps/web/src/lib/parser/detect.ts` and `packages/parser/src/detect.ts` |
| C7-11 | OPEN (LOW) | `store.svelte.ts:152` message says "거래 내역을 불러오지 못했어요" for both corruption and truncation |
| C8-01 | OPEN (MEDIUM) | `categorizer-ai.ts` still 40 lines of dead code (disabled AI categorizer). TransactionReview.svelte:6-13 still has 8 lines of re-enable comments |
| C8-05/C4-09 | OPEN (LOW) | `CategoryBreakdown.svelte:6-49` still uses hardcoded `CATEGORY_COLORS` with poor dark mode contrast on some entries |
| C8-07/C4-14 | OPEN (LOW) | `build-stats.ts:16-18` still has hardcoded fallback values `683/24/45` that drift from actual data |
| C8-08 | OPEN (LOW) | `inferYear()` in `date-utils.ts:20` -- timezone-dependent near midnight Dec 31. Code is now centralized (C18-05 FIXED) but timezone issue remains. |
| C8-09 | OPEN (LOW) | Test files still duplicate production code (e.g., `parser-date.test.ts`, `analyzer-adapter.test.ts`) |
| C8-10 | OPEN (LOW) | `csv.ts:248` `inst > 1` implicitly filters NaN installment values |
| C8-11 | OPEN (LOW) | `pdf.ts:353` fallback date regex could match "3.5" as MM.DD |
| C9R-03/C16-01 | OPEN (LOW, path works) | pdf.ts negative amounts now pass through; store allows !== 0. Both ends fixed. |
| C18-01 | OPEN (MEDIUM) | `VisibilityToggle.svelte:26-78` still uses `$effect` with direct DOM manipulation. Cleanup function was added (lines 62-77), and stat elements are only queried when `hasData` is true (line 39). However, the effect still runs on every store change on every page, and the DOM manipulation pattern remains fragile. |
| C18-02 | OPEN (LOW) | `VisibilityToggle.svelte:38-58` -- stat element queries are guarded by `if (hasData && totalSpending)` but the effect still runs on dashboard page where stat elements don't exist. The null checks prevent errors but waste computation. |
| C18-03 | OPEN (LOW) | `SavingsComparison.svelte:207` annual projection still multiplies by 12. Qualifier text is present. |
| C18-04 | OPEN (LOW) | `xlsx.ts:312-314` `isHTMLContent()` still only checks first 512 bytes as UTF-8. EUC-KR files would not be detected. BOM is now stripped (line 313). |
| C18-05 | **FIXED** | `inferYear()` is now centralized in `date-utils.ts`. All three parsers (`csv.ts:27`, `xlsx.ts:182`, `pdf.ts:143`) import from `./date-utils.js`. Triplication eliminated. |
| D-106 | OPEN (LOW) | `pdf.ts:295` `catch {}` in `tryStructuredParse` -- bare catch, but returning null is the intended fallback |
| D-110 | OPEN (LOW) | Non-latest month edits have no visible optimization effect |
| D-66 | OPEN (LOW) | CardGrid issuer filter shows issuers with 0 cards after type filter |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C19-01 | MEDIUM | High | `csv.ts:29-101`, `xlsx.ts:184-272`, `pdf.ts:145-203` | `parseDateToISO` is triplicated with near-identical logic across all three parsers. Unlike `inferYear` which was consolidated into `date-utils.ts` (C18-05 fix), `parseDateToISO` still has three copies: `csv.ts:29-101`, `xlsx.ts:184-272`, `pdf.ts:145-203`. The xlsx version accepts `unknown` (handles Excel serial dates), while csv/pdf versions accept `string`, but the string-parsing branches are identical. Any date-parsing fix (e.g., adding new format support, fixing edge cases) must be applied three times. |
| C19-02 | MEDIUM | Medium | `VisibilityToggle.svelte:26-78` | The `$effect` cleanup function (lines 62-77) queries DOM elements by ID on cleanup. If the component has already unmounted (e.g., Astro page navigation), the elements won't exist and the cleanup is a no-op -- but the real problem is that on page navigation within the Astro SPA (via View Transitions or ClientRouter), the old VisibilityToggle's cleanup runs after the new page's elements are mounted. If the new page has elements with the same IDs (e.g., navigating between dashboard and results), the cleanup could reset elements that belong to the new page instance. This is a theoretical race condition that becomes real with client-side navigation. |
| C19-03 | LOW | High | `CardPage.svelte:34` | `window.location.hash = id` sets the hash for card selection, but `goBack()` on line 40 uses `history.replaceState(null, '', window.location.pathname + window.location.search)` which strips the hash. If the user navigates back via browser's back button, the `hashchange` listener on line 49-51 correctly updates `selectedCardId`, but the breadcrumb "카드 목록" button uses `goBack()` which does a `replaceState` instead of `pushState`, meaning the card detail view is not in the browser history. The user cannot use the browser back button to return to a previously viewed card. |
| C19-04 | LOW | High | `FileDropzone.svelte:217` | Navigation after successful upload uses `window.location.href = buildPageUrl('dashboard')` which causes a full page reload instead of client-side navigation. This discards all JavaScript state (including the analysis results in sessionStorage). While sessionStorage survives the reload, the full reload is slower and causes a visible flash. With Astro's ClientRouter, `navigate()` would provide a smoother transition. |
| C19-05 | LOW | Medium | `CardDetail.svelte:276` | Same as C19-04 pattern: `window.location.href = buildPageUrl('cards')` causes full page reload when navigating from card detail back to the card list. The card list data must be re-fetched from the server after navigation. |
| C19-06 | LOW | High | `csv.ts:131-137` | `DATE_PATTERNS` and `AMOUNT_PATTERNS` arrays are recreated as module-level constants with regex literals that lack the `^...$` anchors in some entries. `AMOUNT_PATTERNS[1]` (`/^-?[\d,]+\.?\d*원?$/`) would match amounts with decimal fractions like "1,234.56" but `parseAmount` uses `parseInt` which silently truncates decimals. For Korean Won amounts this is irrelevant (Won has no subunits), but the regex pattern is misleading -- it suggests decimal amounts are supported when they will be truncated. |
| C19-07 | LOW | Medium | `store.svelte.ts:139-150` | `isValidTx` uses `tx.amount !== 0` to filter out zero-amount transactions, but this also filters legitimate zero-amount entries like balance inquiries or declined transactions. The comment says "allowing refunds" but the code actually blocks zero amounts. This is intentional (zero amounts are not real spending), but the function name `isValidTx` is misleading -- it should be `isSpendableTx` or similar to clarify that zero-amount transactions are considered invalid for optimization purposes. |

---

## Final Sweep -- Commonly Missed Issues

1. **No XSS risk**: All dynamic content rendered through Svelte/Astro template syntax which auto-escapes. No `innerHTML` or `v-html` patterns.
2. **No secret leakage**: No API keys, tokens, or credentials in source code.
3. **CSP is properly configured**: `Layout.astro:42` has appropriate CSP headers with documented rationale for `unsafe-inline`.
4. **AbortController patterns are consistent**: CardGrid, CardDetail, CardPage all properly clean up with generation counters and AbortController.
5. **SessionStorage access is properly guarded**: All accesses check `typeof sessionStorage !== 'undefined'` and wrap in try/catch.
6. **`inferYear` consolidation (C18-05) is verified as correctly applied**: All three parsers import from `./date-utils.js`.
7. **parseDateToISO triplication (C19-01) is the most impactful new finding**: It creates the same maintainability risk that `inferYear` triplication did, and should be consolidated similarly.
8. **Full-page reload navigation pattern (C19-04, C19-05)**: Two `window.location.href` assignments cause full reloads that discard JS state. These could be improved with Astro's `navigate()` API for client-side transitions.

---

## Summary

- **7 new findings** this cycle (2 MEDIUM, 5 LOW)
- **1 prior finding confirmed fixed** (C18-05: `inferYear` triplication)
- **All other prior open findings verified as still open** with accurate file/line references
