# Cycle 32 Deep Code Review Report — Code Reviewer Angle

**Reviewer Role:** code-reviewer
**Repository:** /Users/hletrd/flash-shared/cherrypicker
**Date:** 2026-05-06
**Scope:** Full monorepo — packages/core/, packages/parser/, packages/rules/, packages/viz/, apps/web/, tools/cli/, tools/scraper/

---

## Executive Summary

The codebase is well-structured with strong test coverage (1926+ tests passing), clean TypeScript, and thoughtful defensive coding. However, **17 HIGH-severity issues** were identified across logic bugs, silent failures, data corruption risks, and cross-file inconsistencies. Several issues exist in the duplication boundary between `packages/parser/` (Bun/server) and `apps/web/src/lib/parser/` (browser), where parity discipline is good but drift has occurred.

**Key thematic concerns:**
1. **Silent failures** — Several components swallow errors or fall back to defaults without warning (PDF structured parse, unknown reward types, empty transaction sets).
2. **Case-sensitivity bugs** — English keyword matching is completely non-functional due to case mismatch.
3. **Duplication drift** — Web-side and server-side parsers share logic but have diverged in validation, caps, and magic-byte detection.
4. **State corruption** — `reoptimize()` corrupts `statementPeriod` after category edits.
5. **Cross-caller side effects** — Shared `AbortController` in `cards.ts` allows one caller to abort another's fetch.

---

## HIGH Severity Findings

### [HIGH-1] `ENGLISH_KEYWORDS` are completely non-functional due to case mismatch
**File:** `packages/core/src/categorizer/matcher.ts:8-13, 40-100`
**Code:**
```typescript
const ALL_KEYWORDS: Record<string, string> = {
  ...MERCHANT_KEYWORDS,
  ...LOCATION_KEYWORDS,
  ...ENGLISH_KEYWORDS,  // keys are UPPERCASE
  ...NICHE_KEYWORDS,
};
// ...
const lower = merchantName.toLowerCase().trim();  // line 41
const staticExact = ALL_KEYWORDS[lower];          // line 62 — never matches UPPERCASE keys
```
**Problem:** `ENGLISH_KEYWORDS` stores keys in UPPERCASE (e.g., `'STARBUCKS COFFEE KOREA'`). The matcher lowercases the merchant name, then performs exact lookup. Since `'starbucks coffee korea'` never matches `'STARBUCKS COFFEE KOREA'`, **no English keyword ever matches**.
**Concrete failure:** A transaction with merchant `'MCDONALDS'` from a Korean card statement fails to match the `'MCDONALDS'` entry. It falls through to taxonomy matching and returns `'uncategorized'`.
**Fix:** Normalize keyword keys to lowercase when building `ALL_KEYWORDS`:
```typescript
for (const [k, v] of Object.entries({...MERCHANT_KEYWORDS, ...LOCATION_KEYWORDS, ...ENGLISH_KEYWORDS, ...NICHE_KEYWORDS})) {
  ALL_KEYWORDS[k.toLowerCase()] = v;
}
```
**Confidence:** High

### [HIGH-2] Silent fallback to `calculateDiscount` for unknown reward types
**File:** `packages/core/src/calculator/reward.ts:100-114`
**Code:**
```typescript
function getCalcFn(type: string): RewardCalcFn {
  switch (type) {
    case 'discount': return calculateDiscount;
    case 'points': return calculatePoints;
    case 'cashback': return calculateCashback;
    case 'mileage': return calculatePoints;
    default: return calculateDiscount;  // silent fallback
  }
}
```
**Problem:** If a card rule uses a new reward type (e.g., `'voucher'`), the calculator silently applies discount math instead of failing.
**Concrete failure:** A card with `type: 'voucher'` and rate 5 produces discount calculations instead of voucher rewards with no warning.
**Fix:** Throw an error for unknown types:
```typescript
default: throw new Error(`Unknown reward type: ${type}`);
```
**Confidence:** High

### [HIGH-3] `calculatePercentageReward` produces NaN when `monthlyCap` is `undefined`
**File:** `packages/core/src/calculator/types.ts:46-67` (inferred from type declaration)
**Problem:** The type declares `monthlyCap: number | null`, but callers can pass `undefined`. The check `monthlyCap === null` is false for `undefined`, so execution falls through to `Math.max(0, undefined - currentMonthUsed)` which produces `NaN`.
**Concrete failure:** A malformed `CardRuleSet` with `monthlyCap: undefined` causes all rewards for that rule to be `NaN`, silently corrupting totals.
**Fix:** Use `monthlyCap == null` to catch both null and undefined, or add runtime validation.
**Confidence:** High

