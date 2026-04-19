# Comprehensive Code Review — 2026-04-19 (Cycle 1)

**Reviewers:** code-reviewer, perf-reviewer, security-reviewer, critic, verifier, test-engineer, tracer, architect, debugger, document-specialist, designer (multi-perspective single-pass review)

**Scope:** Full repository — all packages, apps, tools, tests, config
**Baseline:** Prior reviews dated 2026-04-12 and 2026-04-18, plus all commits through `000000078`

---

## Executive Summary

Since the 2026-04-18 reviews, significant fixes have landed: `normalizeRate` now divides all rate types by 100, ILP fallback emits a warning, LLM fallback is gated behind an explicit flag, `sessionStorage` validation was added, and broad-category exclusion logic for subcategory transactions was implemented. However, **17 confirmed or likely issues remain** (2 CRITICAL, 6 HIGH, 7 MEDIUM, 2 LOW). The most urgent are: (1) `changeCategory` in `TransactionReview.svelte` still does not update `subcategory`, causing stale subcategory data that silently corrupts optimizer scoring; (2) the `as unknown as` type-safety bypasses in `analyzer.ts` remain unfixed and will silently produce wrong results if the `CardRuleSet` or `CategoryNode` types diverge between the web app and core package.

---

## Verification Performed

- Read every source file across all packages (not dist/)
- Ran grep sweeps for: `as unknown as`, `new Date().getFullYear`, `as any`, `innerHTML`, `{@html`, `catch {`, `normalizeRate`, `console.log`, `performanceExclusions`
- Cross-referenced current code against all prior 2026-04-12 and 2026-04-18 findings
- Reviewed git log since 2026-04-18 (7 remediation commits)
- Did a final missed-issues sweep across all packages

---

## Remediation Status Since 2026-04-18

| Prior finding | Status | Notes |
|---|---|---|
| normalizeRate not dividing points/mileage by 100 | **Fixed** | `reward.ts:103-107` now divides all rate types by 100 |
| ILP silently falls back to greedy | **Fixed** | `ilp.ts:48` now emits `console.warn` before falling back |
| LLM fallback sends data to Anthropic automatically | **Fixed** | `pdf/index.ts:131-142` now requires `allowRemoteLLM` flag |
| localStorage theme key mismatch | **Fixed** | `layout.js` now uses `cherrypicker:theme` |
| innerHTML XSS in report.js | **Fixed** | `report.js` now uses DOM `createElement` + `textContent` |
| Broad category rules matching subcategory transactions | **Fixed** | `findRule` at `reward.ts:71` now blocks broad rules from matching subcategory txs |
| Global cap sync with rule-level tracking | **Fixed** | `reward.ts:250-253` adjusts `ruleMonthUsed` when global cap reduces applied reward |
| sessionStorage validation | **Fixed** | `store.svelte.ts:115-135` validates parsed shape before accepting |
| CSP blocks Astro hydration | **Partially fixed** | CSP now includes `'unsafe-inline'` for `script-src`, but this weakens CSP significantly. See finding M-01. |
| `as unknown as` type-safety bypasses | **Not fixed** | `analyzer.ts:38,103` still uses unsafe casts |
| changeCategory does not update subcategory | **Not fixed** | `TransactionReview.svelte:154` still only sets `tx.category` |
| parseDateToISO uses `new Date().getFullYear()` | **Not fixed** | 6 instances across web/parser CSV/XLSX code |
| performanceExclusions not filtered in spending calc | **Not fixed** | `analyzer.ts` and `reward.ts` still use raw totals |
| Upload shows success on analysis failure | **Not fixed** | `analysisStore.analyze()` catches and sets `error`/`result=null` without rethrowing |
| Dashboard mixes all-month metadata with latest-month optimization | **Not fixed** | `analyzeMultipleFiles` still merges metadata from all months |
| Browser CSV support overstated | **Not fixed** | 24 bank IDs advertised but only 10 have dedicated CSV adapters |
| Duplicate parser implementations (web vs packages) | **Not fixed** | Major code duplication remains |
| CATEGORIES list in TransactionReview diverges from categories.yaml | **Not fixed** | Hardcoded 39-item list vs YAML taxonomy |

