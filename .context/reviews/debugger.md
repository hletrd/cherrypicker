# Debugger Review: Cherrypicker Monorepo Latent Bug Analysis

**Date**: 2026-04-22
**Scope**: All source files in packages/core, packages/parser, packages/rules, packages/viz, apps/web, tools/cli, tools/scraper
**Focus**: Null/undefined dereferences, unhandled promise rejections, boundary conditions, silent failures, regression risks

---

## Findings

### D-01: Greedy optimizer globalMonthUsed can diverge from ruleMonthUsed after rollback

**File**: `packages/core/src/calculator/reward.ts:316-319`
**Confidence**: High

**What triggers it**: When a reward is clipped by the global cap (`globalConstraints.monthlyTotalDiscountCap`), the code rolls back `ruleMonthUsed` by the overcount amount but increments `globalMonthUsed` by only the `appliedReward`. On the *next* transaction for the same rule, `ruleMonthUsed` will be *lower* than it should be relative to what the global cap actually consumed. This means a subsequent transaction may compute `rewardAfterMonthlyCap` as if more rule-level cap remains than actually exists relative to the global constraint.

```ts
// Line 316-319: rollback of ruleMonthUsed
const overcount = rewardAfterMonthlyCap - appliedReward;
ruleMonthUsed.set(rewardKey, ruleResult.newMonthUsed - overcount);
// ...
globalMonthUsed += appliedReward;
```

**Failure mode**: A transaction that would be correctly clipped by the rule-level cap alone can produce a slightly higher reward than it should, because the rollback made the rule tracker think more cap headroom exists. The global cap still enforces a hard ceiling, so the absolute reward total cannot exceed the global cap -- but individual transaction-level rewards may be misattributed between the rule cap and global cap. This is a *distribution accuracy* issue, not a total-reward-overflow issue.

**Suggested fix**: Track `globalMonthUsed` alongside `ruleMonthUsed` consistently. Instead of rolling back `ruleMonthUsed`, compute the effective reward in a single pass that respects both caps simultaneously:

```ts
const ruleRemaining = monthlyCap !== null ? Math.max(0, monthlyCap - currentRuleMonthUsed) : Infinity;
const globalRemaining = globalCap !== null ? Math.max(0, globalCap - globalMonthUsed) : Infinity;
const effectiveCap = Math.min(ruleRemaining, globalRemaining);
const appliedReward = Math.min(rawReward, effectiveCap);
const newRuleUsed = currentRuleMonthUsed + appliedReward;
ruleMonthUsed.set(rewardKey, newRuleUsed);
globalMonthUsed += appliedReward;
```

---

### D-02: Server-side CSV bank adapters skip total-row filter -- hyundai, kb, ibk, woori, nh

**File**: `packages/parser/src/csv/hyundai.ts:44`, `kb.ts:44`, `ibk.ts:44`, `woori.ts:44`, `nh.ts:44`
**Confidence**: High

**What triggers it**: These five server-side bank adapters use `/합계|총계|소계|total|sum/i` to filter summary rows. However, the *web-side* equivalents in `apps/web/src/lib/parser/csv.ts` do NOT filter these rows at all (the web adapters lack the regex filter). This means a statement with a `합계` (total) row that has a date and amount will be parsed as a regular transaction on the web, inflating the transaction count and spending total.

**Failure mode**: A user uploading the same CSV file via the web app will see inflated spending compared to the CLI. The `합계` row typically has a date (e.g., the statement date) and a total amount, so it passes both the date and amount checks.

**Suggested fix**: Add the same summary-row filter to all web-side bank adapters in `apps/web/src/lib/parser/csv.ts`, or add it to the shared `parseCSV` entry point after the adapter returns.

---

### D-03: `buildCategoryLabelMap` skips bare subcategory IDs, causing missing labels in TransactionReview

**File**: `apps/web/src/lib/category-labels.ts:17-24`
**Confidence**: Medium

**What triggers it**: The `buildCategoryLabelMap` function intentionally does NOT set bare subcategory IDs (e.g., `labels.set("cafe", "카페")`), only dot-notation keys (`labels.set("dining.cafe", "카페")`). The comment explains this is to avoid shadowing top-level categories. However, the `TransactionReview` component (which allows users to change categories) builds its own map from category nodes. If that component or any other code path looks up a bare subcategory ID like `categoryLabels.get("cafe")`, it will get `undefined` and fall back to the raw English key.

**Failure mode**: Category labels in the UI may display raw English keys like "cafe" instead of "카페" for subcategory-only lookups. The optimizer uses `buildCategoryKey()` which produces dot-notation, so the optimization output is unaffected. But UI components that display bare subcategory IDs will show English keys.

