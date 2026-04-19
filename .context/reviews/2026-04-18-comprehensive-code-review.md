# Comprehensive code review — 2026-04-18

## Recommendation

**REQUEST CHANGES**

The prior review (2026-04-12) identified 7 major blockers. Since then, 20+ remediation commits have landed, fixing the most critical issues: the optimizer now scores on real transactions (not category totals), duplicate reward rules are disambiguated by specificity, unsupported unit rewards are explicit, the CSP/inline-script conflict is addressed, and browser runtime hardening landed. However, the review finds **16 confirmed issues remaining** — 3 CRITICAL, 5 HIGH, 8 MEDIUM — plus several lower-severity items. The most urgent are: points/mileage rates calculated 100x too high due to `normalizeRate` not dividing by 100, 839 English merchant keywords unreachable due to case mismatch, and a timezone bug that corrupts every date for non-UTC users.

---

## Scope and inventory

Every review-relevant source/config/test/doc surface was examined:

- **Root/docs/config**: `package.json`, `tsconfig.base.json`, `turbo.json`, `.gitignore`, `playwright.config.ts`, `scripts/build-json.ts`
- **Web app** (`apps/web`): Astro config, 5 pages, layout, public scripts, parser/analyzer/store/libs, all Svelte components
- **Core engine** (`packages/core`): calculator, optimizer, categorizer, models, tests
- **Backend parser** (`packages/parser`): CSV/XLSX/PDF parsers, detection, tests
- **Rules package** (`packages/rules`): loader/schema/types, `categories.yaml`, `issuers.yaml`, sample card YAMLs, tests
- **Visualization** (`packages/viz`): terminal/report generation + tests
- **CLI** (`tools/cli`): commands + tests
- **Scraper** (`tools/scraper`): CLI/fetch/extract/validate/write + tests
- **E2E**: 2 Playwright specs + fixture
- **Prior review artifacts**: `.context/reviews/2026-04-12-comprehensive-code-review.md`, `00-summary.md`

Excluded: `node_modules`, `dist`, `.turbo`, `.omc`, `.omx`, generated `cards.json`.

---

## Verification performed

- Read every source file across all packages (not dist/)
- Ran grep sweeps for: `Math.abs`, `new Date().getFullYear`, `as any`/`@ts-ignore`, `innerHTML`/`{@html`, API key exposure, `catch` blocks, `normalizeRate`, `performanceExclusions`, `console.log`
- Cross-referenced current code against the 2026-04-12 findings to verify which were fixed
- Reviewed git log since 2026-04-12 (20+ remediation commits)
- Spawned 5 parallel deep-review agents for each major package area
- Did a final missed-issues sweep

---

## Remediation status since 2026-04-12