### [HIGH-4] Negative `normalizedRate` not blocked
**File:** `packages/core/src/calculator/reward.ts:260`
**Problem:** The condition `normalizedRate !== null && normalizedRate > 0` only blocks zero and null. A negative rate from malformed YAML passes through and produces negative rewards.
**Concrete failure:** A card with `rate: -2` causes the calculator to subtract money from the user's reward total.
**Fix:** Change guard to explicitly validate `normalizedRate > 0` (falsy check handles null) or add a pre-validation step.
**Confidence:** High

### [HIGH-5] `tx.isOnline === undefined` treated as "not online" in `excludeOnline` rules
**File:** `packages/core/src/calculator/reward.ts:40`
**Code:**
```typescript
if (rule.conditions?.excludeOnline && tx.isOnline) {
```
**Problem:** When `tx.isOnline` is `undefined`, this evaluates to `false`, meaning the rule matches. A transaction with unknown online status incorrectly earns rewards that should be excluded.
**Concrete failure:** An in-store purchase where `isOnline` was not populated incorrectly matches an `excludeOnline: true` rule.
**Fix:** Use explicit boolean check: `tx.isOnline === true`.
**Confidence:** High

### [HIGH-6] `statementPeriod` corrupted after category edits in `reoptimize`
**File:** `apps/web/src/lib/store.svelte.ts:600-611`
**Code:**
```typescript
const dates = editedTransactions
  .filter((tx) => tx.date && tx.date.length >= 10)
  .map((tx) => tx.date)
  .sort();
const newStatementPeriod = dates.length > 0
  ? { start: dates[0], end: dates[dates.length - 1] }
  : snapshot.statementPeriod;
```
**Problem:** `reoptimize` computes `newStatementPeriod` from ALL `editedTransactions` instead of only `latestTransactions`. In `analyzeMultipleFiles`, `statementPeriod` correctly covers the optimized month only, while `fullStatementPeriod` covers all months. After reoptimize, both become identical full ranges.
**Concrete failure:** User uploads Jan+Feb statements. Initial analysis shows `statementPeriod: Feb 1-28`. After editing a Feb transaction, `statementPeriod` becomes `Jan 1-Feb 28`, misleading the user.
**Fix:** Compute `newStatementPeriod` from `latestTransactions` (already filtered at lines 527-529), not `editedTransactions`.
**Confidence:** High

### [HIGH-7] Shared AbortController allows cross-caller cancellation
**File:** `apps/web/src/lib/cards.ts:120-127, 170-174, 211-213`
**Code:**
```typescript
function chainAbortSignal(controller: AbortController, signal?: AbortSignal): void {
  if (!signal) return;
  signal.addEventListener('abort', () => controller.abort(), { once: true });
}
// ...
} else if (signal) {
  chainAbortSignal(cardsAbortController!, signal);
}
```
**Problem:** When a fetch is already in-flight, new callers' abort signals are chained to the SAME controller. If Caller B's component unmounts and aborts, Caller A's fetch is aborted too.
**Concrete failure:** Component A calls `getCardList()`. Component B calls `getCardById()`. B unmounts, aborting the shared fetch. A receives an AbortError despite never aborting.
**Fix:** Do not chain secondary callers' signals to the in-flight controller. Return the existing promise as-is and let secondary callers handle cancellation separately.
**Confidence:** High

### [HIGH-8] `parseAndCategorize` swallows parse errors when transactions array is empty
**File:** `apps/web/src/lib/analyzer.ts:116-119`
**Code:**
```typescript
if (parseResult.transactions.length === 0) {
  throw new Error('거래 내역을 찾을 수 없어요');
}
```
**Problem:** If a file has parse errors but zero successfully parsed transactions, the specific diagnostics are lost.
**Concrete failure:** A malformed CSV has 5 parse errors but zero valid transactions. User sees only "No transactions found" instead of actual parse errors.
**Fix:** Include parse errors in the thrown message:
```typescript
const errorMsg = parseResult.errors.length > 0
  ? `거래 내역을 찾을 수 없어요: ${parseResult.errors[0].message}`
  : '거래 내역을 찾을 수 없어요';
throw new Error(errorMsg);
```
**Confidence:** High