**Suggested fix**: Either (a) add bare subcategory entries after top-level entries (so top-level IDs take precedence on collision), or (b) document the contract that all lookups must use dot-notation keys, and audit all call sites.

---

### D-04: `detectFormatFromFile` treats `.xls` extension as XLSX

**File**: `apps/web/src/lib/parser/detect.ts:108-109`
**Confidence**: Low

**What triggers it**: The function maps both `.xlsx` and `.xls` extensions to the `'xlsx'` format. While the SheetJS library can handle both binary formats, the server-side `packages/parser/src/detect.ts:174` does the same. The issue is that `.xls` files could be either binary XLS (OLE2) or HTML-as-XLS. If a `.xls` file is neither (e.g., a corrupted file), the XLSX parser will throw an unhelpful error rather than a format-detection error.

**Failure mode**: A corrupted or misnamed `.xls` file produces a cryptic SheetJS parse error instead of a clear "unsupported format" message.

**Suggested fix**: Low priority -- current behavior works for the common case. If user reports of confusing errors surface, add a format-sniffing step for `.xls` files.

---

### D-05: `parseDateStringToISO` returns raw input on failure, producing non-date strings downstream

**File**: `packages/parser/src/date-utils.ts:123`, `apps/web/src/lib/parser/date-utils.ts:142`
**Confidence**: Medium

**What triggers it**: When no date format matches, the function returns the raw input string as-is. Downstream code that uses `tx.date.startsWith(latestMonth)` (where `latestMonth` is `"YYYY-MM"`) will silently skip transactions with malformed dates because the raw string won't match the prefix. The web-side version now logs a warning, but the server-side version (`packages/parser/src/date-utils.ts`) does not.

**Failure mode**: Transactions with unparseable dates are silently excluded from the optimization (they still appear in the transaction list but are not counted in the latest-month optimization). The user sees a lower transaction count than expected with no explanation.

**Suggested fix**: The server-side `parseDateStringToISO` should also log a warning for unparseable dates (matching the web-side behavior). Additionally, consider returning a sentinel value like `"UNKNOWN"` instead of the raw input, so downstream code can explicitly detect and report these cases.

---

### D-06: Server-side CSV bank adapters scan only first 10 lines for header, web-side scans 30

**File**: `packages/parser/src/csv/kb.ts:23` (and hyundai, shinhan, samsung, lotte, hana, woori, nh, ibk, bc)
**Confidence**: High

**What triggers it**: All 10 server-side bank adapters in `packages/parser/src/csv/` scan `Math.min(10, lines.length)` rows for the header. The web-side equivalents in `apps/web/src/lib/parser/csv.ts` scan `Math.min(30, lines.length)`. Korean credit card exports from some banks (notably Samsung and KB) can have 10+ metadata rows before the actual header row.

**Failure mode**: A CSV file with more than 10 metadata rows will fail to parse on the server (CLI/tools) but parse correctly on the web app. The user gets `"헤더 행을 찾을 수 없습니다"` from the CLI but the same file works in the browser.

**Suggested fix**: Increase the server-side scan limit from 10 to 30 to match the web-side adapters.

---

### D-07: `loadCategories` returns `[]` on AbortError, silently producing "uncategorized" results

**File**: `apps/web/src/lib/cards.ts:281`
**Confidence**: Medium

**What triggers it**: `loadCategories()` catches AbortError and returns `undefined`, which the function then converts to `[]`. If a component unmounts during the fetch and remounts quickly, the cached promise may already be resolved to `[]`. The analyzer guards against this with `if (nodes.length === 0) throw new Error(...)`, but other call sites like `getCategoryLabels()` in the store do not -- they pass the empty array to `buildCategoryLabelMap()`, which returns an empty Map, and the optimizer then produces results with raw English category keys.

**Failure mode**: After a rapid navigate-away-and-back, the optimization results show English category keys (e.g., "dining.cafe") instead of Korean labels (e.g., "카페"). The data is structurally correct but cosmetically broken.

**Suggested fix**: The `getCategoryLabels()` method in `store.svelte.ts` already guards against caching empty Maps (line 389-392), but it still *returns* the empty Map for the current call. Consider having `getCategoryLabels()` retry the fetch once if the result is empty, similar to the retry logic in `loadCardsData()`.

---

### D-08: `scoreCardsForTransaction` mutates `assignedTransactionsByCard` array in-place during scoring

**File**: `packages/core/src/optimizer/greedy.ts:133-139`
**Confidence**: Medium

