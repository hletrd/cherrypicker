# CherryPicker Deep Code Quality & Security Review

**Date:** 2026-04-18
**Scope:** Full repository — apps/web, packages/core, packages/parser, packages/rules, packages/viz, tools
**Reviewer:** Claude Opus (automated)
**Severity scale:** P0 (critical), P1 (high), P2 (medium), P3 (low)

---

## Executive Summary

The review found **28 issues** across the codebase: 2 P0, 8 P1, 12 P2, 6 P3. The most critical findings are type-safety bypasses via `as unknown as` casts that silence real type mismatches, and a localStorage key inconsistency causing broken dark-mode persistence tests. The web app's client-side parser duplicates significant logic from `packages/parser` without sharing code, creating a maintenance divergence risk. Multiple error paths silently swallow exceptions without logging or user feedback.

---

## P0 — Critical

### P0-01: Type-safety bypass with `as unknown as` silences real type mismatches

**File:** `apps/web/src/lib/analyzer.ts:38,103`

Two `as unknown as` casts bridge incompatible types between the web app's local types and `@cherrypicker/core`/`@cherrypicker/rules`:

```ts
// Line 38
const matcher = new MerchantMatcher(categoryNodes as unknown as RulesCategoryNode[]);

// Line 103
const optimizationResult = greedyOptimize(constraints, cardRules as unknown as CoreCardRuleSet[]);
```

**Why it's critical:** These casts bypass TypeScript's structural type checking entirely. If `CategoryNode` or `CardRuleSet` shapes diverge between the web app's local types and the core package's expected types, the optimizer will silently produce wrong results — wrong card recommendations, wrong reward calculations — with no compile-time or runtime error.

**Concrete failure scenario:** If `CardRuleSet.card.source` type changes from `string` to `'yaml' | 'api'` in the core package but the web app's local `CardRuleSet` still has `source: string`, the cast hides the mismatch. The optimizer may receive data it misinterprets.

**Fix:** Create proper adapter functions that validate/massage the types, or unify the type definitions so they're imported from the shared packages rather than re-declared locally.

---

### P0-02: localStorage key mismatch — theme persistence broken

**File:** `apps/web/public/scripts/layout.js:29` stores as `theme`
**File:** `apps/web/public/scripts/layout.js:4` reads as `theme`
**File:** `e2e/ui-ux-review.spec.js:143` reads as `cherrypicker:theme`

The layout.js uses key `'theme'` for localStorage, while the test suite and screenshot helpers use `'cherrypicker:theme'`. The application code is self-consistent (both read and write `'theme'`), but this is inconsistent with the project's namespacing convention (`cherrypicker:analysis`, `cherrypicker:dismissed-warning`).

**Why it's critical:** In production, the key `theme` could collide with other applications on the same origin. The test suite's use of `cherrypicker:theme` means the dark-mode persistence test is testing a different key than the app actually uses, so the test passes for the wrong reason.

**Concrete failure scenario:** If the app is hosted on a shared domain where another app also uses `localStorage.setItem('theme', ...)`, the theme setting gets corrupted.

**Fix:** Change layout.js to use `cherrypicker:theme` consistently, matching the project namespace convention. Update the read at line 4 to also use `cherrypicker:theme`.

---

## P1 — High

### P1-01: Duplicate parser implementations — web vs packages/parser divergence

**Files:**
- `apps/web/src/lib/parser/csv.ts` — 892 lines, 8 bank adapters + generic parser
- `packages/parser/src/csv/*.ts` — separate bank adapter files
- `apps/web/src/lib/parser/xlsx.ts` — 427 lines, browser XLSX parser
- `apps/web/src/lib/parser/pdf.ts` — 315 lines, browser PDF parser

The web app has an entirely separate parser implementation from `packages/parser`. Both parse CSV/XLSX/PDF with the same bank column mappings, but they're not shared code. The web version runs in the browser (no Bun APIs), while the packages version runs on Bun/Node.

**Why it matters:** When a bank changes its statement format, both parsers must be updated independently. They've already diverged — the web CSV parser has 8 bank adapters while the packages version splits them into individual files with potentially different logic.

**Fix:** Extract the bank column configs, date/amount parsing, and header detection logic into a shared `packages/parser/src/shared/` module that works in both browser and Node. Only the I/O layer (File API vs fs) should differ.

---

### P1-02: `parseAmount` in csv.ts returns 0 for unparseable values instead of null

**File:** `apps/web/src/lib/parser/csv.ts:63-72`

```ts
function parseAmount(raw: string): number {
  // ...
  const parsed = parseInt(cleaned, 10);
  if (Number.isNaN(parsed)) return 0;
  return isNegative ? -parsed : parsed;
}
```

Returns `0` for unparseable amounts. A transaction with an unparseable amount (e.g., `"N/A"`) gets amount `0`, which silently enters the optimization engine as a zero-spending transaction.

**Why it matters:** Zero-amount transactions distort the optimizer's results — they may trigger minimum-spending requirements for performance tiers, or produce zero-reward assignments that displace real transactions.

**Fix:** Return `null` for unparseable amounts (like `xlsx.ts:parseAmount` does), and skip the transaction or add it to the errors list.

---

