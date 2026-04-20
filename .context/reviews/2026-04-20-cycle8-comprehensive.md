# Comprehensive Code Review -- Cycle 8 (2026-04-20)

**Reviewer:** multi-angle (code quality, perf, security, debugger, architect, designer, test, verifier)
**Scope:** Full repository -- all packages, apps, tools, tests
**Focus:** New findings beyond cycles 1-7; verification of cycle 7 fixes; deep analysis of edge cases and cross-file interactions

---

## Verification of Cycle 7 Fixes

| Fix | Status | Notes |
|-----|--------|-------|
| C7-01: SavingsComparison breakdown table inline rate formatting | **FIXED** | Line 263 now uses `formatRate(card.rate)` |
| C7-02: SpendingSummary effective rate inline formatting | **FIXED** | Line 111 now uses `formatRatePrecise(analysisStore.optimization.effectiveRate)` |
| C7-03: SavingsComparison best single card rate inline formatting | **FIXED** | Line 180 now uses `formatRatePrecise(opt.bestSingleCard.totalReward / opt.totalSpending)` |
| C7-08: PDF parser parseDateToISO doesn't handle Korean short-date | **FIXED** | `inferYear()` added at line 137, Korean short-date handled at lines 182-191, MM/DD at lines 194-201 |
| C7-09: formatDateKo/formatDateShort parseInt without NaN guard | **FIXED** | Lines 155 and 169 now have `Number.isNaN` checks |

All cycle 7 HIGH/MEDIUM fixes verified as correctly implemented.

---

## New Findings

### C8-01: AI categorizer is disabled but TransactionReview still shows AI button

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/lib/categorizer-ai.ts` + `apps/web/src/components/dashboard/TransactionReview.svelte:49,262`
- **Description:** The `categorizer-ai.ts` module is entirely disabled -- `isAvailable()` always returns `false`, and all functions throw errors. However, `TransactionReview.svelte` still calls `aiCategorizer.isAvailable()` at line 49 to set `aiAvailable`, and conditionally renders the "AI 분류" button at line 262. Since `isAvailable()` returns `false`, the button is never shown. But the import at line 6 still brings in the dead code, and the `runAICategorization()` function (lines 77-143) is 65+ lines of unreachable code that will never execute. This dead code adds bundle size and confuses developers who might try to enable it.
- **Failure scenario:** Developer sees the AI button code and tries to enable it, but the `initialize()` function always throws. They waste time debugging why the feature doesn't work.
- **Fix:** Either (a) remove the dead AI categorization code from TransactionReview until the feature is ready, or (b) add a feature flag comment and gate the import. At minimum, add a prominent comment explaining the disabled state.

### C8-02: `CardDetail.svelte` `$effect` fetch doesn't clean up on cardId change

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/components/cards/CardDetail.svelte:77-92`
- **Description:** The `$effect` at line 77 fires on `cardId` changes and calls `getCardDetail(cardId)` via `.then()/.catch()/.finally()`. The `fetchGeneration` counter is used to discard stale results, which is correct. However, the `.then()/.catch()/.finally()` chain is not abortable -- if the user navigates away from the card detail page while the fetch is in-flight, the promise resolution still runs, mutating `card`, `error`, and `loading` state on an unmounted component. In Svelte 5, `$effect` cleanup runs when the effect re-runs or the component is destroyed, but this effect never registers a cleanup function (no `return` statement), so the stale promises are never cancelled. Unlike `CardPage.svelte` which uses a similar pattern but with `AbortController`, CardDetail relies solely on the generation counter.
- **Failure scenario:** User clicks a card to view details, then quickly navigates back to the card list. The fetch resolves after navigation, setting state on the (now unmounted) CardDetail component. While Svelte 5 typically handles this gracefully, it can cause console warnings about setting state on destroyed components, and in edge cases, memory leaks from dangling promise chains.
- **Fix:** Use `AbortController` in the `$effect` and abort it in the cleanup function:
  ```typescript
  $effect(() => {
    if (!cardId) { loading = false; return; }
    loading = true; error = null;
    const controller = new AbortController();
    getCardDetail(cardId, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) card = result; })
      .catch(e => { if (!controller.signal.aborted) error = e.message; })
      .finally(() => { if (!controller.signal.aborted) loading = false; });
    return () => controller.abort();
  });
  ```
  This requires `getCardDetail` to accept an `AbortSignal` parameter.