**What triggers it**: The optimizer pushes a transaction onto the card's assigned array to compute marginal reward, then pops it. This is documented as an intentional optimization. However, if `calculateCardOutput` were ever to throw (e.g., due to a malformed card rule), the `pop()` on line 139 would not execute, leaving the transaction permanently in the wrong card's array.

**Failure mode**: If a card rule has an invalid structure that causes `calculateRewards` to throw, the transaction is permanently added to that card's array, corrupting all subsequent scoring for that card. The try/catch in `parseCSV` (web-side) and `parseCSV` (server-side) handles adapter failures, but `calculateRewards` does not have its own try/catch.

**Suggested fix**: Wrap the push/pop in a try/finally:

```ts
currentTransactions.push(transaction);
try {
  const after = calculateCardOutput(currentTransactions, previousMonthSpending, rule).totalReward;
  // ...
} finally {
  currentTransactions.pop();
}
```

---

### D-09: `parseAmount` in server-side CSV shared.ts does not strip whitespace inside amount strings

**File**: `packages/parser/src/csv/shared.ts:36`
**Confidence**: Low

**What triggers it**: The `parseCSVAmount` function strips whitespace with `.replace(/\s/g, '')`. However, the same function in the web-side `apps/web/src/lib/parser/csv.ts:56` also strips whitespace with `.replace(/\s/g, '')`. Both implementations now agree. However, the *individual bank adapters* in `packages/parser/src/csv/` do NOT strip whitespace -- they call `parseCSVAmount` which does, so they are covered. But the XLSX parsers in both web and server do NOT strip whitespace in the string-to-number path (`packages/parser/src/xlsx/index.ts:62` and `apps/web/src/lib/parser/xlsx.ts:230`).

**Failure mode**: An XLSX cell containing `"1 234 567"` (spaces as thousand separators, common in Korean spreadsheets) would fail to parse in the XLSX parsers but succeed in the CSV parsers. This is a consistency issue.

**Suggested fix**: Add `.replace(/\s/g, '')` to the string-parsing path in both XLSX parsers, matching the CSV behavior.

---

### D-10: `selectTier` uses strict `>=` comparison, excluding users at exactly `minSpending` boundary when tier has `maxSpending`

**File**: `packages/core/src/calculator/reward.ts:14-17`
**Confidence**: Low

**What triggers it**: The `selectTier` function checks `previousMonthSpending >= t.minSpending && (t.maxSpending === null || previousMonthSpending <= t.maxSpending)`. If a user's previous month spending is exactly at a tier boundary (e.g., tier 1: 0-300000, tier 2: 300000-600000), the user qualifies for BOTH tiers at exactly 300000 Won. The function then selects the one with the highest `minSpending` (tier 2), which is typically the correct behavior (the more beneficial tier).

**Failure mode**: This is actually correct behavior for Korean card terms where the boundary is inclusive on both sides. The `reduce` at line 21 picks the tier with the highest `minSpending`, so boundary users get the better tier. No fix needed -- documented for clarity.

---

### D-11: Web-side `loadCardsData` retry on undefined result may return a promise that resolves to undefined

**File**: `apps/web/src/lib/cards.ts:237-239`
**Confidence**: Medium

**What triggers it**: When `loadCardsData()` detects that the cached promise resolved to `undefined` (AbortError), it checks `if (result === undefined && cardsPromise)` and returns `cardsPromise`. However, the new `cardsPromise` could *also* resolve to `undefined` if a second AbortError occurs. The `getAllCardRules()` function handles this by checking `if (!data) return []`, but `getCardById()` and `getCardList()` also handle it, so the failure mode is limited to returning empty/null rather than crashing.

**Failure mode**: In a rapid abort-retry scenario, `loadCardsData()` could return a promise that resolves to `undefined`, causing `getAllCardRules()` to return `[]`. The optimizer would then produce 0 rewards with no error message.

**Suggested fix**: Add a retry counter or loop that limits the number of retry attempts, or have `loadCardsData()` throw on the second consecutive undefined result instead of silently returning undefined.

---

### D-12: HTML report `replaceAll` with `{{...}}` placeholders could inject raw HTML

**File**: `packages/viz/src/report/generator.ts:228-233`
**Confidence**: Low

**What triggers it**: The `generateHTMLReport` function uses `template.replaceAll('{{SUMMARY}}', buildSummary(result))` etc. The `buildSummary`, `buildCategoryTable`, `buildCardComparison`, and `buildAssignments` functions all use `esc()` for merchant names and card names, but they do NOT escape category names or performance tier labels that come from the optimization result. If a category name or tier label contained HTML tags, they would be injected raw.