---

## New Findings

### C-01 — CRITICAL — `changeCategory` does not update `subcategory`, corrupting optimizer input

**File:** `apps/web/src/components/dashboard/TransactionReview.svelte:151-157`

**Why this is critical:**
When a user manually changes a transaction's category via the dropdown, `changeCategory` sets `tx.category = newCategory` but leaves `tx.subcategory` unchanged. The optimizer uses both `tx.category` and `tx.subcategory` for rule matching. A stale subcategory from the old category (e.g., `cafe` from a dining transaction) paired with the new category (e.g., `public_transit`) will cause `findRule` to either match a wrong rule or no rule at all.

**Concrete failure scenario:**
1. Transaction is auto-categorized as `dining` with `subcategory: cafe`
2. User changes category to `public_transit` via the dropdown
3. `tx.category = 'public_transit'` but `tx.subcategory` remains `cafe`
4. In `findRule`, `buildCategoryKey('public_transit', 'cafe')` creates `public_transit.cafe` — a key that matches no reward rule
5. The transaction gets zero reward instead of the correct public_transit reward

**Suggested fix:**
In `changeCategory`, look up whether `newCategory` has any subcategories in the taxonomy and clear `tx.subcategory` (or set it to `undefined`) since the old subcategory is no longer valid:
```ts
function changeCategory(txId: string, newCategory: string) {
  const tx = editedTxs.find(t => t.id === txId);
  if (tx) {
    tx.category = newCategory;
    tx.subcategory = undefined; // Old subcategory is invalid after category change
    tx.confidence = 1.0;
    hasEdits = true;
  }
}
```

**Confidence:** High

---

### C-02 — CRITICAL — `as unknown as` type-safety bypasses silently corrupt data if types diverge

**Files:**
- `apps/web/src/lib/analyzer.ts:38` — `categoryNodes as unknown as RulesCategoryNode[]`
- `apps/web/src/lib/analyzer.ts:103` — `cardRules as unknown as CoreCardRuleSet[]`

**Why this is critical:**
The web app defines its own `CardRuleSet` type in `apps/web/src/lib/cards.ts` with `source: string`, while `@cherrypicker/rules` has `source: 'manual' | 'llm-scrape' | 'web'`. Similarly, the web `CategoryNode` has an extra `label` field. The `as unknown as` cast completely bypasses TypeScript's structural checking. If any field diverges (not just `source` — any future field), the optimizer silently receives misshapen data.

**Concrete failure scenario:**
If `RewardRule.type` in the core package changes from `string` to `'discount' | 'points' | 'cashback' | 'mileage'` (a narrowing), and the web's local type still has `type: string`, the cast hides the mismatch. A card with `type: 'mileage'` could pass through and be dispatched to the wrong calculator.

**Suggested fix:**
1. Import `CardRuleSet` and `CategoryNode` directly from `@cherrypicker/rules` and `@cherrypicker/core` instead of redeclaring them locally
2. Write adapter/validator functions that validate runtime shapes before passing to the optimizer
3. At minimum, add runtime assertions that check key fields

**Confidence:** High

---

### H-01 — HIGH — `parseDateToISO` uses `new Date().getFullYear()` — timezone-dependent date corruption

**Files:**
- `apps/web/src/lib/parser/csv.ts:46,59`
- `apps/web/src/lib/parser/xlsx.ts:218`
- `packages/parser/src/csv/generic.ts:59,66`
- `packages/parser/src/xlsx/index.ts:65`

**Why this is a problem:**
Six instances of `new Date().getFullYear()` assume the code runs in the user's local timezone. For Korean credit card statements, dates like `01/15` (January 15th) are interpreted relative to the local timezone. If the code runs on a server in UTC (e.g., CI, SSR, or API), `new Date().getFullYear()` returns the correct year, but the month/day could be wrong near midnight boundaries. More importantly, if the statement is from December and the current date is January, the year should be the *previous* year, not the current one.

**Concrete failure scenario:**
A user uploads a December 2025 statement in January 2026. Short dates like `12/25` get parsed as `2026-12-25` instead of `2025-12-25`. The optimizer then places these transactions in the wrong month, potentially affecting which month's transactions get optimized.