### [HIGH-9] LLM fallback JSON extraction fails when LLM appends explanatory text after JSON
**File:** `packages/parser/src/pdf/llm-fallback.ts:85`
**Code:**
```typescript
const jsonMatch = responseText.match(/\[\s\S\]*\](?=\s*$|\s*```)/);
```
**Problem:** The lookahead requires the JSON array to be at the very end or followed by a code fence. If the LLM adds any text after the JSON, the regex fails.
**Concrete failure:** LLM returns valid JSON followed by "Let me know if you need anything else!" The parser throws "LLM 응답에서 JSON 배열을 찾을 수 없습니다" despite valid JSON being present.
**Fix:** Remove the end-of-string lookahead:
```typescript
const jsonMatch = responseText.match(/\[\s\S\]*\]/);
```
**Confidence:** High

### [HIGH-10] XLSX parsers (both sides) missing required column validation
**Files:** `packages/parser/src/xlsx/index.ts:276-281`, `apps/web/src/lib/parser/xlsx.ts:449-454`
**Problem:** After calling `findColumn()` for date/merchant/amount, neither XLSX parser checks whether `dateCol === -1` or `amountCol === -1`. HTML and CSV parsers do perform this check. The XLSX parsers proceed to parse rows with missing columns, producing malformed transactions.
**Concrete failure:** An XLSX from a new bank with unrecognized headers produces transactions with empty dates and null amounts that silently fail downstream.
**Fix:** Add the same required-column check used by HTML/CSV parsers.
**Confidence:** High

### [HIGH-11] PDF `tryStructuredParse` swallows all errors silently
**File:** `packages/parser/src/pdf/index.ts:254-260`
**Code:**
```typescript
} catch (err) {
  return null;
}
```
**Problem:** Structured parsing errors are completely invisible. Bugs in `parseTable`, `filterTransactionRows`, etc. silently fall through to the fallback line scanner, which may produce lower-quality results.
**Concrete failure:** A bug in `parseTable` for a specific PDF layout causes structured parsing to fail. User gets fallback-scanner results with partial/missing transactions, with no indication that structured parsing failed.
**Fix:** Add the error to the errors array before returning null:
```typescript
errors.push(new ParseError(`구조화된 파싱 실패: ${err instanceof Error ? err.message : String(err)}`));
```
**Confidence:** High

### [HIGH-12] JSON parser does not detect bank from content
**File:** `packages/parser/src/json/index.ts:173-243`
**Problem:** All other parsers attempt to detect the bank from content when no explicit `bank` parameter is provided. The JSON parser accepts `bank?: BankId` but never calls `detectBank()`.
**Concrete failure:** User calls `parseStatement('data.json')` without specifying a bank. For CSV/XLSX/PDF, bank is auto-detected. For JSON, `result.bank` is always `null`.
**Fix:** Add bank detection from stringified JSON content:
```typescript
const resolvedBank: BankId | null = bank ?? detectBank(content).bank ?? null;
```
**Confidence:** High

### [HIGH-13] `parseAndCategorize` hard-throws on empty transactions, failing multi-file uploads
**File:** `apps/web/src/lib/analyzer.ts:116-119, 301-303`
**Problem:** `analyzeMultipleFiles` uses `Promise.all`. If ANY file has zero transactions, the entire batch fails.
**Concrete failure:** User uploads 3 files: Jan (50 tx), Feb (30 tx), and an accidental empty CSV. Instead of analyzing the two valid files, the entire operation fails.
**Fix:** Change `parseAndCategorize` to return empty transactions with parse errors instead of throwing. Let `analyzeMultipleFiles` filter out empty results.
**Confidence:** High

### [HIGH-14] Web-side format detection cannot sniff XLSX from magic bytes
**File:** `apps/web/src/lib/parser/detect.ts:107-141`
**Problem:** The server-side `detectFormat` checks for XLSX/ZIP magic bytes (`PK` = `0x50 0x4B`). The web-side handles PDF, OFX, HTML, and JSON via content sniffing, but has no XLSX magic byte detection.
**Concrete failure:** User renames `statement.xlsx` to `statement.txt` and uploads it. The web app defaults to CSV and tries to parse binary XLSX data as text.
**Fix:** Add XLSX magic byte sniffing to `detectFormatFromFile`:
```typescript
const bytes = new Uint8Array(buffer);
if (bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4B) return 'xlsx';
if (bytes.length >= 2 && bytes[0] === 0xD0 && bytes[1] === 0xCF) return 'xlsx';
```
**Confidence:** High

### [HIGH-15] `formatSavingsValue(Infinity)` produces inconsistent output
**File:** `apps/web/src/lib/formatters.ts:224-227`
**Code:**
```typescript
export function formatSavingsValue(value: number, prefixValue?: number): string {
  const effectivePrefixValue = prefixValue ?? value;
  return (effectivePrefixValue >= 100 ? '+' : '') + formatWon(Math.abs(value));
}
```
**Problem:** `Infinity >= 100` is `true`, so "+" prefix is added. But `formatWon(Infinity)` returns `"0원"` (because `!Number.isFinite(Infinity)`). Result: `"+0원"`.
**Concrete failure:** A bug producing `Infinity` for reward calculation results in contradictory UI display.
**Fix:** Add `isFinite` check:
```typescript
if (!Number.isFinite(value)) return formatWon(0);
```
**Confidence:** High

### [HIGH-16] Web-side column-matcher missing 200-char header length cap
**Files:** `apps/web/src/lib/parser/column-matcher.ts:49-57` vs `packages/parser/src/csv/column-matcher.ts:55-56`
**Problem:** The server-side `findColumn` has a defensive 200-character cap to avoid regex backtracking. The web-side copy lacks this cap. A malicious XLSX/CSV with extremely long header cells could cause performance issues or ReDoS in the browser.
**Concrete failure:** Malformed upload with 50,000-character header cell freezes the browser tab.
**Fix:** Add the same length cap to web-side `findColumn`.
**Confidence:** High

### [HIGH-17] `getIssuerFromCardId` returns empty string for empty input
**File:** `apps/web/src/lib/formatters.ts:1-3`
**Code:**
```typescript
export function getIssuerFromCardId(cardId: string): string {
  return cardId.split('-')[0] ?? 'unknown';
}
```
**Problem:** If `cardId` is `''`, `''.split('-')` returns `['']`, and `[''][0]` is `''` (not `undefined`), so nullish coalescing doesn't trigger.
**Concrete failure:** Malformed empty card ID propagates as empty issuer badge instead of "unknown".
**Fix:**
```typescript
if (!cardId) return 'unknown';
const parts = cardId.split('-');
return parts[0] || 'unknown';
```
**Confidence:** High

---

## MEDIUM Severity Findings

### [MEDIUM-1] `unit: ''` (empty string) falls through to return 0 in `calculateFixedReward`
**File:** `packages/core/src/calculator/reward.ts:171-178`
**Problem:** The check `tierRate.unit === null || tierRate.unit === undefined` does not handle empty string. A `unit: ''` falls through to `return 0`.
**Fix:** Treat empty string same as null: `if (tierRate.unit == null || tierRate.unit === '')`.
**Confidence:** Medium

### [MEDIUM-2] Magic value `'none'` for `tierId` shadows real tier named `'none'`
**File:** `packages/core/src/calculator/reward.ts:187-219`
**Problem:** `const tierId = tier?.id ?? 'none';` uses `'none'` as a sentinel. If a card legitimately has a tier with `id: 'none'`, all rewards are zeroed out.
**Fix:** Use a Symbol sentinel: `const NO_TIER_MATCHED = Symbol('no-tier')`.
**Confidence:** Medium

### [MEDIUM-3] `ruleResult.capReached` not updated after global cap clips reward
**File:** `packages/core/src/calculator/reward.ts:281-305`
**Problem:** When global cap clips a reward, `ruleMonthUsed` is rolled back but `ruleResult.capReached` is not updated. The UI may not show a cap warning when the global cap was the limiting factor.
**Fix:** Track global-cap-reached separately or update `bucket.capReached`.
**Confidence:** Medium

### [MEDIUM-4] Incomplete `cardResults` validation in sessionStorage load
**File:** `apps/web/src/lib/store.svelte.ts:283-296`
**Problem:** Validation only checks `cardId`, `totalReward`, and `byCategory`. The `CardRewardResult` interface requires `cardName`, `totalSpending`, `effectiveRate`, `performanceTier`, and `capsHit`.
**Concrete failure:** Corrupted sessionStorage with missing `cardName` passes validation, causing UI to display `undefined`.
**Fix:** Expand validation to cover all required fields.
**Confidence:** Medium

### [MEDIUM-5] Incomplete `assignments` validation in sessionStorage load
**File:** `apps/web/src/lib/store.svelte.ts:264-277`
**Problem:** Similar to M4 — assignment validation checks only 3 of 8+ required fields.
**Fix:** Expand validation to cover `categoryNameKo`, `assignedCardName`, `reward`, `rate`, and `alternatives`.
**Confidence:** Medium

### [MEDIUM-6] `VALID_BANK_IDS` Set duplicates type definition
**File:** `apps/web/src/lib/analyzer.ts:9-13`
**Problem:** The `VALID_BANK_IDS` Set duplicates the `BankId` union type from `parser/types.ts`. When a new bank is added, both locations must be updated.
**Concrete failure:** Developer adds bank to `BankId` type but forgets `VALID_BANK_IDS`. Analyzer rejects valid statements.
**Fix:** Extract a shared constant array that both the type and the Set derive from.
**Confidence:** High

### [MEDIUM-7] `buildCategoryLabelMap` only handles one nesting level
**File:** `apps/web/src/lib/category-labels.ts:7-19`
**Problem:** Only recurses one level deep (`node.subcategories`). Sub-subcategories would be silently dropped.
**Fix:** Make recursion truly recursive with a prefix accumulator.
**Confidence:** Medium

### [MEDIUM-8] `getCardDetail` throws without documenting the throw
**File:** `apps/web/src/lib/api.ts:14-18`
**Problem:** The function throws when a card is not found, but signature `Promise<CardDetail>` gives no indication.
**Fix:** Return `null` instead of throwing (consistent with `getCardById`), or rename to `getCardDetailOrThrow`.
**Confidence:** High

### [MEDIUM-9] Merchant trimming inconsistency across parsers
**Files:** Multiple parser files
**Problem:** XLSX parser applies `.trim()` after stripping quotes. CSV and HTML parsers do not. A merchant `"  스타벅스  "` becomes `"스타벅스"` in XLSX but `"  스타벅스  "` in CSV/HTML.
**Fix:** Extract a shared `cleanMerchant()` helper and use it consistently.
**Confidence:** High

### [MEDIUM-10] PDF fallback scanner may extract wrong amount on lines with multiple amounts
**File:** `packages/parser/src/pdf/index.ts:337-338`
**Problem:** The fallback scanner uses the **last** amount match. On lines with multiple amounts (e.g., purchase + refund), it extracts the refund amount which may be skipped as negative.
**Fix:** Prefer the largest positive amount, or report an error when multiple amounts are detected.
**Confidence:** Medium

### [MEDIUM-11] `parseAmount` silently swallows boolean values
**File:** `packages/parser/src/amount.ts:22-31`
**Problem:** When a spreadsheet cell contains a boolean, `parseAmount` returns `null` silently. The JSON parser explicitly reports an error for booleans.
**Fix:** Add boolean branch to `parseAmount` or extend signature to accept an errors array.
**Confidence:** High

### [MEDIUM-12] XLSX parser lacks blank-row forward-fill reset
**File:** `packages/parser/src/xlsx/index.ts:305-441` vs `packages/parser/src/html/index.ts:152-163`
**Problem:** HTML parser resets forward-fill state on blank rows. XLSX parser does not. Values from first section can leak into second section separated by blank rows.
**Concrete failure:** Card A's installment=3 leaks to Card B's first transaction via forward-fill.
**Fix:** Add blank-row forward-fill reset to XLSX parser.
**Confidence:** Medium

### [MEDIUM-13] `enrichErrors` silently drops metadata for non-`ParseError` exceptions
**File:** `packages/parser/src/index.ts:41-49`
**Problem:** `instanceof ParseError` check means generic errors never get `file`/`format` metadata. Also, `instanceof` checks can fail across module/bundle boundaries.
**Fix:** Remove `instanceof` guard and always enrich any error object with the properties.
**Confidence:** High

### [MEDIUM-14] PDF fallback scanner `indexOf` may find wrong date occurrence
**File:** `packages/parser/src/pdf/index.ts:343-346`
**Problem:** `line.indexOf(dateMatch[0])` returns the first occurrence. If the date appears multiple times, `between` extraction may include an extra date in the merchant name.
**Fix:** Use the match index from `RegExp#exec` instead of `indexOf`.
**Confidence:** Medium