### P1-03: CSV parser creates transactions even when amount fails to parse

**File:** `apps/web/src/lib/parser/csv.ts:181-205`

```ts
const amount = parseAmount(amountRaw);
if (isNaN(amount) && amountRaw) {   // parseAmount returns 0, never NaN
  errors.push({ ... });
}
// Transaction still created with amount=0!
const tx: RawTransaction = { ..., amount };
transactions.push(tx);
```

Since `parseAmount` returns `0` (never `NaN`), the `isNaN(amount)` check never triggers the error path. Transactions with unparseable amounts are always added with `amount: 0`.

**Fix:** Change `parseAmount` to return `number | null`, check for `null`, and skip the transaction when amount can't be parsed.

---

### P1-04: PDF fallback parser may match wrong date-amount pairs

**File:** `apps/web/src/lib/parser/pdf.ts:270-294`

The fallback PDF parser scans each line for the first date match and first amount match:

```ts
const dateMatch = line.match(fallbackDatePattern);
const amountMatch = line.match(fallbackAmountPattern);
```

If a line contains multiple amounts (e.g., "이용금액 50,000원 한도 100,000원"), it picks the first amount, which may not be the transaction amount. The regex `([\d,]+)원?` also matches partial numbers inside larger strings.

**Fix:** Use a more specific amount pattern that requires word boundaries or line position. Consider the last amount on the line (more commonly the actual transaction amount in Korean statements) rather than the first.

---

### P1-05: Session storage persistence loses `transactions` array — breaks reoptimization

**File:** `apps/web/src/lib/store.svelte.ts:87-90`

```ts
type PersistedAnalysisResult = Pick<
  AnalysisResult,
  'success' | 'bank' | 'format' | 'statementPeriod' | 'transactionCount' | 'optimization' | 'monthlyBreakdown'
>;
```

The `transactions` array (needed for category re-editing and reoptimization) is not persisted to sessionStorage. After a page reload, `analysisStore.transactions` returns `[]`, making the TransactionReview component non-functional.

**Why it matters:** Users who refresh the dashboard lose the ability to edit categories and reoptimize, even though the optimization results persist. The UI shows "0건" in the transaction review header.

**Fix:** Either persist transactions to sessionStorage (may hit quota limits with large files) or persist to IndexedDB, or show a clear message that category editing requires re-upload after refresh.

---

### P1-06: Race condition in `fetchGeneration` pattern in CardDetail.svelte

**File:** `apps/web/src/components/cards/CardDetail.svelte:57-72`

```ts
let fetchGeneration = 0;

$effect(() => {
  if (!cardId) { loading = false; return; }
  loading = true;
  error = null;
  const gen = ++fetchGeneration;
  getCardDetail(cardId)
    .then((result) => {
      if (gen === fetchGeneration) card = result;
    })
    .catch((e) => {
      if (gen === fetchGeneration) error = ...;
    })
    .finally(() => {
      if (gen === fetchGeneration) loading = false;
    });
});
```

The `$effect` runs on every `cardId` change, incrementing `fetchGeneration`. However, `$effect` in Svelte 5 also tracks `loading`, `error`, and `card` writes, potentially causing re-triggers. If `cardId` changes rapidly (e.g., fast navigation between cards), the stale check works, but the effect may run more times than expected due to reactive tracking of its own output state.

**Fix:** Use `$effect(() => { ... }, { track: () => cardId })` or extract the fetch into a separate untracked function to prevent reactive loops.

---

### P1-07: No input validation on `previousMonthSpending` — negative values accepted

**File:** `apps/web/src/components/upload/FileDropzone.svelte:177`

```ts
previousMonthSpending: previousSpending ? parseInt(previousSpending, 10) : undefined,
```

The number input accepts any integer, including negative values. A negative `previousMonthSpending` would be passed to the optimizer, which uses it to determine performance tiers. Negative spending could cause the optimizer to select the wrong tier or produce nonsensical results.