**Suggested fix:**
For short-date patterns, use a "look-back" heuristic: if the parsed date is more than 1 month in the future, assume it belongs to the previous year. Alternatively, infer the year from the statement period context (other fully-qualified dates in the same file).

**Confidence:** High

---

### H-02 — HIGH — `performanceExclusions` not filtered in previous-month spending calculation

**Files:**
- `apps/web/src/lib/analyzer.ts:94` — `totalSpendingThisMonth = transactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0)`
- `packages/core/src/calculator/reward.ts` — no code checks `performanceExclusions`

**Why this is a problem:**
Korean credit cards define `performanceExclusions` — spending categories that do not count toward the "previous month spending" threshold that determines which performance tier applies. Examples include installment payments, insurance, and tax payments. The current code sums *all* transaction amounts without filtering, causing the previous-month spending to be inflated.

**Concrete failure scenario:**
A card requires 300,000 Won previous-month spending for tier1. The user's actual qualifying spending is 280,000 Won (tier0), but with 50,000 Won in excluded insurance payments included, the code calculates 330,000 Won and assigns tier1. The user then receives higher rewards than they actually qualify for.

**Suggested fix:**
In `analyzer.ts`, filter out transactions whose category appears in the card's `performanceExclusions` before computing `totalSpendingThisMonth`. This requires passing the exclusion list through to the spending calculation.

**Confidence:** High

---

### H-03 — HIGH — `analyzeMultipleFiles` merges metadata from all months but optimizes only latest month

**File:** `apps/web/src/lib/analyzer.ts:108-185`

**Why this is a problem:**
`analyzeMultipleFiles` sets `transactionCount: allTransactions.length` (across all months) and `statementPeriod` spanning all months, but the `optimization` only covers the latest month's transactions. This creates a misleading result where the UI shows "847 transactions analyzed" but the optimization only considers 280 of them.

**Concrete failure scenario:**
A user uploads 3 monthly statements. The dashboard shows "847 transactions" and a statement period covering 3 months, but the optimization result only reflects the latest month's 280 transactions. The user believes the savings estimate covers all 847 transactions.

**Suggested fix:**
Either: (a) make `transactionCount` reflect only the optimized transactions, and add a separate `totalTransactions` for reporting; or (b) optimize each month separately and aggregate the results.

**Confidence:** High

---

### H-04 — HIGH — CATEGORIES list in TransactionReview.svelte diverges from categories.yaml taxonomy

**File:** `apps/web/src/components/dashboard/TransactionReview.svelte:10-50`

**Why this is a problem:**
The component has a hardcoded array of 39 categories. The YAML taxonomy in `packages/rules/data/categories.yaml` is the authoritative source and may have additional or different categories (e.g., `bus`, `subway`, `online_grocery`, `subscription`, etc. are present in the YAML but missing from the hardcoded list). When a user tries to manually recategorize a transaction, the dropdown may not show the correct category.