### C8-03: `SpendingSummary.svelte` month diff calculation assumes consecutive months

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/SpendingSummary.svelte:119-121`
- **Description:** Lines 119-121 compute `m1` and `m2` by parsing the month number from the `month` string via `parseInt(latestMonth.month.slice(5, 7), 10)`. The label logic at line 121 uses `Math.abs(m1 - m2) <= 1` to decide between "전월실적" and "이전 달 실적". This assumes consecutive months -- if the user uploads January and March data (skipping February), `m1=3, m2=1`, `Math.abs(3-1)=2`, so it shows "이전 달 실적" even though the data gap is just one month. More critically, this logic breaks for year boundaries: December (12) to January (1) gives `Math.abs(12-1)=11`, which shows "이전 달 실적" instead of "전월실적" for what is actually a consecutive month (Dec to Jan).
- **Failure scenario:** User uploads December 2025 and January 2026 statements. The label shows "이전 달 실적" instead of "전월실적", which is confusing because these ARE consecutive months.
- **Fix:** Compare the ISO month strings directly rather than extracting the month number. Use `latestMonth.month` and `prevMonth.month` to compute whether they are truly consecutive:
  ```typescript
  const prevDate = new Date(prevMonth.month + '-01');
  const nextDate = new Date(latestMonth.month + '-01');
  const monthDiff = (nextDate.getFullYear() - prevDate.getFullYear()) * 12 + nextDate.getMonth() - prevDate.getMonth();
  const prevLabel = monthDiff === 1 ? '전월실적' : '이전 달 실적';
  ```

### C8-04: `SavingsComparison.svelte` count-up animation doesn't cancel on component destroy

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:53-71`
- **Description:** The `$effect` at line 53 correctly returns a cleanup function that cancels the `requestAnimationFrame`. This is well-implemented. However, if the `opt` reference changes while the animation is running (e.g., user triggers reoptimize), the effect re-runs, the old animation is cancelled, and a new one starts from `startVal = displayedSavings`. This is correct behavior. No real issue here -- the cancellation is handled properly. Downgraded to informational.
- **Failure scenario:** None -- the cleanup function handles this correctly.
- **Fix:** No fix needed.

### C8-05: `CategoryBreakdown.svelte` hardcoded CATEGORY_COLORS lacks dark mode contrast for several categories

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:6-49`
- **Description:** Several CATEGORY_COLORS have poor contrast against dark mode backgrounds. For example: `utilities: '#6b7280'`, `insurance: '#64748b'`, `parking: '#78716c'`, `toll: '#a8a29e'`, and `uncategorized: '#d1d5db'` are all gray-toned colors that are difficult to distinguish from each other and from the dark mode background. The colored dot indicator at line 178 is only 2.5x2.5 pixels (h-2.5 w-2.5), making it nearly impossible for users with color vision deficiency to differentiate these categories. This extends the prior finding C4-09/C52-05.
- **Failure scenario:** A user in dark mode cannot distinguish between utilities, insurance, and uncategorized categories in the breakdown chart because all three use nearly identical gray tones on a dark background.
- **Fix:** Use distinct, saturated colors for dark mode by applying CSS variables or conditional class-based colors. Alternatively, use Tailwind's `dark:` variant to swap colors in dark mode.

### C8-06: `FileDropzone.svelte` and `CardDetail.svelte` use full page reload navigation

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/upload/FileDropzone.svelte:217` + `apps/web/src/components/cards/CardDetail.svelte:272`
- **Description:** Both components use `window.location.href = ...` for navigation, causing a full page reload. Astro supports view transitions via `navigate()` from `astro:transitions`. Using full page reloads loses all client-side state and causes a visible flash. This extends prior finding C7-12.
- **Failure scenario:** After successfully uploading and analyzing files, the user sees a blank page flash for 1-2 seconds during the redirect to the dashboard.
- **Fix:** Replace `window.location.href` with Astro's `navigate()`:
  ```typescript
  import { navigate } from 'astro:transitions';
  navigate(import.meta.env.BASE_URL + 'dashboard');
  ```