**Fix:** Add `min="0"` validation (already present on the input, but `parseInt` doesn't enforce it at the API level) and clamp or reject negative values in `optimizeFromTransactions`.

---

### P1-08: `detectBank` uses mutable `RegExp` state — lastIndex not reset

**File:** `apps/web/src/lib/parser/detect.ts:8-105`

The `BANK_SIGNATURES` array contains `RegExp` objects created with `new RegExp` or regex literals. If any pattern uses the `g` flag and is tested multiple times, `lastIndex` state would carry over between calls. Currently no patterns use the `g` flag, but if one is added later, it would break silently.

**Fix:** This is a latent risk. Document that patterns must not use the `g` flag, or add `pattern.lastIndex = 0` before each `.test()` call.

---

## P2 — Medium

### P2-01: Multiple `catch {}` blocks swallow errors silently

**Files:**
- `apps/web/src/lib/store.svelte.ts:106,129,140` — sessionStorage operations
- `apps/web/src/lib/parser/index.ts:34` — encoding detection
- `apps/web/src/lib/parser/csv.ts:872,883` — bank adapter fallbacks
- `apps/web/src/lib/parser/pdf.ts:212` — structured parse fallback
- `apps/web/src/layouts/Layout.astro:24` — card stats reading
- `apps/web/src/pages/index.astro:16` — card stats reading

Empty catch blocks make debugging impossible. When these fail in production, there's no way to tell why sessionStorage access failed, or why the card stats couldn't be read.

**Fix:** Add `console.warn` or `console.debug` in catch blocks for non-trivial operations. For the build-time file reads (Layout.astro, index.astro), the empty catch is acceptable since the fallback values are provided.

---

### P2-02: XLSX `parseDateToISO` short-year padding inconsistency

**File:** `apps/web/src/lib/parser/xlsx.ts:205-209`

```ts
const shortYearMatch = cleaned.match(/^(\d{2})[.\-\/](\d{2})[.\-\/](\d{2})$/);
if (shortYearMatch) {
  const year = parseInt(shortYearMatch[1]!, 10);
  const fullYear = year >= 50 ? 1900 + year : 2000 + year;
  return `${fullYear}-${shortYearMatch[2]}-${shortYearMatch[3]}`;
}
```

Month and day in the short-year branch aren't zero-padded (unlike the full-year branch). `"49.1.5"` would produce `"2049-1-5"` instead of `"2049-01-05"`.

**Fix:** Add `.padStart(2, '0')` for month and day groups in the short-year branch, matching the full-year branch.

---

### P2-03: Report page print styles force white background — breaks dark mode print

**File:** `apps/web/src/pages/report.astro:61-63`

```css
:global(body) {
  background: #fff !important;
  color: #000 !important;
}
```

The print style forces white background and black text, which is correct for printing but will flash the page white if the user is in dark mode and triggers print preview. More importantly, the `!important` overrides could interfere with browser print dialogs that preserve dark mode.

**Fix:** This is acceptable for actual printing (printers need white background). Consider using `@media print and (prefers-color-scheme: light)` or adding a note that print output is always light-themed.

---

### P2-04: `results.js` `formatWon` differs from `formatters.ts` implementation

**File:** `apps/web/public/scripts/results.js:8`
**File:** `apps/web/src/lib/formatters.ts:5-8`

```js
// results.js (plain JS, no import)
const formatWon = (amount) => amount.toLocaleString('ko-KR') + '원';

// formatters.ts (Svelte module)
export function formatWon(amount: number): string {
  if (!Number.isFinite(amount)) return '0원';
  return amount.toLocaleString('ko-KR') + '원';
}
```

The results.js version doesn't guard against `NaN` or `Infinity`, while the Svelte version does. If `opt.totalSpending` is `NaN` from corrupted sessionStorage data, `formatWon` produces `"NaN원"`.

**Fix:** Add a `Number.isFinite` guard in the plain JS `formatWon` functions in results.js and report.js.

---

### P2-05: `loadFromStorage` uses `as AnalysisResult` cast without full validation

**File:** `apps/web/src/lib/store.svelte.ts:115-126`

The validation only checks `parsed.optimization && Array.isArray(parsed.optimization.assignments)`, but the `AnalysisResult` type has many more required fields. Corrupted sessionStorage data could have valid `assignments` but missing `totalReward`, `effectiveRate`, etc.

**Fix:** Add deeper validation of the optimization result shape, or use a Zod schema for runtime validation of persisted data.

---

### P2-06: `CardPage.svelte` uses `$effect` that tracks own output state

**File:** `apps/web/src/components/cards/CardPage.svelte:13-19`

```ts
$effect(() => {
  if (selectedCardId) {
    getCardById(selectedCardId).then(c => { cardName = c?.nameKo ?? selectedCardId ?? ''; });
  } else {
    cardName = '';
  }
});
```

Writing to `cardName` inside the effect creates a dependency loop potential. If `cardName` were read anywhere in the effect's body (it's used in the template but not in the effect), it could trigger infinite re-runs. Currently safe, but fragile.

**Fix:** Use `$effect(() => { ... })` with explicit dependency on `selectedCardId` only, or restructure to avoid writing reactive state from within effects.

---

### P2-07: CSV `splitLine` doesn't handle escaped quotes inside quoted fields

**File:** `apps/web/src/lib/parser/csv.ts:8-20`

```ts
function splitLine(line: string, delimiter: string): string[] {
  // ...
  for (const char of line) {
    if (char === '"') { inQuotes = !inQuotes; }
    // ...
  }
}
```

Standard CSV escaping uses `""` (double quote) to represent a literal quote inside a quoted field. This parser treats `""` as "enter quote, exit quote" (i.e., an empty field boundary) rather than a single escaped quote character.

**Concrete failure:** A merchant name like `"GS25 ""편의점"" 점포"` would be mis-parsed.

**Fix:** Track the previous character and treat `""` as an escaped quote literal rather than a field boundary toggle.

---

### P2-08: `analyzeMultipleFiles` doesn't deduplicate transactions across files

**File:** `apps/web/src/lib/analyzer.ts:113-128`

When users upload multiple files for the same month, transactions are concatenated without deduplication. If a user uploads the same file twice (or overlapping date ranges), transactions are double-counted in the optimization.

**Fix:** Deduplicate by `(date, merchant, amount)` tuple after merging, or warn the user about overlapping date ranges.

---

### P2-09: `OptimalCardMap.svelte` — `rateBarWidth` can exceed 100%