| Prior finding | Status | Notes |
|---|---|---|
| 1) CSP blocks hydration | **Partially fixed** | Public scripts now build-safe, but CSP still `script-src 'self'` which blocks Astro inline island bootstraps in production. E2E still uses `bypassCSP: true`. |
| 2) Points/mileage rates not normalized | **NOT fixed** | `normalizeRate()` at `reward.ts:99-105` only divides discount/cashback by 100. Points/mileage rates (stored as percentages like `8.0` = 8%) are passed through unchanged, causing 100x inflation. Verified: `bc/baro-barbara-check.yaml` has `type: points, rate: 8.0` meaning 8%, but calculator computes 800%. |
| 3) Duplicate reward rules collapsed to first match | **Fixed** | `findRule()` now sorts by `ruleSpecificity()` and `ruleConditionsMatch()` checks conditions. |
| 4) Previous-month spending ignores performanceExclusions | **Not fixed** | Still uses raw total. No code in `analyzer.ts` or `reward.ts` filters by exclusion list. |
| 5) Upload shows success on analysis failure | **Not fixed** | `analysisStore.analyze()` still catches and sets `error`/`result=null` without rethrowing. `handleUpload()` still unconditionally sets success. |
| 6) Manual recategorization writes subcategory IDs into category | **Not fixed** | `changeCategory()` at `TransactionReview.svelte:151-157` still only sets `tx.category = newCategory` without updating `subcategory`. |
| 7) Taxonomy drift makes rule entries unreachable | **Partially fixed** | Some categories added, but `TransactionReview.svelte` still has a hardcoded flat list that doesn't match `categories.yaml`. |
| 8) Dashboard mixes all-month metadata with latest-month optimization | **Not fixed** | `analyzeMultipleFiles()` still merges `transactionCount`/`statementPeriod` from all months but optimizes only the latest. |
| 9) Short date parsing assumes current year | **Not fixed** | Both `csv.ts:43,56` and `generic.ts:59,66` still use `new Date().getFullYear()`. |
| 10) ILP silently falls back to greedy | **Not fixed** | `ilp.ts:47` still returns `greedyOptimize()` with no warning. |
| 11) Browser CSV support overstated | **Not fixed** | 24 bank IDs advertised, only ~10 have dedicated adapters. |
| 12) Unit-based fuel/mileage rewards return 0 | **Fixed** | `calculateFixedReward()` now handles `won_per_day` and `mile_per_1500won`, returns 0 for unsupported units with a comment explaining why. |
| 13) Documentation inconsistencies | **Not fixed** | Still present. |
| 14) Root `bun test` broken by Playwright specs | **Not fixed** | Still present. |

---

## Detailed findings

### 0a) Confirmed — CRITICAL — `normalizeRate` does not divide points/mileage rates by 100 — rewards calculated 100x too high

**Files / regions**
- `packages/core/src/calculator/reward.ts:99-105`
- `packages/rules/data/cards/bc/baro-barbara-check.yaml` — `type: points, rate: 8.0` (intended 8%)
- `packages/rules/data/cards/nh/goodgame-check.yaml` — `type: points, rate: 1.0` (intended 1%)

**Why this is a problem**
`normalizeRate()` divides only `discount` and `cashback` by 100. `points` and `mileage` are passed through unchanged. But YAML card data stores ALL rate types in the same percentage format — `rate: 8.0` means 8% whether it's discount or points. The core review agent verified this by examining actual YAML data: `bc/baro-barbara-check.yaml` has `type: points, rate: 8.0` with note "8% 적립". The rate `8.0` is passed to `calculatePoints()` as `8.0` instead of `0.08`.

**Concrete failure scenario**
A 100,000 Won transaction with 8% points rate yields `Math.floor(100000 * 8.0) = 800,000` Won reward (800%) instead of the correct `Math.floor(100000 * 0.08) = 8,000` Won (8%). This affects 259 YAML card files with points rules and 29 with mileage rules. The existing test suite has zero test coverage for points or mileage reward types, so this bug goes completely undetected by tests.

**Suggested fix**
Change `normalizeRate` to divide by 100 for all reward types, since all rates in YAML are stored in percentage form:
```ts
function normalizeRate(ruleType: string, rate: number | null): number | null {
  if (rate === null) return null;
  return rate / 100;
}
```

**Confidence**: High

---

### 0b) Confirmed — CRITICAL — 839 ENGLISH_KEYWORDS entries are unreachable due to case mismatch

**Files / regions**
- `packages/core/src/categorizer/matcher.ts:33-41` — `merchantName.toLowerCase()` vs uppercase keys
- `packages/core/src/categorizer/keywords-english.ts` — 1,680 of 1,687 keys are all-uppercase

**Why this is a problem**
`MerchantMatcher.match()` lowercases the input merchant name at line 33 (`const lower = merchantName.toLowerCase().trim()`), then looks it up in `ALL_KEYWORDS`. However, ENGLISH_KEYWORDS keys are stored in UPPERCASE (e.g., `'STARBUCKS COFFEE KOREA': 'dining.cafe'`). The lookup `ALL_KEYWORDS['starbucks coffee korea']` never matches `'STARBUCKS COFFEE KOREA'`. The substring scan in step 2 (lines 46-56) also fails because `lower.includes(kw)` and `kw.includes(lower)` are both case-sensitive. 839 ENGLISH_KEYWORDS entries have no lowercase counterpart in other keyword files, making them completely unreachable.