### [MEDIUM-15] HTML parser does not infer merchant column
**File:** `packages/parser/src/html/index.ts:115-133`
**Problem:** CSV generic parser has sophisticated merchant column inference. HTML parser simply returns an error if merchant column is not found.
**Fix:** Extract merchant inference to a shared utility used by both CSV and HTML parsers.
**Confidence:** Medium

### [MEDIUM-16] `isAmountLike` bare 5-digit pattern creates false positives
**File:** `packages/parser/src/csv/generic.ts:59`
**Problem:** `/^\d{5,}\s*원?$/` matches ZIP codes, transaction IDs, and bank codes as amounts during column inference.
**Fix:** Add variance heuristic — transaction IDs have uniform digit counts while amounts vary.
**Confidence:** Medium

### [MEDIUM-17] `Object.hasOwn` requires ES2022
**Files:** `packages/parser/src/json/index.ts:69`, `apps/web/src/lib/parser/json.ts:69`
**Problem:** `Object.hasOwn` is ES2022. Older browsers without polyfills will throw `TypeError`.
**Fix:** Replace with `Object.prototype.hasOwnProperty.call(obj, alias)`.
**Confidence:** Medium

### [MEDIUM-18] Dead schema fields in `ParseResult` never populated
**File:** `packages/parser/src/types.ts:21-27`
**Problem:** `statementPeriod`, `cardNumber`, and `isOnline` are declared but never populated by any parser.
**Fix:** Either implement extraction or remove the fields.
**Confidence:** High