**File:** `apps/web/src/components/dashboard/OptimalCardMap.svelte:94`

```ts
{@const rateBarWidth = Math.round((a.rate / maxRate) * 100)}
```

If `maxRate` is 0.001 (the minimum floor) and a category has rate 0, the bar width would be `0/0.001 * 100 = 0%` which is fine. But if a single category has a rate far above `maxRate` due to floating point, the bar could exceed 100%. The `maxRate` calculation uses `Math.max(...assignments.map(a => a.rate), 0.001)`, which correctly includes all rates, so this shouldn't happen in practice. Low risk.

---

### P2-10: HTML report generator uses string concatenation for HTML — XSS risk

**File:** `packages/viz/src/report/generator.ts`

The `buildSummary`, `buildCategoryTable`, `buildCardComparison`, and `buildAssignments` functions build HTML via template literals with `${esc(value)}` interpolation. The `esc()` function is correctly applied to all dynamic values. However, the `buildSummary` function uses `formatWon` and `formatRate` outputs directly without `esc()`:

```ts
<div class="value">${formatWon(result.totalSpending)}</div>
```

Since `formatWon` and `formatRate` only produce numeric strings with Korean formatting, they can't contain HTML, so this is safe. But if the format functions ever change to include user-adjacent data, it would be a vulnerability.

**Fix:** Apply `esc()` to all interpolated values for defense-in-depth, or use a proper HTML template engine.

---

### P2-11: `detectBank` can return wrong bank with equal scores

**File:** `apps/web/src/lib/parser/detect.ts:114-136`

When multiple banks match with the same score, the first match wins (iteration order). If a statement mentions both "현대카드" and "삼성카드" (e.g., a comparison document), `hyundai` always wins because it's listed first in `BANK_SIGNATURES`.

**Fix:** When multiple banks tie, report lower confidence or try all matching banks and pick the one with more column matches.

---

### P2-12: `FileDropzone.svelte` page-level drag handlers not cleaned up on unmount

**File:** `apps/web/src/components/upload/FileDropzone.svelte:11-43`

The `onMount` callback adds document-level `dragenter`, `dragleave`, `dragover`, and `drop` event listeners. The cleanup function is returned from `onMount`, which Svelte calls on unmount. However, if the component is destroyed while a drag is in progress, the `dragCount` variable is captured by closure and won't be properly reset.

**Fix:** This is a minor issue. Consider resetting `isDragOver = false` in the cleanup function.

---

## P3 — Low

### P3-01: Inconsistent footer nav link order vs header nav

**File:** `apps/web/src/layouts/Layout.astro:170-175`

Footer links: 홈, 카드 목록, 대시보드, 추천 결과, 리포트
Header nav: 홈, 대시보드, 카드 목록, 추천 결과

The order differs (카드 목록 and 대시보드 are swapped). Not a bug, but inconsistent UX.

---

### P3-02: `SpendingSummary.svelte` warning banner doesn't have dark mode variants

**File:** `apps/web/src/components/dashboard/SpendingSummary.svelte:104-107`

```html
<div class="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 border border-amber-200">
```

Missing `dark:` variants on the session warning banner. In dark mode, this renders with a bright amber background that looks out of place.

**Fix:** Add `dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800`.

---

### P3-03: `CardGrid.svelte` loading skeleton uses `bg-gray-200`/`bg-gray-300` without dark variants

**File:** `apps/web/src/components/cards/CardGrid.svelte:138-149`

The loading skeleton uses hardcoded `bg-gray-200` and `bg-gray-300` without `dark:` variants. These look jarring in dark mode.

**Fix:** Add `dark:bg-gray-700` / `dark:bg-gray-600` variants.

---

### P3-04: `TransactionReview.svelte` CATEGORIES list is hardcoded instead of loaded from categories.json

**File:** `apps/web/src/components/dashboard/TransactionReview.svelte:10-50`

The `CATEGORIES` array with 40 entries is hardcoded in the component. The actual category taxonomy lives in `packages/rules/data/categories.yaml` and is served as `categories.json`. If categories are added or renamed, this list won't update.

**Fix:** Load categories from the JSON data at runtime, or generate this list at build time.

---

### P3-05: `report.js` and `results.js` define local `formatWon` — acceptable duplication

**Files:**
- `apps/web/public/scripts/report.js:8` — `const formatWon = (amount) => amount.toLocaleString('ko-KR') + '원';`
- `apps/web/public/scripts/results.js:8` — same

These are plain JS scripts (not Svelte modules) that can't import from the Svelte lib. The duplication is acceptable given the runtime constraint.

---

### P3-06: `dashboard.js` and `results.js` duplicate the empty-state toggle pattern

**Files:**
- `apps/web/public/scripts/dashboard.js` — 16 lines
- `apps/web/public/scripts/results.js` — 33 lines (also populates stat cards)

Both check `cherrypicker:analysis` in sessionStorage and toggle empty/data visibility. The pattern is similar but not identical (results.js also populates stats). Acceptable as-is since they serve different pages with different logic.

---

## Cross-Cutting Concerns

### CCC-01: No Content Security Policy for `connect-src` in production