**Concrete failure scenario**
A Korean card statement shows merchant name as `STARBUCKS COFFEE KOREA` (how Korean billing systems encode it). The matcher lowercases it to `starbucks coffee korea`, fails exact lookup, fails substring scan (case-sensitive), falls through to taxonomy matching, and likely ends up categorized as `uncategorized` with confidence 0.0. This defeats the entire purpose of having ENGLISH_KEYWORDS.

**Suggested fix**
Lowercase all keys when building `ALL_KEYWORDS`:
```ts
const ALL_KEYWORDS: Record<string, string> = {};
for (const [key, val] of Object.entries(MERCHANT_KEYWORDS)) {
  ALL_KEYWORDS[key.toLowerCase()] = val;
}
// ... same for LOCATION_KEYWORDS, ENGLISH_KEYWORDS, NICHE_KEYWORDS
```

**Confidence**: High

---

### 1) Confirmed — CRITICAL — `rate` field used with conflicting semantics (percentage vs. per-unit amount) causes inflated rewards for fuel cards

**Files / regions**
- `packages/rules/src/schema.ts:16` — `rate: z.number().nonnegative().nullable()` accepts any value
- `packages/core/src/calculator/reward.ts:99-105` — `normalizeRate()` only divides discount/cashback by 100
- `packages/rules/data/cards/nh/take5.yaml:143` — `rate: 60` for fuel (intended: 60 won/liter)
- `packages/rules/data/cards/kb/goodday.yaml:46` — same pattern
- `packages/rules/data/cards/lotte/digiloca-auto.yaml:44-46` — correctly uses `fixedAmount + unit`