**Failure mode**: Since category names come from the `CATEGORY_NAMES_KO` constant (hardcoded) or the YAML taxonomy (controlled input), this is not exploitable in practice. However, if a user ever adds a category with `<script>` in its name to the YAML, the HTML report would contain raw script tags.

**Suggested fix**: Apply `esc()` to all dynamic values inserted into the HTML template, including category names and tier labels. This is defense-in-depth, not an active vulnerability.

---

### D-13: Server-side XLSX parser returns first sheet with transactions, web-side returns sheet with most transactions

**File**: `packages/parser/src/xlsx/index.ts:113` vs `apps/web/src/lib/parser/xlsx.ts:319-323`
**Confidence**: Low

**What triggers it**: The server-side XLSX parser returns the *first* sheet that yields any transactions (early return on line 113). The web-side parser compares all sheets and returns the one with the *most* transactions. For multi-sheet workbooks where a summary sheet has fewer transactions than a detail sheet, the server-side parser may return the summary sheet while the web-side returns the detail sheet.

**Failure mode**: CLI users see fewer transactions than web users for the same XLSX file. This is unlikely to affect real Korean credit card exports (which typically have a single sheet), but could confuse users with multi-sheet workbooks.

**Suggested fix**: Change the server-side XLSX parser to match the web-side behavior: compare transaction counts across all sheets and return the one with the most.

---

### D-14: `buildCategoryKey` produces different keys for same logical category depending on subcategory presence

**File**: `packages/core/src/calculator/reward.ts:28-29`
**Confidence**: Low

**What triggers it**: `buildCategoryKey("dining", undefined)` returns `"dining"`, while `buildCategoryKey("dining", "cafe")` returns `"dining.cafe"`. The optimizer's `findRule` function at line 81 explicitly prevents broad category rules from matching subcategorized transactions. However, if a transaction is categorized as `category: "dining", subcategory: undefined` (i.e., the matcher found "dining" but not "cafe"), it will match the broad "dining" rule and get the dining rate, even if the merchant is actually a cafe that the matcher failed to identify.

**Failure mode**: A cafe transaction that the matcher assigns to `category: "dining"` (without the "cafe" subcategory) will get the broader dining discount rate instead of the typically higher cafe-specific rate. This is a categorization accuracy issue, not a code bug per se.

**Suggested fix**: This is a known design trade-off documented in the code (line 76-81 comment). No code change needed unless the matcher's accuracy is improved.

---

## Summary

| ID | Severity | Confidence | Package | Brief |
|----|----------|------------|---------|-------|
| D-01 | Medium | High | core | Global cap rollback causes ruleMonthUsed divergence |
| D-02 | High | High | parser | Web-side CSV adapters skip total-row filter |
| D-03 | Low | Medium | web | buildCategoryLabelMap missing bare subcategory IDs |
| D-04 | Low | Low | web | .xls extension treated as XLSX |
| D-05 | Medium | Medium | parser | Unparseable dates return raw input silently |
| D-06 | High | High | parser | Server CSV adapters scan 10 lines vs web's 30 |
| D-07 | Medium | Medium | web | Empty categories on AbortError produce English keys |
| D-08 | Medium | Medium | core | push/pop mutation not in try/finally |
| D-09 | Low | Low | parser | XLSX parsers don't strip whitespace in amount strings |
| D-10 | N/A | N/A | core | Tier boundary is inclusive (correct, not a bug) |
| D-11 | Medium | Medium | web | loadCardsData retry can return undefined twice |
| D-12 | Low | Low | viz | HTML report doesn't escape category/tier names |
| D-13 | Low | Low | parser | Server XLSX returns first sheet vs web's most-transactions |
| D-14 | N/A | N/A | core | Categorization accuracy trade-off (not a bug) |

**Actionable findings**: D-01 through D-09, D-11 through D-13 (12 findings)
**Non-issues / by-design**: D-10, D-14 (2 findings)

### Top 3 by impact

1. **D-06**: Server-side CSV header scan limit (10) is too low -- real Korean card statements with 10+ metadata rows fail to parse on CLI but work on web. Simple fix: change `10` to `30`.

2. **D-02**: Web-side CSV bank adapters lack the summary-row filter that server-side adapters have. `합계` (total) rows inflate spending on the web. Add the same `/합계|총계|소계|total|sum/i` filter to all web-side adapters.

3. **D-08**: The push/pop mutation in `scoreCardsForTransaction` is not protected by try/finally. If `calculateCardOutput` throws, the transaction is permanently stuck in the wrong card's array, corrupting all subsequent optimization. Wrap in try/finally.