The CSP meta tag specifies `connect-src 'self'`, but the AI categorizer (currently disabled) would need to connect to external APIs when re-enabled. The `categorizer-ai.ts` currently throws, but if re-enabled without CSP updates, it will be blocked.

### CCC-02: No rate limiting or file size limits on client-side parsing

Users can upload arbitrarily large files. The XLSX parser loads the entire workbook into memory, and the PDF parser processes all pages. A multi-hundred-MB file could crash the browser tab.

**Fix:** Add a file size check (e.g., max 50MB) before parsing, and consider streaming or chunked processing for large files.

### CCC-03: No CSRF protection on client-side analysis

Since all processing happens client-side and no data is sent to a server, CSRF is not applicable. This is a security strength of the architecture.

### CCC-04: Type duplication between web app and core package

The web app re-declares types that exist in `@cherrypicker/core`:
- `CardRuleSet` in `apps/web/src/lib/cards.ts` vs `packages/core/src/models/card.ts`
- `CategorizedTx` in `apps/web/src/lib/analyzer.ts` vs `CategorizedTransaction` in `packages/core/src/models/transaction.ts`

This causes the `as unknown as` casts in P0-01 and will continue to cause type drift.

---

## Test Adequacy

### TA-01: No unit tests for web app parser

The browser-side parser (`apps/web/src/lib/parser/`) has no unit tests. All 8 bank adapters, the generic CSV parser, the XLSX parser, and the PDF parser are untested. The `packages/parser` has tests, but the web implementation is a separate codebase.

### TA-02: No tests for the optimizer from the web app's perspective

There are no tests that exercise `analyzeMultipleFiles` or `optimizeFromTransactions` from the web app's entry point. The core package has optimizer tests, but the web app's adapter layer (with the `as unknown as` casts) is untested.

### TA-03: E2E tests have 15 pre-existing failures

The Playwright test suite at `e2e/ui-ux-review.spec.js` has 43/58 tests passing. The 15 failures appear to be test expectation mismatches (wrong text selectors, localStorage key differences) rather than actual app bugs, but they reduce confidence in the test suite.

---

## Final Sweep — Commonly Missed Issues

1. **Prototype pollution**: JSON.parse on untrusted data in `loadFromStorage()` could theoretically inject prototype properties, but since the result is typed and only specific fields are accessed, this is not exploitable.

2. **ReDoS**: The CSV/XLSX parsers use many regex patterns for date and amount matching. Most are anchored and don't have catastrophic backtracking. The `normalizeHTML` regex `/<\/(td|th|tr|table|thead|tbody)\s+>/gi` is safe.

3. **Memory leaks**: The `SpendingSummary.svelte` count-up animation uses `requestAnimationFrame` with proper cleanup in the `$effect` return function. The `FileDropzone.svelte` `navigateTimeout` is cleaned up in `onDestroy`. No leaks found.

4. **Integer overflow**: Korean Won amounts are stored as JavaScript numbers. For very large values (>2^53), precision could be lost. Real-world credit card statements won't approach this limit (max ~billions of won per transaction).

5. **Timezone issues**: Date parsing uses string manipulation rather than `Date` objects, which avoids timezone offset bugs. The ISO date format (YYYY-MM-DD) is consistent throughout.

6. **Dependency security**: The app uses `xlsx` (SheetJS) and `pdfjs-dist` for client-side parsing. Both are well-maintained. No known critical vulnerabilities.

---

## Addendum: packages/core Deep Review Findings

*The following findings were produced by a parallel deep review of packages/core/src/ (22 source files, 3 test files).*

### P0-03: O(n*m) substring match causes quadratic runtime on every categorization call

**File:** `packages/core/src/categorizer/matcher.ts:46-56`
**Category:** Performance
**Confidence:** High

The `match()` method iterates over every entry in `ALL_KEYWORDS` (thousands of entries from MERCHANT_KEYWORDS, LOCATION_KEYWORDS, ENGLISH_KEYWORDS, and NICHE_KEYWORDS combined) performing bidirectional `includes()` checks for every single transaction. With approximately 3,000+ keyword entries, each `match()` call does 3,000 string scans. Processing a statement with 200 transactions means 600,000 string scans. The same quadratic pattern exists in `taxonomy.ts:69-89`.

**Concrete failure:** A user loading a year's worth of statements (2,000+ transactions) would experience multi-second delays in the categorization step.

**Fix:** Pre-build a trie or Aho-Corasick automaton from the keyword keys at construction time. Alternatively, limit the substring scan to keywords with length >= 3 and cache results by merchant name.

---

### P0-04: `normalizeRate` divides by 100 for discount/cashback but NOT for points — rate interpretation is inconsistent

**File:** `packages/core/src/calculator/reward.ts:99-105`
**Category:** Logic Bug
**Confidence:** High

```ts
function normalizeRate(ruleType: string, rate: number | null): number | null {
  if (rate === null) return null;
  if (ruleType === 'discount' || ruleType === 'cashback') {
    return rate / 100;
  }
  return rate;
}
```

When `ruleType` is `'points'` or `'mileage'`, the rate is returned as-is without dividing by 100. If YAML data uses percentage form (1-100) for points rates like it does for discount/cashback, this produces 100x overstated rewards. Whether this is a bug depends on YAML data format — needs verification.