**Why this is a problem**
The `rate` field stores both percentage values (e.g., `5.0` = 5%) and per-unit amounts (e.g., `60` = 60 won/liter). The optimizer cannot distinguish them. For a fuel card with `rate: 60` (intended 60 won/liter), `normalizeRate()` passes it through unchanged (it's not `discount` or `cashback`), and the calculator computes `60000 * 60 = 3,600,000` won reward on a 60,000 won fill-up — a 6,000% return.

**Concrete failure scenario**
A user with `nh-take5` sees a recommended fuel reward of millions of won. The card is incorrectly ranked as the best card for transportation, pushing genuinely optimal cards down.

**Suggested fix**
Add a schema-level `superRefine` on `rewardTierRateSchema` that rejects `rate > 100` when `unit` is absent. Migrate the ~20 affected YAML files from `rate: 60` to `rate: null, fixedAmount: 60, unit: won_per_liter`.

**Confidence**: High

---

### 2) Confirmed — CRITICAL — Timezone-dependent date formatting produces wrong dates for non-UTC users

**Files / regions**
- `apps/web/src/lib/formatters.ts:138-151` — `new Date("2026-03-15")` parses as UTC midnight, then `getDate()` returns local-timezone date

**Why this is a problem**
Per ECMAScript spec, date-only strings like `"2026-03-15"` are parsed as UTC midnight. But `getMonth()`, `getDate()`, and `getFullYear()` return values in the local timezone. For users in timezones behind UTC (US-based Korean diaspora, anyone in Pacific/Mountain/Central time), `new Date("2026-03-15")` becomes `2026-03-14T15:00:00-09:00`, and `getDate()` returns 14.

**Concrete failure scenario**
A Korean user in Los Angeles opens the dashboard. Every transaction date is off by one day — March 15 shows as March 14. Monthly breakdowns are wrong, previous-month spending qualification is misaligned.

**Suggested fix**
Parse date strings manually instead of using `new Date()`:
```ts
export function formatDateKo(dateStr: string): string {
  const parts = dateStr.trim().split('-');
  if (parts.length !== 3) return '-';
  return `${parts[0]}년 ${parseInt(parts[1]!, 10)}월 ${parseInt(parts[2]!, 10)}일`;
}
```

**Confidence**: High

---

### 3) Confirmed — HIGH — `parseAmount` returns 0 instead of null for unparseable values across all 10 bank-specific CSV adapters

**Files / regions**
- `packages/parser/src/csv/hyundai.ts:17`, `kb.ts:17`, `ibk.ts:17`, `woori.ts:17`, `samsung.ts:17`, `shinhan.ts:17`, `lotte.ts:17`, `hana.ts:17`, `nh.ts:17`, `bc.ts:17`
- `apps/web/src/lib/parser/csv.ts:63-72`
- `packages/parser/src/pdf/index.ts:21`

**Why this is a problem**
All bank-specific CSV adapters define `parseAmount(raw: string): number` which returns `0` when `parseInt` returns `NaN`. The generic CSV parser correctly returns `null` to signal failure. But the bank-specific adapters and the browser parser silently emit a transaction with `amount: 0`, which is indistinguishable from a legitimate zero-amount transaction.

**Concrete failure scenario**
A corrupted amount cell (e.g., "N/A", "금액", "보류") in a Hyundai CSV produces a transaction with `amount: 0`. This propagates into the optimization engine, inflating transaction counts and distorting category averages.

**Suggested fix**
Change bank-specific `parseAmount` to return `number | null`, returning `null` on parse failure. Add null checks in each adapter's data loop, skipping the row and appending to `errors`. Apply the same fix to the browser parser.

**Confidence**: High

---

### 4) Confirmed — HIGH — Swallowed exceptions in `parseCSV` dispatcher hide parsing failures

**Files / regions**
- `packages/parser/src/csv/index.ts:44-45` and `55-56`

**Why this is a problem**
When a bank-specific adapter throws, the error is caught and silently discarded with `catch (err) { // Fall through to generic parser }`. No logging, no error recording, and `err` is unused. The user gets a generic parser result instead, with no indication that the correct adapter was found but failed.

**Concrete failure scenario**
A Hyundai CSV format change causes the Hyundai adapter to throw. The user gets generic-parser output with wrong column mappings and no error. Debugging is extremely difficult.

**Suggested fix**
Append the caught error to the `ParseResult.errors` array: `"Hyundai adapter failed: ${err.message}, falling back to generic parser"`.

**Confidence**: High

---

### 5) Confirmed — HIGH — Upload flow shows success and redirects even when analysis fails

**Files / regions**
- `apps/web/src/components/upload/FileDropzone.svelte:174-188`
- `apps/web/src/lib/store.svelte.ts:190-205`

**Why this is a problem**
`analysisStore.analyze()` catches its own errors, sets `error` in store state, and does **not rethrow**. `FileDropzone.handleUpload()` awaits it inside `try`, then unconditionally marks the upload as success and redirects.

**Concrete failure scenario**
Upload an empty/invalid statement. `analysisStore.analyze()` sets `result = null` and records the error internally, but `handleUpload()` still sets `uploadStatus = 'success'` and navigates to `/dashboard`. The user sees a success animation followed by a broken dashboard.

**Suggested fix**
Make `analyze()` either rethrow after updating the store, or return an explicit outcome. Only show success and redirect when a non-null result exists.

**Confidence**: High

---

### 6) Confirmed — HIGH — Manual recategorization writes subcategory IDs into `category`, breaking reward matching

**Files / regions**
- `apps/web/src/components/dashboard/TransactionReview.svelte:151-157`
- `packages/core/src/calculator/reward.ts:63-69`

**Why this is a problem**
The manual editor dropdown mixes top-level IDs (`dining`) and subcategory IDs (`cafe`, `taxi`, `hotel`) in one flat list. `changeCategory()` only sets `tx.category = newCategory`; it never updates `tx.subcategory`. The optimizer expects canonical pairs like `{ category: 'dining', subcategory: 'cafe' }`, not `{ category: 'cafe' }`.

**Concrete failure scenario**
A user fixes Starbucks from `uncategorized` to `cafe`. The transaction becomes `{ category: 'cafe', subcategory: undefined }`. A rule like `{ category: 'dining', subcategory: 'cafe' }` no longer matches, so the corrected transaction gets zero reward.

**Suggested fix**
Drive the editor from the taxonomy and write canonical `(category, subcategory)` pairs. The UI should expose top-level/subcategory structure instead of a flat list.

**Confidence**: High

---

### 7) Confirmed — HIGH — No file size limit on upload — browser memory exhaustion

**Files / regions**
- `apps/web/src/components/upload/FileDropzone.svelte:105-108`

**Why this is a problem**
`isValidFile()` validates MIME type and extension but there is no maximum file size check. A user can drop a 2 GB PDF, which is read entirely into an `ArrayBuffer` by `parseFile()`. On a mobile device or low-RAM machine, this freezes or crashes the browser tab.

**Concrete failure scenario**
A user accidentally selects a large video file renamed to `.csv`. The browser tab freezes and eventually crashes, losing all session state.

**Suggested fix**
Add `MAX_FILE_SIZE = 10 * 1024 * 1024` and check `file.size` in `isValidFile()`.

**Confidence**: High

---

### 8) Confirmed — MEDIUM — Previous-month spending ignores `performanceExclusions`, so tiers are overqualified

**Files / regions**
- `apps/web/src/lib/analyzer.ts:93-99,137-162`
- `packages/core/src/calculator/reward.ts:155-161`

**Why this is a problem**
The analyzer computes prior-month spend as a raw monthly total and passes that directly into the calculator. Card rules define `performanceExclusions` (e.g., tax payments, apartment management fees), but the calculator never uses them. Excluded spend still upgrades the user into higher benefit tiers.

**Concrete failure scenario**
If the user's previous month was mostly apartment management fees and tax payments, `ibk-i-green` (and many other cards) will still be scored at tier1/tier2 even though those categories are supposed to be excluded from qualifying spend.

**Suggested fix**
Compute **per-card qualifying previous-month spend** from prior-month transactions after applying each card's exclusion list.

**Confidence**: High

---

### 9) Confirmed — MEDIUM — Dashboard mixes all-month metadata with latest-month optimization data

**Files / regions**
- `apps/web/src/lib/analyzer.ts:117-183`
- `apps/web/src/components/dashboard/SpendingSummary.svelte:49-60`

**Why this is a problem**
`analyzeMultipleFiles()` merges all uploaded transactions, but optimization only uses the **latest month**. The dashboard then mixes `transactionCount`/`statementPeriod` from all months with `totalSpending`/`assignments` from the latest month only.

**Concrete failure scenario**
Upload January and February statements. The dashboard says "200건, 2026-01 ~ 2026-02", but total spending and category breakdown only reflect February. The user is misled about what the numbers represent.

**Suggested fix**
Make all dashboard cards use the same scope, or explicitly separate "uploaded period summary" vs "optimized month summary".

**Confidence**: High

---

### 10) Confirmed — MEDIUM — Short date parsing assumes the current year, corrupts year-boundary statements

**Files / regions**
- `apps/web/src/lib/parser/csv.ts:43,56`
- `packages/parser/src/csv/generic.ts:59,66`

**Why this is a problem**
For dates like `12/31` or `1월 15일`, the parser uses `new Date().getFullYear()` instead of inferring the statement year.

**Concrete failure scenario**
A user parses a December 2025 statement on April 18, 2026. `12/31` becomes `2026-12-31`. That breaks chronological ordering, monthly breakdowns, and prior-month qualification.

**Suggested fix**
Infer the year from statement headers, neighboring full dates, or file context. At minimum, add a heuristic: if the month is greater than the current month, use the previous year.

**Confidence**: High

---

### 11) Confirmed — MEDIUM — `TransactionReview` sync effect permanently blocks store updates after first edit

**Files / regions**
- `apps/web/src/components/dashboard/TransactionReview.svelte:128-133`

**Why this is a problem**
The `$effect` syncs `editedTxs` from `analysisStore.transactions` only when `editedTxs.length === 0`. Once any category is changed, `editedTxs` is non-empty forever. If the user later uploads a new file, the effect condition is false, so `editedTxs` retains stale data.

**Concrete failure scenario**
After analyzing a second file, the transaction review table shows the first file's transactions with no way to refresh without a full page reload.

**Suggested fix**
Use a generation counter or track the store's result identity. Reset `editedTxs` when `analysisStore.result` changes.

**Confidence**: High

---

### 12) Confirmed — MEDIUM — LLM fallback has no timeout, no retry limit, and truncates without warning

**Files / regions**
- `packages/parser/src/pdf/llm-fallback.ts:33-54`

**Why this is a problem**
The Anthropic API call has no `timeout` option, no `maxRetries` limit, uses `claude-opus-4-5` (most expensive model), and truncates to 8000 chars without any indication of how much data was lost.

**Concrete failure scenario**
A 100-page PDF statement enters the LLM fallback. Only the first ~15-20 transactions are extracted (8000 char truncation). The user receives a partial result with no warning that 80+ transactions were missed.

**Suggested fix**
Add `timeout: 30000`, `maxRetries: 1`, consider `claude-sonnet-4-5` for structured extraction, and add a truncation warning to `ParseResult.errors`.

**Confidence**: High

---

### 13) Confirmed — MEDIUM — No UTF-8 BOM handling when reading CSV files

**Files / regions**
- `packages/parser/src/index.ts:38-48`
- `apps/web/src/lib/parser/index.ts` (browser equivalent)

**Why this is a problem**
Windows-generated CSV files (common in Korean banking software) often include a UTF-8 BOM (0xEF 0xBB 0xBF). The code does not strip the BOM before passing content to `parseCSV`. This causes the first column header to include the BOM character, breaking `headers.indexOf('이용일')` lookups in bank-specific adapters.

**Concrete failure scenario**
A BOM-prefixed CSV from KB Card has the header `\uFEFF거래일시` instead of `거래일시`. `indexOf` returns -1, triggering fallback to the generic parser with incorrect column assignments.

**Suggested fix**
Strip the BOM after decoding: `content = content.replace(/^\uFEFF/, '')`.

**Confidence**: High

---

### 14) Confirmed — MEDIUM — `detectBank` full-content scan allows merchant-name false positives

**Files / regions**
- `packages/parser/src/detect.ts:109-131`
- `apps/web/src/lib/parser/detect.ts:49-104`

**Why this is a problem**
`detectBank` scans the entire file content. Transaction data rows can contain merchant names that match bank signatures (e.g., a transaction at "농협" merchant in a Hyundai card statement would boost the `nh` score). Since detection is based on a simple match count, a file with many transactions at bank-named merchants could cause a wrong bank to be detected.

**Concrete failure scenario**
A KB Card statement with 20 transactions at NH농협 ATMs has a higher `nh` match score than `kb` score. The file is parsed with the NH adapter, producing wrong column mappings.

**Suggested fix**
Limit the scan to the first 10-20 lines of the file (where header/metadata appears) rather than the entire content.

**Confidence**: Medium

---

## Additional noteworthy findings

### 15) Likely issue — MEDIUM — `esc()` function does not escape single quotes

**Files / regions**
- `packages/viz/src/report/generator.ts:27-33`
- `apps/web/public/scripts/report.js`

**Why this matters**: Korean merchant names and card names can contain apostrophes. If any future template uses single-quoted attributes, this becomes an XSS vector. Fix: add `.replace(/'/g, '&#39;')`.

**Confidence**: Medium

### 16) Likely issue — MEDIUM — Path traversal via LLM-derived `card.issuer`/`card.id` in scraper `writer.ts`

**Files / regions**
- `tools/scraper/src/writer.ts:14-17`

**Why this matters**: `rule.card.issuer` and `rule.card.id` originate from LLM-extracted data. If the LLM returns `../../etc` as `issuer`, the path could write outside the intended directory. Fix: add `isPathSafe()` check rejecting values containing path separators or `..`.

**Confidence**: High

### 17) Likely issue — MEDIUM — `parseInt` without NaN check in CLI `optimize.ts` and `report.ts`

**Files / regions**
- `tools/cli/src/commands/optimize.ts:44`
- `tools/cli/src/commands/report.ts:50`

**Why this matters**: `--prev-spending abc` produces `NaN` which propagates into the optimizer silently. Fix: validate immediately after parsing.

**Confidence**: High

### 18) Likely issue — LOW — `.passthrough()` on three schemas allows misspelled fields to silently pass validation

**Files / regions**
- `packages/rules/src/schema.ts:28,37,61`

**Why this matters**: A misspelled `montlyCap` instead of `monthlyCap` would be accepted, silently removing spending limits. Fix: replace `.passthrough()` with `.strict()`.

**Confidence**: High

### 19) Likely issue — LOW — No referential integrity between `performanceTier` references and tier definitions

**Files / regions**
- `packages/rules/src/schema.ts:15`

**Why this matters**: A typo like `"tier0 "` (trailing space) passes validation, causing the optimizer to skip reward tiers silently. Fix: add a `refine` on `cardRuleSetSchema` that validates tier references.

**Confidence**: High

### 20) Risk — LOW — ILP optimizer still silently falls back to greedy

**Files / regions**
- `packages/core/src/optimizer/ilp.ts:43-49`

**Why this matters**: Callers requesting ILP get greedy results with no warning. Fix: throw unsupported-method error or remove the option.

**Confidence**: High

---

## Positive observations since the last review

1. **Transaction-level scoring is now correct** — The greedy optimizer now scores each transaction individually using real transaction data (not synthetic category totals). `scoreCardsForTransaction()` at `greedy.ts:84-110` preserves merchant, subcategory, and online/offline facts.

2. **Duplicate reward rules are now disambiguated** — `findRule()` sorts by `ruleSpecificity()` and checks conditions, preventing the first-match-wins problem.

3. **Unsupported unit rewards are explicit** — `calculateFixedReward()` returns 0 for unsupported units with a clear comment explaining why, instead of fabricating incorrect values.

4. **CSP/script conflict partially addressed** — Public script tags are now build-safe for Astro pages.

5. **Browser runtime hardened** — AI categorizer is properly disabled with a clear explanation of why. PDF worker uses same-origin bundle instead of CDN.

6. **E2E test coverage expanded** — Core regressions spec validates optimizer totals alignment and duplicate-key matching.

7. **HTML escaping in report generator** — The `esc()` function is consistently applied to all string data in the HTML report.

8. **Schema validation in build-json.ts** — The build script cross-references category IDs and performance tier references, reporting warnings for mismatches.

---

## Final missed-issues sweep

After the main review, I ran a final sweep specifically for commonly missed classes of issues:

- **Cross-file model drift**: taxonomy vs TransactionReview dropdown vs rule dataset — still drifted (hardcoded flat list vs. hierarchical taxonomy)
- **Silent failure paths**: parseAmount returning 0, swallowed adapter exceptions, analyze() not rethrowing — all still present
- **Temporal bugs**: current-year date assumptions — still present
- **State-consistency bugs**: upload success-on-failure, transaction sync after edit — still present
- **Algorithmic correctness**: rate semantics for fuel cards — new CRITICAL finding
- **Timezone bugs**: date formatting using `new Date()` — new CRITICAL finding
- **Security**: path traversal in scraper, missing file size limits — new findings
- **Test gaps**: no tests for bank-specific parseAmount returning 0, no tests for the timezone date formatting, no tests for the TransactionReview sync bug

I did **not** find evidence that relevant source/config/test/doc areas were skipped from the inventory. All source files in `packages/`, `tools/`, `apps/web/src/`, `scripts/`, and `e2e/` were examined.