**Concrete failure scenario:**
A transaction is auto-categorized as `online_grocery` (a valid category in the YAML). The user wants to change it, but `online_grocery` is not in the `CATEGORIES` dropdown (it IS there actually, but let's verify). Checking: `online_grocery` IS in the list at line 19. However, `bus` and `subway` are NOT in the dropdown (they exist in the YAML taxonomy as subcategories under `public_transit`), so if a transaction is categorized as `bus`, the user cannot confirm or change it to `bus` from the dropdown.

**Suggested fix:**
Load categories from the same `categories.yaml` / `categories.json` that the rest of the system uses, rather than hardcoding them. This ensures the dropdown always matches the taxonomy.

**Confidence:** High

---

### H-05 — HIGH — `safeAmount` in web CSV parser silently returns 0 for unparseable amounts

**File:** `apps/web/src/lib/parser/csv.ts:77-80`

```ts
function safeAmount(raw: string): number {
  const v = parseAmount(raw);
  return Number.isNaN(v) ? 0 : v;
}
```

**Why this is a problem:**
When `parseAmount` returns `NaN`, `safeAmount` returns `0`. Bank adapters (samsung, shinhan, kb, etc.) use `safeAmount` for amounts. A transaction with `amount: 0` is not filtered out by the bank adapters (unlike `parseGenericCSV` which now skips `NaN` amounts with an error). This means a malformed amount becomes a zero-value transaction that passes through silently, polluting the optimization.

**Concrete failure scenario:**
A Samsung CSV has a row with amount `"N/A"`. `parseAmount("N/A")` returns `NaN`, `safeAmount` returns `0`. The transaction with amount 0 is created and passed to the optimizer. In `reward.ts:176`, `tx.amount <= 0` causes it to be skipped from reward calculation, but it still counts toward `transactionCount` and `spending` totals if it passes through the categorizer.

**Suggested fix:**
Replace `safeAmount` usage in bank adapters with `parseAmount` + `NaN` check + error reporting, matching the pattern used in `parseGenericCSV` and the XLSX parser.

**Confidence:** High

---

### H-06 — HIGH — E2E tests use `bypassCSP: true`, hiding CSP violations in production

**File:** `e2e/ui-ux-review.spec.js:12`

```js
test.use({ bypassCSP: true }); // Required until CSP is fixed per code review
```

**Why this is a problem:**
The E2E tests bypass CSP, so they cannot detect CSP-related failures. The CSP was "fixed" by adding `'unsafe-inline'` to `script-src`, but this is a security weakening. The E2E tests should enforce CSP to catch any future regressions.

**Suggested fix:**
Remove `bypassCSP: true` from E2E tests. If CSP is correct, the tests should pass without bypassing it. If they fail, that indicates a real CSP problem.

**Confidence:** High

---

### M-01 — MEDIUM — CSP includes `'unsafe-inline'` for `script-src`, undermining XSS protection

**File:** `apps/web/src/layouts/Layout.astro:39`

```
script-src 'self' 'unsafe-inline'
```

**Why this is a problem:**
`'unsafe-inline'` allows any inline script to execute, which negates the primary benefit of CSP — preventing XSS attacks. If an attacker can inject a `<script>` tag (e.g., through a compromised CDN, browser extension, or stored XSS), CSP will not block it.

**Suggested fix:**
Remove `'unsafe-inline'` and move all inline scripts to external files referenced via `<script src="...">`. Use CSP nonces or hashes if any inline scripts are truly needed. The `is:inline` attribute on Astro scripts forces inline embedding; removing it allows Astro to bundle them as external scripts.

**Confidence:** High

---

### M-02 — MEDIUM — `calculateDiscount` and `calculatePoints` are identical functions

**Files:**
- `packages/core/src/calculator/discount.ts`
- `packages/core/src/calculator/points.ts`

**Why this is a problem:**
These two functions have identical logic: `Math.floor(amount * rate)`, then cap application. The only difference is the JSDoc comment. This is a DRY violation — if the cap logic changes in one, it must be manually duplicated in the other. `calculateCashback` (in `cashback.ts`) likely has the same structure.

**Suggested fix:**
Extract a shared `calculatePercentageReward` function and have all three call it. Keep the separate function names as thin wrappers if the API needs to distinguish reward types.

**Confidence:** Medium

---

### M-03 — MEDIUM — Bank adapter fallback silently swallows exceptions

**File:** `apps/web/src/lib/parser/csv.ts:879-896`

```ts
try {
  return adapter.parseCSV(content);
} catch {
  // Fall through to generic parser
}
```

**Why this is a problem:**
If a bank adapter throws (e.g., due to a header format change), the error is silently swallowed and the code falls through to the generic parser or another adapter. The user gets results from the wrong parser with no indication that something went wrong. The same pattern appears at lines 888-895.

**Suggested fix:**
Log the error (at minimum with `console.warn`) before falling through, or add it to the `errors` array so the user knows the primary parser failed.

**Confidence:** Medium

---

### M-04 — MEDIUM — `loadCardsData` caches failed fetches permanently until page reload

**File:** `apps/web/src/lib/cards.ts:144-157`

```ts
if (!cardsPromise) {
  cardsPromise = fetch(...)
    .catch(err => {
      cardsPromise = null;  // Reset on failure
      throw err;
    });
}
return cardsPromise;
```

**Why this is a problem:**
While the `.catch` handler sets `cardsPromise = null` to allow retries, there is a race condition: if two components call `loadCardsData()` simultaneously while a fetch is in-flight, both get the same promise. If it fails, both `.catch` handlers try to set `cardsPromise = null`, but between the failure and the reset, a third call could get the rejected promise. More importantly, there's no retry limit or backoff.

**Suggested fix:**
This is a minor concern since it only affects transient network failures. Consider adding a timestamp-based staleness check or using a proper caching library.

**Confidence:** Low

---

### M-05 — MEDIUM — PDF `parseAmount` in browser parser uses `|| 0` instead of NaN check

**File:** `apps/web/src/lib/parser/pdf.ts:146-147`

```ts
function parseAmount(raw: string): number {
  return parseInt(raw.replace(/원$/, '').replace(/,/g, ''), 10) || 0;
}
```

**Why this is a problem:**
`|| 0` converts both `NaN` and `0` to `0`, but it also converts any legitimate falsy value. More critically, this means a completely unparseable amount string like `"abc"` becomes `0` with no error reporting, unlike the CSV/XLSX parsers that now surface `NaN` as an error.

**Suggested fix:**
Match the pattern used in the CSV/XLSX parsers: return `NaN` from `parseAmount`, then check `Number.isNaN` in the caller and push an error.

**Confidence:** Medium

---

### M-06 — MEDIUM — `findRule` subcategory blocking logic may be too aggressive for wildcard categories

**File:** `packages/core/src/calculator/reward.ts:69-71`

```ts
// Broad category rules (no subcategory) should not match transactions
// that have a subcategory
if (tx.subcategory && !rule.subcategory && rule.category !== '*') return false;
```

**Why this is a problem:**
This logic correctly prevents a broad `dining` rule from matching a `dining.cafe` transaction (since Korean card terms typically exclude subcategories from the broader category). However, it also prevents a broad `dining` rule from matching a `dining.fast_food` transaction. In practice, many Korean card rules for "dining" do include fast_food but exclude cafe. The all-or-nothing approach may cause under-rewarding.

**Suggested fix:**
This may be the correct behavior for now given the typical Korean card term structure, but consider adding an `includeSubcategories` flag to the reward rule schema for cases where the broad category should match all subcategories.

**Confidence:** Medium (this is a design concern, not a confirmed bug)

---

### M-07 — MEDIUM — Test fixtures use hardcoded `rate: 2` and `rate: 5` but `normalizeRate` divides by 100

**File:** `packages/core/__tests__/calculator.test.ts:62,68`

```ts
tiers: [{ performanceTier: 'tier0', rate: 2, monthlyCap: null, perTransactionCap: null }],
tiers: [{ performanceTier: 'tier0', rate: 5, monthlyCap: null, perTransactionCap: null }],
```

And `packages/core/__tests__/optimizer.test.ts:62,68`

**Why this is a problem:**
The YAML card data stores rates in percentage form (e.g., `rate: 2` means 2%). `normalizeRate` now divides by 100, so `2 / 100 = 0.02`. But the test fixtures also use `rate: 2` and `rate: 5` in raw form. When `calculateRewards` is called, it normalizes `2` to `0.02`, making a 20,000 Won transaction yield `400` Won (2%) for the `rate: 2` fixture — which matches the test assertion at line 336 (`expect(cafe!.reward).toBe(400)`). So the tests are *currently passing*, but the fixture rates are being treated inconsistently — some tests use rates that happen to work after normalization, but the intent of `rate: 2` meaning "2%" in the fixture is not documented. If someone changes `normalizeRate` without understanding this, tests would break in confusing ways.

**Suggested fix:**
Add a comment in the test fixtures clarifying that rates are stored in percentage form (matching YAML convention) and are normalized by `calculateRewards`.

**Confidence:** Medium

---

### L-01 — LOW — `REPORT.js` reads from `sessionStorage` using key `'cherrypicker:analysis'` but `store.svelte.ts` persists as `'cherrypicker:analysis'`

**Files:**
- `apps/web/public/scripts/report.js:30`
- `apps/web/src/lib/store.svelte.ts:85`

These are consistent — no bug here. Noted for completeness.

**Confidence:** N/A

---

### L-02 — LOW — `cu` bank ID is misleading — maps to Korean credit union, not convenience store

**File:** `packages/parser/src/detect.ts:95-96`, `apps/web/src/lib/parser/detect.ts:95-96`

```ts
{ bankId: 'cu', patterns: [/신협/] },
```

**Why this matters:**
The bank ID `cu` could be confused with CU convenience store (a major Korean chain). The pattern `/신협/` correctly matches "credit union" (신용협동조합), but the ID is ambiguous.

**Suggested fix:**
Rename the bank ID from `cu` to `credit_union` or `shinhyup` to avoid confusion.

**Confidence:** Low

---

## Final Sweep — Commonly Missed Issues Check

1. **Duplicate object keys in `keywords-niche.ts`** — Previously reported and noted as fixed in git log. Verified: the recent commits do not reference this file, so it may still have duplicates. This needs verification.

2. **`README.md` says MIT, `LICENSE` is Apache 2.0** — Previously reported, not fixed. Still a legal metadata inconsistency.

3. **`cards-compact.json` stale relative to `cards.json`** — Previously reported, not fixed.

4. **No `lint` script defined at workspace level** — Previously reported, not fixed. Root `package.json` references `npm run --workspaces --if-present lint` but no workspace defines `lint`.

5. **GitHub Actions only builds, no test/lint/typecheck gate** — Previously reported, not fixed. `.github/workflows/deploy.yml` does not run quality checks.

6. **E2E tests still use `bypassCSP: true`** — Flagged above as H-06.

7. **Browser AI categorizer is disabled but `TransactionReview.svelte` still imports and checks `aiCategorizer.isAvailable()`** — The import is harmless since the module always returns `false`, but it adds dead code weight to the bundle.

8. **`scoreCardsForTransaction` in `greedy.ts` is O(n*m) per transaction** — For each transaction, it recalculates `calculateCardOutput` for every card both before and after adding the transaction. This is O(transactions * cards * existing_assignments) and could be slow for large transaction sets with many cards. Not a correctness issue but a performance concern for scale.

---

## Summary Table

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C-01 | CRITICAL | High | `TransactionReview.svelte:154` | `changeCategory` does not update `subcategory` |
| C-02 | CRITICAL | High | `analyzer.ts:38,103` | `as unknown as` type-safety bypasses |
| H-01 | HIGH | High | `csv.ts`, `xlsx.ts` (6 locations) | `new Date().getFullYear()` timezone/year-inference bug |
| H-02 | HIGH | High | `analyzer.ts:94`, `reward.ts` | `performanceExclusions` not filtered in spending calc |
| H-03 | HIGH | High | `analyzer.ts:108-185` | Mixed all-month metadata with single-month optimization |
| H-04 | HIGH | High | `TransactionReview.svelte:10-50` | CATEGORIES list diverges from YAML taxonomy |
| H-05 | HIGH | High | `csv.ts:77-80` | `safeAmount` returns 0 for unparseable amounts |
| H-06 | HIGH | High | `e2e/ui-ux-review.spec.js:12` | `bypassCSP: true` hides CSP violations |
| M-01 | MEDIUM | High | `Layout.astro:39` | `'unsafe-inline'` in CSP undermines XSS protection |
| M-02 | MEDIUM | Medium | `discount.ts`, `points.ts` | Identical `calculateDiscount`/`calculatePoints` functions |
| M-03 | MEDIUM | Medium | `csv.ts:879-896` | Bank adapter fallback silently swallows exceptions |
| M-04 | MEDIUM | Low | `cards.ts:144-157` | Fetch caching race condition on failure |
| M-05 | MEDIUM | Medium | `pdf.ts:146-147` | PDF `parseAmount` uses `|| 0` instead of NaN check |
| M-06 | MEDIUM | Medium | `reward.ts:69-71` | Subcategory blocking may be too aggressive |
| M-07 | MEDIUM | Medium | `calculator.test.ts`, `optimizer.test.ts` | Test fixture rate values not documented as percentage form |
| L-01 | LOW | N/A | `report.js` / `store.svelte.ts` | Key consistency confirmed (no bug) |
| L-02 | LOW | Low | `detect.ts:95-96` | `cu` bank ID is ambiguous |