**Concrete failure:** A card with `type: points, rate: 5` (intended 5%) would award 100% of spending as points rather than 5%, drastically overstating rewards.

**Fix:** Verify the YAML data format for points/mileage rates. If they use the same percentage convention as discount/cashback, add `'points'` and `'mileage'` to the normalization branch.

---

### P1-09: Global cap tracking `globalMonthUsed` is not synchronized with rule-level `ruleMonthUsed`

**File:** `packages/core/src/calculator/reward.ts:232-245`
**Category:** Logic Bug
**Confidence:** Medium-High

When the global cap truncates a reward, `globalMonthUsed` is updated with the actual applied amount, but `ruleMonthUsed` still reflects the pre-global-cap amount. Subsequent transactions for the same rule see inflated `currentRuleMonthUsed`, causing them to receive less reward than they should at the rule level.

**Concrete failure:** Card has rule-level monthly cap of 10,000 Won and global cap of 5,000 Won. First transaction earns 8,000 at rule level. Global cap reduces it to 5,000. Second transaction would earn 2,000 at rule level (ruleMonthUsed would be 8,000+2,000=10,000). But only 5,000 was the real applied reward and the global cap should be the binding constraint — the second transaction should get more reward at the rule level since only 5,000 of the rule cap was truly consumed.

**Fix:** When the global cap truncates the reward, update `ruleMonthUsed` to reflect the actual applied amount, not the pre-global-cap amount.

---

### P1-10: Broad category rules incorrectly match subcategory transactions

**File:** `packages/core/src/calculator/reward.ts:64-68`
**Category:** Logic Bug
**Confidence:** High

When a transaction has `category: 'dining', subcategory: 'cafe'`, and there is a rule with `category: 'dining'` but no subcategory, the rule passes the filter and matches. In Korean credit card rules, a broad "dining 10%" typically does NOT cover cafes (which have their own separate rate). The current code would incorrectly apply the dining rate to cafe spending if no cafe-specific rule exists.

**Concrete failure:** Card has `dining: 10%` but no cafe rule. A cafe transaction gets 10% discount when Korean card terms typically exclude cafes from the dining category.

**Fix:** Consider adding `if (tx.subcategory && !rule.subcategory && rule.category !== '*') return false;` to the filter, or at minimum document the matching semantics clearly.

---

### P1-11: `scoreCardsForTransaction` in greedy optimizer is O(n^2 * m)

**File:** `packages/core/src/optimizer/greedy.ts:84-109`
**Category:** Performance
**Confidence:** High

For each transaction, `scoreCardsForTransaction` iterates over all card rules and calls `calculateCardOutput` twice per card (before and after). Each call re-processes ALL previously assigned transactions for that card. With n transactions and m cards, total work is O(n^2 * m).

**Concrete failure:** Users importing large statement sets (500+ transactions) experience significant UI lag.

**Fix:** Maintain incremental reward state per card instead of recalculating from scratch.

---

### P2-13: Three identical `RewardCalcResult` interfaces in discount.ts, points.ts, cashback.ts

**File:** `packages/core/src/calculator/discount.ts:1-5`, `points.ts:1-5`, `cashback.ts:1-5`
**Category:** Duplication (DRY)
**Confidence:** High

The interface and calculation functions are copy-paste with different JSDoc comments. Any bug fix must be applied three times.

**Fix:** Define `RewardCalcResult` once in `types.ts` and create a single shared calculation function.

---

### P2-14: `CategoryTaxonomy.findCategory()` fuzzy reverse match returns first match, not best

**File:** `packages/core/src/categorizer/taxonomy.ts:84-89`
**Category:** Logic Bug
**Confidence:** Medium

Unlike the substring match (step 2) which finds the longest keyword match, the fuzzy reverse match returns the first keyword that contains the merchant name. Result depends on YAML loading order.

**Fix:** Apply the same "longest keyword" selection strategy as step 2.

---

### P2-15: `MerchantMatcher.match()` splits category on first `.` only — multi-level dots would lose data

**File:** `packages/core/src/categorizer/matcher.ts:38-41`
**Category:** Edge Case
**Confidence:** Medium

If a category ID ever has more than one dot (e.g., `dining.cafe.premium`), the destructuring `[category, subcategory]` would only capture the first two elements and silently drop the rest.

**Fix:** Use `split('.', 2)` explicitly and document the at-most-one-dot constraint.

---

### P2-16: Negative transaction amounts are silently included in reward calculations

**File:** `packages/core/src/calculator/reward.ts:172`
**Category:** Edge Case
**Confidence:** Medium

If a refund (negative amount) is present, `Math.floor(amount * rate)` would produce a negative reward. The `greedyOptimize` function filters for `amount > 0`, but direct calls to `calculateRewards` are unprotected.

**Fix:** Filter out negative-amount transactions at the `calculateRewards` entry point.

---

### P3-07: ILP optimizer is an unimplemented stub that silently returns greedy results

**File:** `packages/core/src/optimizer/ilp.ts:43-49`
**Category:** Code Quality
**Confidence:** High

`ilpOptimize` simply delegates to `greedyOptimize` with no warning. Users requesting `method: 'ilp'` get greedy results without knowing.

**Fix:** Add a `console.warn` or structured warning indicating the ILP fallback was used.

