# Code Quality Review — Cycle 2 (2026-04-19)

Reviewer: code-reviewer angle
Scope: All source files across packages/core, packages/parser, packages/rules, packages/viz, apps/web, tools/

---

## Finding C2-01: LLM fallback `AbortController` timeout is never connected to the API call

**File:** `packages/parser/src/pdf/llm-fallback.ts:47-50`
**Severity:** HIGH
**Confidence:** High

An `AbortController` is created and `setTimeout` is set to abort after 30s, but the `signal` is never passed to `client.messages.create()`. The timeout has no effect.

```ts
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30_000);
// ...
const message = await client.messages.create({
  model,
  max_tokens: 4096,
  // MISSING: signal: controller.signal
  system: SYSTEM_PROMPT,
  messages: [...]
});
```

**Fix:** Add `signal: controller.signal` to the `messages.create()` call options.

---

## Finding C2-02: `CategoryTaxonomy.findCategory` O(n) substring scan on every call

**File:** `packages/core/src/categorizer/taxonomy.ts:68-74`
**Severity:** MEDIUM
**Confidence:** High

The substring match iterates all keyword entries in the map using `for...of` with `lower.includes(kw)`. For large keyword maps, this is O(n * m) per call where n = number of keywords and m = average merchant name length. The `MerchantMatcher.match()` calls this for every transaction on every merchant.

This is acceptable for current scale but should be noted for future optimization with a trie or Aho-Corasick structure.

---

## Finding C2-03: `loadCardsData` and `loadCategories` cache promises but don't validate data shape

**File:** `apps/web/src/lib/cards.ts:144-173`
**Severity:** MEDIUM
**Confidence:** Medium

The fetch functions cache the promise but do `res.json() as Promise<CardsJson>` without runtime validation. If the JSON structure changes (e.g., after a bad deploy), the cached promise will resolve with invalid data and remain cached until the page reloads.

**Fix:** Add a basic shape validation after parsing, or use Zod for runtime validation of the fetched JSON.

---

## Finding C2-04: `formatDateKo` and `formatDateShort` create `Date` from YYYY-MM-DD which is parsed as UTC midnight

**File:** `apps/web/src/lib/formatters.ts:137-151`
**Severity:** MEDIUM
**Confidence:** High

`new Date("2026-03-15")` is parsed as UTC midnight per the spec, but `getMonth()` and `getDate()` return local time values. In timezones behind UTC (e.g., US Pacific), this could show the previous day. Korean timezone (UTC+9) is always ahead, so the date will always be correct for Korean users. However, if someone uses the app from a non-Asian timezone, dates could display incorrectly.

**Fix:** Parse the date manually with `split('-')` instead of using the `Date` constructor for date-only strings, or use `new Date(dateStr + 'T00:00:00')` to force local time interpretation.

---

## Finding C2-05: `toRulesCategoryNodes` passes empty string for `labelEn` which is a lie

**File:** `apps/web/src/lib/analyzer.ts:25`
**Severity:** LOW
**Confidence:** Medium

The adapter sets `labelEn: ''` for all category nodes because the web type doesn't have `labelEn`. This is technically valid (empty string satisfies the type) but semantically incorrect — it implies the English label is known to be empty rather than unknown.

**Fix:** Either add `labelEn` to the web CategoryNode type, or add a comment documenting that `labelEn` is intentionally blank because it's unused by the matcher.

---

## Finding C2-06: E2E test uses `require()` for Playwright and Node modules

**File:** `e2e/ui-ux-review.spec.js:6-9`
**Severity:** LOW
**Confidence:** High

The file uses `const { expect, test } = require('@playwright/test')` and `require('path')`, `require('fs')`. This works but is CJS style. Since the rest of the project is TypeScript with ESM, this inconsistency could cause confusion. Not a bug, but a style issue.

---

## Finding C2-07: `BANK_COLUMN_CONFIGS` in xlsx.ts has 24 entries but CSV adapters only have 10

**File:** `apps/web/src/lib/parser/xlsx.ts:18-170`
**Severity:** LOW
**Confidence:** High

The XLSX parser has column configs for all 24 bank IDs (kakao, toss, kbank, etc.) but the CSV parser only has dedicated adapters for 10. The remaining 14 XLSX entries will work for XLSX parsing but fall through to the generic CSV parser for CSV files. This asymmetry is documented but could confuse contributors.

---

## Finding C2-08: `loadFromStorage` does not validate `fullStatementPeriod` or `totalTransactionCount`

**File:** `apps/web/src/lib/store.svelte.ts:115-147`
**Severity:** MEDIUM
**Confidence:** High

The `loadFromStorage` function validates basic fields (`optimization.assignments`, `totalReward`, etc.) but does not validate `fullStatementPeriod` or `totalTransactionCount` which were added in cycle 1. If the stored data is from before these fields were added, they'll be `undefined` when loaded. The code handles this with fallback getters (lines 195-198) but the `PersistedAnalysisResult` type includes them, creating a mismatch between type and runtime.

**Fix:** Add explicit validation/fallback for these fields in `loadFromStorage`.

---

## Final Sweep: Previously reported findings status

| ID | Status |
|---|---|
| C-01 (changeCategory subcategory) | **FIXED** — line 151 now has `tx.subcategory = undefined` |
| C-02 (as unknown as) | **FIXED** — replaced with `toRulesCategoryNodes` and `toCoreCardRuleSets` adapters |
| H-01 (year inference) | **FIXED** — `inferYear` helper added |
| H-02 (performanceExclusions) | **FIXED** — `allExclusions` filter added in analyzer.ts |
| H-03 (mixed all-month metadata) | **FIXED** — separate fields added |
| H-04 (CATEGORIES divergence) | **FIXED** — loaded from taxonomy dynamically |
| H-05 (safeAmount) | **FIXED** — replaced with `parseAmount` + `isValidAmount` |
| H-06 (bypassCSP) | **FIXED** — removed from E2E tests |
| M-02 (deduplicate calc) | **FIXED** — `calculatePercentageReward` shared function |
| M-03 (adapter fallback logging) | **FIXED** — `console.warn` added |
| M-05 (PDF parseAmount) | **FIXED** — returns NaN |
| M-06 (subcategory blocking docs) | **FIXED** — comment added |
| M-07 (rate convention docs) | **FIXED** — comment added |