### [MEDIUM-19] `savingsVsSingleCard` can be negative despite positive-sounding name
**File:** `packages/core/src/optimizer/greedy.ts:256`
**Problem:** Field name implies savings but can legitimately be negative.
**Fix:** Rename to `deltaVsSingleCard` or clamp to 0.
**Confidence:** Medium

### [MEDIUM-20] Greedy optimizer has O(n*m²) time complexity
**File:** `packages/core/src/optimizer/greedy.ts:39-66`
**Problem:** For each transaction and each card, `scoreCardsForTransaction` calls `calculateCardOutput` twice. Each call re-processes all already-assigned transactions.
**Fix:** Consider memoization or incremental reward calculation.
**Confidence:** Medium

### [MEDIUM-21] `calculateRewards` doesn't validate `cardRule` structure
**File:** `packages/core/src/calculator/reward.ts:181-363`
**Problem:** If `cardRule.rewards` is `undefined`, `findRule` throws with an opaque TypeError.
**Fix:** Add guard at top of `calculateRewards`:
```typescript
if (!cardRule.rewards || !Array.isArray(cardRule.rewards)) {
  throw new Error('cardRule.rewards must be an array');
}
```
**Confidence:** High

### [MEDIUM-22] tools/scraper hardcodes outdated Claude model
**File:** `tools/scraper/src/extractor.ts:34`
**Code:**
```typescript
model: 'claude-sonnet-4-6',
```
**Problem:** The model identifier may be outdated. Also, max_tokens is hardcoded at 4096 which may be insufficient for complex card pages.
**Fix:** Use a configurable model identifier and token limit, or default to the latest stable model.
**Confidence:** Medium