---

### P3-08: `Transaction.currency` has no validation — non-KRW would produce incorrect rewards

**File:** `packages/core/src/models/transaction.ts:6`
**Category:** Edge Case
**Confidence:** Medium

No code checks the `currency` field. A 100 USD transaction would be treated as 100 Won.

**Fix:** Enforce `currency === 'KRW'` at the calculation entry point or document the limitation.

---

### Core Package Test Gaps

- **No tests for zero-amount or negative-amount transactions** in `calculateRewards`
- **No tests for global cap interaction with rule-level cap** — the exact scenario where the desynchronization bug (P1-09) would manifest
- **No tests for English/uppercase merchant names** — the ENGLISH_KEYWORDS map has 1,800+ entries but none are tested

---

## Addendum: packages/parser Deep Review Findings

*The following findings were produced by a parallel deep review of packages/parser/ (20 source files, 3 test files).*

### P0-05: CSV dispatcher silently swallows adapter parse failures

**File:** `packages/parser/src/csv/index.ts:44-47,55-58`

When a bank-specific adapter throws (unexpected column layout, malformed data, encoding corruption), the error is caught and completely discarded — no logging, no error reporting, no addition to `ParseResult.errors`. The user gets a silent fallback to the generic parser with zero indication that their bank-specific adapter failed.

**Fix:** Accumulate errors and attach them to the result:
```typescript
} catch (err) {
  errors.push({ message: `${adapter.bankId} adapter failed: ${err instanceof Error ? err.message : String(err)}` });
  // Fall through to generic parser
}
```

---

### P0-06: PDF `parseAmount` silently converts unparseable amounts to 0

**File:** `packages/parser/src/pdf/index.ts:21`

```typescript
return parseInt(raw.replace(/원$/, '').replace(/,/g, ''), 10) || 0;
```

`|| 0` converts both `NaN` (parse failure) and legitimate `0` to `0`. A transaction with garbled amount text (e.g., merchant name leaked into amount column) becomes a 0-won transaction, corrupting downstream financial calculations.

**Fix:** Return `null` on failure, matching xlsx/index.ts pattern.

---

### P1-12: `parseDateToISO` across 9 bank CSV adapters rejects single-digit month/day

**Files:** All 9 bank-specific CSV adapters (`bc.ts`, `hana.ts`, `hyundai.ts`, `ibk.ts`, `lotte.ts`, `nh.ts`, `samsung.ts`, `shinhan.ts`, `woori.ts`)

All use `\d{2}` for month/day matching, rejecting dates like `2026.2.1`. Meanwhile `generic.ts` and `xlsx/index.ts` correctly use `\d{1,2}` with `padStart(2, '0')`.

**Fix:** Unify all `parseDateToISO` implementations to use `\d{1,2}` with `padStart(2, '0')`.

---

### P1-13: Installments field inconsistency — `generic.ts` uses `inst > 0` vs bank adapters' `inst > 1`

**File:** `packages/parser/src/csv/generic.ts:201`

`generic.ts` uses `inst > 0` which sets `installments: 1` for lump-sum payments, while bank-specific adapters correctly use `inst > 1` which omits the field.

**Fix:** Change `generic.ts` from `inst > 0` to `inst > 1`.

---

### P1-14: LLM fallback `JSON.parse` without try-catch — crash on malformed LLM output

**File:** `packages/parser/src/pdf/llm-fallback.ts:67`

If the LLM returns syntactically invalid JSON, `JSON.parse` throws. The greedy `\[[\s\S]*\]` regex could also match from one array through to another, capturing non-JSON text.

**Fix:** Wrap `JSON.parse` in try-catch with a meaningful Korean error message. Use a non-greedy match or extract only the first JSON array.

---

### P1-15: No file size limits — OOM risk with large statement files

**Files:** `packages/parser/src/index.ts:34`, `xlsx/index.ts:99`, `pdf/extractor.ts:5`, `detect.ts:166`

`readFile` loads entire file with no size limit. `detect.ts` reads the entire file just to check the first 8 bytes for magic number detection.

**Fix:** Add configurable max file size (e.g., 50MB). For `detect.ts`, read only the first 8 bytes.

---

### P1-16: XLSX zip bomb potential — no decompression size limit

**File:** `packages/parser/src/xlsx/index.ts:99-111`

XLSX files are ZIP archives. A small XLSX can decompress to hundreds of MB (zip bomb). No check on decompressed size.

**Fix:** Reject files above a reasonable size threshold before processing.

---

### P2-17: Massive code duplication — `parseDateToISO`, `parseAmount`, `splitLine` copied 10+ times

**Files:** All 9 bank-specific CSV adapters + `generic.ts`

Root cause of the parseDateToISO and installments inconsistencies. Any bug fix must be applied to all 10 copies.

**Fix:** Extract shared utilities into `csv/utils.ts` and import from each adapter.

---

### P2-18: `EXPECTED_HEADERS` declared but unused in 6 adapter files

**Files:** `bc.ts:36`, `hana.ts:36`, `lotte.ts:36`, `nh.ts:36`, `samsung.ts:36`, `shinhan.ts:36`