### C8-07: `build-stats.ts` stale fallback values will drift from actual data

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/build-stats.ts:16-18`
- **Description:** The fallback values `683`, `24`, `45` for totalCards, totalIssuers, and totalCategories are hardcoded. If cards.json is not found at build time, these stale values are used. Over time, as new cards are added to the YAML data, these fallbacks will become increasingly inaccurate. This extends prior finding C4-14/D-44.
- **Failure scenario:** After adding 50 new cards to the YAML data, a build failure causes the fallback values to be used. The homepage shows "683 cards" instead of the actual 733.
- **Fix:** Add a build script that generates these fallback values from the YAML data at build time, or validate that the fallback values are within a reasonable range of the actual data during CI.

### C8-08: `inferYear()` in pdf.ts and xlsx.ts uses `new Date()` which may return wrong year near midnight on Dec 31

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/lib/parser/pdf.ts:137-144` + `apps/web/src/lib/parser/xlsx.ts:183-190`
- **Description:** The `inferYear()` function creates a `candidate` date using `new Date(now.getFullYear(), month - 1, day)`. This creates a date in the LOCAL timezone. If the user's system clock is at 11:59 PM on December 31 and the statement contains a January date (month=1), the candidate date would be January of the current year. But at midnight, the current year ticks over to the next year, potentially changing the 3-month comparison. This is a very narrow edge case (literally 1 minute per year) but could cause incorrect year inference for statements processed at exactly that time.
- **Failure scenario:** At 11:59 PM on Dec 31, 2026, user uploads a statement with "1월 15일". `now.getFullYear()` returns 2026. Candidate is Jan 15, 2026, which is in the past, so `inferYear` returns 2026. One minute later, `now.getFullYear()` returns 2027. Candidate is Jan 15, 2027, which is ~2 weeks in the future (< 90 days), so `inferYear` returns 2027. The same statement produces different dates depending on exactly when it was uploaded.
- **Fix:** Use UTC dates instead of local dates in `inferYear()` to eliminate timezone-dependent behavior:
  ```typescript
  const now = new Date();
  const currentYear = now.getFullYear();
  const candidate = new Date(Date.UTC(currentYear, month - 1, day));
  const nowUTC = Date.UTC(currentYear, now.getMonth(), now.getDate());
  if (candidate.getTime() - nowUTC > 90 * 24 * 60 * 60 * 1000) {
    return currentYear - 1;
  }
  return currentYear;
  ```

### C8-09: `analyzer-adapter.test.ts` duplicates production code instead of testing it directly

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/__tests__/analyzer-adapter.test.ts:22-72`
- **Description:** The test file reproduces `getLatestMonth`, `VALID_SOURCES`, `VALID_REWARD_TYPES`, and the entire `toCoreCardRuleSets` adapter function locally (lines 22-72). The comment on line 9 explains this is because `analyzer.js` transitively imports `pdfjs-dist` which is incompatible with `bun:test`. This means the tests verify the COPIES, not the actual production code. If the production adapter changes, the test copy must be manually updated, which is error-prone.
- **Failure scenario:** A developer adds a new valid source type to `analyzer.ts` but forgets to update the test copy. The test passes but doesn't catch the regression.
- **Fix:** Extract the pure adapter logic (VALID_SOURCES, VALID_REWARD_TYPES, toCoreCardRuleSets) into a separate module that doesn't transitively import pdfjs-dist, then import and test that module directly.

### C8-10: `csv.ts` installment parsing doesn't validate NaN from `parseInt`

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/parser/csv.ts:257,334,399,465,531,596,661,727,792,858,923`
- **Description:** Every bank adapter in csv.ts parses installments with `const inst = parseInt(cells[installmentsCol] ?? '', 10)` and then checks `if (inst > 1)`. If `parseInt` returns `NaN`, the comparison `NaN > 1` evaluates to `false`, so NaN is never assigned to `tx.installments`. This is accidentally correct -- the NaN is implicitly filtered. However, relying on `NaN > 1 === false` is fragile and not self-documenting. A future developer might change the condition to `inst >= 1` or `inst !== 0`, which would pass NaN through.
- **Failure scenario:** A developer changes the installment check from `inst > 1` to `inst >= 1` (to include single-installment entries), and NaN starts leaking into transaction data.
- **Fix:** Add explicit NaN guard: `const inst = parseInt(cells[installmentsCol] ?? '', 10); if (!Number.isNaN(inst) && inst > 1) tx.installments = inst;`