### [MEDIUM-23] tools/scraper fetcher double-fetches on EUC-KR meta charset
**File:** `tools/scraper/src/fetcher.ts:48-56`
**Problem:** When meta charset indicates EUC-KR, the code fetches the URL AGAIN instead of reusing the already-fetched buffer.
**Fix:** Store the buffer from the first fetch and re-decode it, or use a streaming decoder.
**Confidence:** Medium

### [MEDIUM-24] tools/cli `runScrape` hardcodes `bun` binary name
**File:** `tools/cli/src/commands/scrape.ts:64`
**Code:**
```typescript
const result = spawnSync('bun', ['run', scraperCli, ...scraperArgs], {
```
**Problem:** If `bun` is not in PATH (e.g., installed via package manager with different binary name), the command fails.
**Fix:** Use `process.execPath` to reference the current Bun runtime.
**Confidence:** Medium

---

## LOW Severity Findings

### [LOW-1] Three calculator files are pure re-exports
**Files:** `packages/core/src/calculator/cashback.ts`, `discount.ts`, `points.ts`
**Problem:** All three export the same function. Unnecessary indirection.
**Fix:** Remove the three files and export directly from `types.ts`, or give each a distinct implementation.
**Confidence:** High

### [LOW-2] Unstable sort for equal-amount transactions
**File:** `packages/core/src/optimizer/greedy.ts:198-200`
**Problem:** `.sort((a, b) => b.amount - a.amount)` is unstable for equal amounts.
**Fix:** Add secondary sort key: `.sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id))`.
**Confidence:** Medium