`EXPECTED_HEADERS` is declared but never referenced. Meanwhile `hyundai.ts`, `ibk.ts`, and `woori.ts` DO use it. Inconsistency across adapters.

**Fix:** Either use `EXPECTED_HEADERS` consistently in all adapters, or remove the unused declarations.

---

### P2-19: Double file reads — file loaded multiple times per parse operation

**Files:** `detect.ts:166,189`, `index.ts:29,34`, `pdf/extractor.ts:5,11`

A single `parseStatement()` call results in the file being read 2-3 times. `detectFormat` reads entire file to check 8 bytes of header.

**Fix:** Refactor `detectFormat` to return both format and content in a single pass.

---

### P2-20: EUC-KR encoding detection threshold is arbitrary and fragile

**File:** `packages/parser/src/index.ts:41`

Threshold of 5 replacement characters is absolute, not ratio-based. Small files with few Korean characters won't trigger fallback; large UTF-8 files with legitimate replacement chars would incorrectly trigger EUC-KR decoding.

**Fix:** Use ratio-based threshold (replacement characters per KB) rather than absolute count.

---

### P2-21: LLM fallback hardcoded model name and no API call timeout

**File:** `packages/parser/src/pdf/llm-fallback.ts:45`

Model `claude-opus-4-5` is hardcoded. No timeout on API call — hung network blocks indefinitely.

**Fix:** Make model configurable via env var. Add `AbortController` timeout (30s).

---

### P2-22: PDF `tryStructuredParse` silently swallows all errors

**File:** `packages/parser/src/pdf/index.ts:88`

Any bug in `tryStructuredParse` is silently caught, returning `null` and triggering the LLM fallback path. This hides real bugs and wastes LLM API credits.

**Fix:** Catch only expected exceptions; let programming errors propagate.

---

### P2-23: PDF `DATE_PATTERN` not anchored — matches dates embedded in other text

**File:** `packages/parser/src/pdf/table-parser.ts:2`

`/\d{4}[.\-\/]\d{2}[.\-\/]\d{2}/` matches dates in strings like `거래번호2026.01.15-001`. All CSV adapters use anchored patterns.

**Fix:** Add anchoring: `/^\d{4}[.\-\/]\d{2}[.\-\/]\d{2}$/`.

---

### P2-24: PDF table parser `Math.max(...lines.map())` — spread on potentially large array

**File:** `packages/parser/src/pdf/table-parser.ts:18`

If PDF text extraction produces very long lines, the spread operator could hit call stack limits. Edge case: if all lines are whitespace-only after filtering, `Math.max()` with no args returns `-Infinity`.

**Fix:** Add fallback: `lengths.length > 0 ? Math.max(...lengths) : 0`.

---

### P3-09: Inconsistent header detection approaches across CSV adapters

Some adapters use `cells.some(c => EXPECTED_HEADERS.includes(c))` (matches ANY header keyword) while others use `cells.includes('X') && cells.includes('Y')` (requires MULTIPLE specific headers).

**Fix:** Standardize on a minimum-count approach: require at least 2 expected headers.

---

### P3-10: No path traversal protection in `parseStatement`

**File:** `packages/parser/src/index.ts:28`

Accepts any `filePath` string and passes directly to `readFile`. Low risk since it's CLI/library-only.

---

### P3-11: Bank-specific CSV `parseAmount` returns 0 on failure — no error surfacing

**Files:** All 9 bank-specific CSV adapters

Unlike `generic.ts` and `xlsx/index.ts` which return `null` and surface errors, bank-specific adapters silently return 0.

**Fix:** Return `null` on failure and add error reporting, matching `generic.ts` pattern.

---

### Parser Package Test Gaps

- **No tests for 7 of 9 bank adapters** (only KB and Samsung have tests)
- **No tests for PDF parsing** (extractor, table-parser, structured parse)
- **No tests for LLM fallback** with mocked Anthropic client
- **No edge case tests** for EUC-KR encoding, empty files, malformed input, special characters

---

## Updated Summary

| Severity | Count | Key Issues |
|----------|-------|------------|
| P0 | 6 | Type-safety bypass casts, localStorage key mismatch, quadratic categorizer, normalizeRate inconsistency, CSV dispatcher silent errors, PDF amount returning 0 |
| P1 | 16 | Parser divergence, parseAmount returning 0, lost transactions, PDF fallback, sessionStorage gap, race condition, negative spending, global cap desync, broad rule matching, greedy O(n^2), parseDateToISO inconsistency, installments inconsistency, LLM fallback JSON crash, no file size limits, XLSX zip bomb |
| P2 | 24 | Silent catch blocks, date padding, formatWon guard, storage validation, CSV escaped quotes, duplicate transactions, rate bar, HTML generator, bank detection ties, drag cleanup, duplicate interfaces, fuzzy match order, category split, negative amounts, parser code duplication, unused EXPECTED_HEADERS, double file reads, EUC-KR threshold, LLM hardcoded model, PDF error swallowing, unanchored date pattern, Math.max spread |
| P3 | 11 | Footer link order, dark mode gaps, skeleton dark mode, hardcoded categories, formatWon duplication, empty-state duplication, ILP stub, currency validation, inconsistent header detection, path traversal, bank adapter parseAmount returning 0 |