### C8-11: `pdf.ts` fallback date regex could match non-date patterns like "12.34"

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/lib/parser/pdf.ts:342`
- **Description:** The `fallbackDatePattern` at line 342 includes the pattern `\d{1,2}[.\-\/]\d{1,2}(?![.\-\/\d])` which matches MM/DD format. However, this could also match numeric patterns that are not dates, such as "12.34" (a decimal number) or "3.5" (a version number). While the `parseDateToISO` function validates month/day ranges (1-12 and 1-31), the initial regex match may produce false positives that consume parts of lines that should be parsed differently.
- **Failure scenario:** A PDF line contains "할부 3.5% 이자" -- the "3.5" matches the date pattern, and `parseDateToISO` produces "2026-03-05" from what is actually an interest rate.
- **Fix:** Add a negative lookbehind for digits to avoid matching decimal numbers: `/(?<!\d)\d{1,2}[.\-\/]\d{1,2}(?![.\-\/\d])/`. This ensures the pattern doesn't match when preceded by a digit (i.e., the decimal part of a number).

### C8-12: `store.svelte.ts` `_persistWarningKind` and `_loadPersistWarningKind` are module-level mutable state

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/store.svelte.ts:106,157`
- **Description:** Both `_persistWarningKind` and `_loadPersistWarningKind` are module-level `let` variables that create implicit coupling between functions. `persistToStorage` sets `_persistWarningKind`, and `setResult`/`analyze`/`reoptimize` read it. `loadFromStorage` sets `_loadPersistWarningKind`, and `createAnalysisStore` reads and clears it. This pattern was flagged in C7-05 and remains unfixed. While the code works correctly today because the call ordering is deterministic, this is fragile under refactoring.
- **Failure scenario:** A developer moves `persistToStorage()` into a `setTimeout` for performance. The `_persistWarningKind` is now read before it's set, and the warning is lost.
- **Fix:** Have `persistToStorage` return the warning kind directly instead of using a shared mutable variable:
  ```typescript
  function persistToStorage(data: AnalysisResult): PersistWarningKind {
    try { ... return null; } catch { return 'corrupted'; }
  }
  ```
  Then in `setResult`: `persistWarningKind = persistToStorage(r);`

---

## Summary of New Findings

| ID | Severity | Confidence | Category | Description |
|----|----------|------------|----------|-------------|
| C8-01 | MEDIUM | High | dead code | AI categorizer disabled but 65+ lines of unreachable code in TransactionReview |
| C8-02 | MEDIUM | High | resource leak | CardDetail $effect fetch not abortable on unmount |
| C8-03 | LOW | High | logic | SpendingSummary month diff breaks on year boundaries (Dec->Jan) |
| C8-04 | LOW | Medium | info | SavingsComparison count-up animation -- no issue, cancellation handled correctly |
| C8-05 | LOW | High | a11y/UX | CategoryBreakdown CATEGORY_COLORS poor dark mode contrast (extends C4-09) |
| C8-06 | LOW | High | perf/UX | FileDropzone + CardDetail use full page reload navigation (extends C7-12) |
| C8-07 | LOW | High | stale data | build-stats.ts fallback values will drift (extends C4-14) |
| C8-08 | LOW | Medium | edge case | inferYear() timezone-dependent near midnight Dec 31 |
| C8-09 | LOW | High | test quality | analyzer-adapter.test.ts duplicates production code instead of testing it directly |
| C8-10 | LOW | High | robustness | csv.ts installment NaN implicitly filtered by `> 1` comparison |
| C8-11 | LOW | Medium | edge case | pdf.ts fallback date regex could match decimal numbers like "3.5" |
| C8-12 | LOW | High | code quality | _persistWarningKind module-level mutable variable (extends C7-05) |

---

## Prioritized Action Items

### HIGH (should fix this cycle)
1. C8-02: Make CardDetail $effect fetch abortable with AbortController
2. C8-01: Remove or clearly gate dead AI categorization code in TransactionReview

### MEDIUM (plan for next cycles)
3. C8-12: Refactor persistToStorage to return warning kind instead of using shared mutable variable
4. C8-03: Fix SpendingSummary month diff to handle year boundaries

### LOW (defer or accept)
- C8-05, C8-06, C8-07, C8-08, C8-09, C8-10, C8-11

---

## Deferred items carried forward

All deferred items from cycles 1-7 (D-01 through D-111, plus LOW findings) remain unchanged. No new deferred items this cycle beyond the LOW findings listed above.