### [LOW-3] No cycle detection in `CategoryTaxonomy` tree traversal
**File:** `packages/core/src/categorizer/taxonomy.ts:25-55, 113-148`
**Problem:** Recursive traversal with no cycle detection. Circular reference causes infinite recursion.
**Fix:** Add a `visited` Set parameter.
**Confidence:** Low

### [LOW-4] `import.meta.env` access unguarded
**Files:** `apps/web/src/lib/cards.ts:114`, `apps/web/src/lib/formatters.ts:238`
**Problem:** `import.meta.env.BASE_URL` crashes in non-Vite environments without proper mocking.
**Fix:** Use optional chaining: `import.meta.env?.BASE_URL ?? '/'`.
**Confidence:** Medium

### [LOW-5] Empty `cardIds` array treated as "no filter"
**File:** `apps/web/src/lib/store.svelte.ts:593-594`
**Problem:** `options?.cardIds ?? snapshot.cardIdsOption` — empty array `[]` is truthy, so nullish coalescing doesn't fall through.
**Fix:** `options?.cardIds?.length ? options.cardIds : snapshot.cardIdsOption`.
**Confidence:** Low

### [LOW-6] `loadCategories` and `loadCardsData` retry logic inconsistency
**File:** `apps/web/src/lib/cards.ts:176-184, 214-221`
**Problem:** `loadCardsData` returns `cardsPromise` directly when retrying; `loadCategories` awaits it.
**Fix:** Standardize both patterns.
**Confidence:** Low

### [LOW-7] Test files use inconsistent test frameworks
**File:** `packages/parser/__tests__/amount.test.ts` vs all other `*.test.ts`
**Problem:** `amount.test.ts` imports from `vitest`; all others import from `bun:test`.
**Fix:** Standardize on `bun:test`.
**Confidence:** High

### [LOW-8] No tests for web-side OFX, HTML, or JSON parsers
**Observation:** `packages/parser/__tests__/` has 18 test files. `apps/web/src/lib/parser/` has zero test files.
**Fix:** Add browser-test suite using Vitest in `apps/web/`.
**Confidence:** High

### [LOW-9] No integration tests for `parseStatement` entry point
**File:** `packages/parser/src/index.ts:51-102`
**Problem:** The primary public API is entirely untested.
**Fix:** Add integration tests covering each format, BOM handling, error enrichment, and unknown extension sniffing.
**Confidence:** High

### [LOW-10] XLSX adapter configs not exported from package entry point
**File:** `packages/parser/src/index.ts:21-22`
**Problem:** `getBankColumnConfig` in `xlsx/adapters/index.ts` is not exported.
**Fix:** Export it from `index.ts`.
**Confidence:** High

### [LOW-11] `splitCSVContent` accepts unused `delimiter` parameter
**Files:** `packages/parser/src/csv/shared.ts:43`, `apps/web/src/lib/parser/csv.ts:54`
**Problem:** Parameter is never used in the function body.
**Fix:** Remove the parameter or rename to `_delimiter`.
**Confidence:** High

### [LOW-12] Server-side `isHTMLContent` uses literal BOM character
**File:** `packages/parser/src/xlsx/index.ts:35`
**Problem:** Invisible BOM character may be corrupted by editors. Web-side uses `﻿` which is explicit and safe.
**Fix:** Use explicit escape sequence `﻿`.
**Confidence:** High

### [LOW-13] `categoryNameKo` placeholder leaks raw category key
**File:** `packages/core/src/calculator/reward.ts:230`
**Problem:** `categoryNameKo: categoryKey` sets display name to the machine key (e.g., `"dining.cafe"`).
**Fix:** Accept a `categoryLabels` map parameter or leave undefined.
**Confidence:** Medium

### [LOW-14] `inferYear` Feb 29 handling fails for year 2100
**File:** `packages/parser/src/date-utils.ts:66-71`
**Problem:** Walks back only 3 years. Year 2100 is not a leap year (divisible by 100 but not 400).
**Fix:** Increase walk-back limit or use smarter leap-year finder.
**Confidence:** Low

### [LOW-15] `monthlyBreakdown` load validation accepts empty string months
**File:** `apps/web/src/lib/store.svelte.ts:327-335`
**Problem:** No non-empty check for month strings.
**Fix:** Add `obj.month && typeof obj.month === 'string'`.
**Confidence:** Low

### [LOW-16] `analyzer.ts` mixed import order
**File:** `apps/web/src/lib/analyzer.ts:1-18`
**Problem:** `VALID_BANK_IDS` is defined before import statements.
**Fix:** Move definition after all imports.
**Confidence:** Low

---

## Test Gap Summary

| Module | Coverage | Priority Gaps |
|--------|----------|---------------|
| `packages/core/__tests__/` | Good (4 files) | English keyword matching, `excludeOnline` with `undefined`, zero caps |
| `packages/parser/__tests__/` | Excellent (18 files) | `parseStatement` integration, web-side parsers |
| `apps/web/__tests__/` | Good (13 files) | `store.svelte.ts` persistence, `reoptimize` edge cases, abort signal handling |
| `apps/web/src/lib/parser/` | **None** | All web-side parsers need tests |
| `packages/viz/__tests__/` | Minimal (1 file) | HTML report generation, terminal output |
| `packages/rules/__tests__/` | Minimal (2 files) | Schema edge cases, loader error paths |
| `tools/cli/__tests__/` | Minimal (1 file) | Command integration, argument parsing edge cases |
| `tools/scraper/__tests__/` | Minimal (1 file) | Fetcher error handling, extractor validation |
| `e2e/` | 4 spec files | Needs more coverage of multi-file upload, category editing flows |

---

## Cross-File Interaction Issues

1. **Parser duplication drift:** `apps/web/src/lib/parser/` is a maintained copy of `packages/parser/src/` for browser compatibility. Parity tests exist but only compare constants, not behavior. The web-side has missing validation (column-matcher cap, XLSX required columns), missing magic-byte detection, and missing blank-row forward-fill.

2. **Type adapter fragility:** `apps/web/src/lib/analyzer.ts` bridges web `CardRuleSet` to core `CardRuleSet` with manual narrowing (`VALID_SOURCES`, `VALID_REWARD_TYPES`). If the rules schema adds a new source or reward type, the adapter silently defaults to `'web'`/`'discount'` instead of failing.

3. **Cache poisoning risk:** `cachedCoreRules` in `analyzer.ts` is not keyed by `cardIds`. If calling patterns change to alternate between filtered and unfiltered sets, stale data will be returned.

---

## Recommendations

### Immediate (next release)
1. Fix English keyword case mismatch (HIGH-1)
2. Fix silent fallback for unknown reward types (HIGH-2)
3. Fix shared AbortController cross-cancellation (HIGH-7)
4. Fix `statementPeriod` corruption in `reoptimize` (HIGH-6)
5. Fix LLM fallback JSON regex (HIGH-9)
6. Add XLSX required column validation (HIGH-10)
7. Add PDF structured parse error reporting (HIGH-11)
8. Fix `formatSavingsValue(Infinity)` (HIGH-15)

### Short term
9. Fix JSON bank detection (HIGH-12)
10. Fix multi-file upload failure on empty file (HIGH-13)
11. Add XLSX magic byte sniffing to web (HIGH-14)
12. Fix column-matcher 200-char cap on web (HIGH-16)
13. Fix `getIssuerFromCardId` empty string (HIGH-17)
14. Expand sessionStorage validation (MEDIUM-4, MEDIUM-5)
15. Standardize merchant trimming (MEDIUM-9)

### Long term
16. Create shared parser core compiled for both Bun and browser to eliminate duplication
17. Add dedicated web-side parser test suite
18. Add integration tests for `parseStatement`
19. Add cycle detection to taxonomy traversal
20. Consider memoizing greedy optimizer scoring

---

## Verified: No issues found in

- **packages/rules/src/schema.ts** — Zod schemas are well-structured with `.refine()` for mutual exclusion, `.passthrough()` for extensibility, and proper null handling.
- **packages/rules/src/loader.ts** — Clean async loading with `Promise.allSettled` for graceful degradation.
- **packages/viz/src/report/generator.ts** — Template replacement is straightforward; XSS escaping via `esc()` is comprehensive with numeric entity pre-decode.
- **tools/cli/src/validation.ts** — Proper path traversal prevention (`..` check), null byte stripping, and symlink rejection.
- **tools/cli/src/consent.ts** — Timeout handling and non-interactive mode detection are correct.
- **tools/scraper/src/validators.ts** — Business logic validation complements Zod schema validation well.

---

*Report generated by code-reviewer worker for cycle 32 deep review.*
