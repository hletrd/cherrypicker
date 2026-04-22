# Cherrypicker Multi-Perspective Critic Review

**Date**: 2026-04-22
**Reviewer**: Critic (adversarial quality gate)
**Scope**: Source files only — packages/core, packages/parser, packages/rules, packages/viz, apps/web, tools/cli, tools/scraper
**Mode**: THOROUGH, escalated to ADVERSARIAL after 3+ MAJOR findings discovered

---

## VERDICT: REVISE

**Overall Assessment**: The codebase shows disciplined engineering (good error handling, extensive comments, defensive coding). However, there are significant correctness risks in the categorizer (bank names mis-categorized as spending), a massive and fragile code duplication between server and web parsers, a silent optimizer regression path (ILP stub), and data integrity gaps in YAML rule loading. The most dangerous finding is that bank card merchant names in the keyword map cause systematic mis-categorization of real transactions.

**Pre-commitment Predictions vs Actual Findings**:
1. Parser fragility — CONFIRMED (MAJOR: full parser duplication across server/client)
2. Optimizer correctness gaps — CONFIRMED (MAJOR: ILP is a silent stub; savingsVsSingleCard can be negative)
3. Category matching noise — CONFIRMED (CRITICAL: bank card names as keywords mis-categorize transactions)
4. YAML rule data integrity — CONFIRMED (MAJOR: silent swallow of failed loads)
5. Web app state/hydration — NOT CONFIRMED (well-handled; only MINOR type adapter fragility)

---

## Critical Findings (blocks execution)

### C-01: Bank card names in keyword map cause systematic mis-categorization

**File**: `packages/core/src/categorizer/keywords.ts` (lines 6547-6554)
**Evidence**:
```
'삼성카드': 'utilities',
'현대카드': 'utilities',
'신한카드': 'utilities',
'KB국민카드': 'utilities',
'우리카드': 'utilities',
'하나카드': 'utilities',
'롯데카드': 'utilities',
'BC카드': 'utilities',
```

**Why it matters**: These keywords match with confidence 1.0 (exact match). When a transaction's merchant name contains a bank card name (e.g., "삼성카드" appearing as a merchant for a card payment fee, insurance premium, or annual fee transaction), it gets categorized as `utilities` instead of the correct category. This silently produces wrong reward calculations because the optimizer then assigns the transaction to the best card for `utilities` rather than the correct category.

**Concrete failure scenario**: A user has a "하나카드" insurance premium auto-debit. The transaction merchant says "하나카드". The categorizer matches it as `utilities` (confidence 1.0). The optimizer calculates rewards based on the `utilities` reward rate of whichever card the optimizer assigns, which is almost certainly wrong — the correct category should be `insurance` or `uncategorized`.

**Additional affected entries** (same file):
- Line 5090: `'기업은행': 'utilities'` — "기업은행" as a merchant name is ambiguous (could be a deposit/transfer, not necessarily utilities)
- Line 5091: `'농협은행': 'utilities'` — same issue
- Lines 6520, 6526-6555: Multiple bank payment and transfer entries mapped to `utilities` (e.g., `'농협은행이체'`, `'NH농협은행'`, `'KB국민카드결제'`, `'NH농협카드결제'`)

**Confidence**: HIGH
**Fix**: Remove bank card issuer names and bank payment entries from the merchant keyword map. These should be handled by a separate "financial institution" category or left as `uncategorized` since the optimizer cannot meaningfully assign rewards to bank-fee transactions. At minimum, downgrade these from exact-match keywords (confidence 1.0) to low-confidence signals.

---

### C-02: Overly broad bank detection patterns cause false-positive bank identification

**File**: `packages/parser/src/detect.ts` (lines 71, 91, 95, 99) and `apps/web/src/lib/parser/detect.ts` (lines 73, 93, 97, 101)
**Evidence**:
```
bankId: 'suhyup',
patterns: [/수협/, /Sh수협/, /suhyup/i],

bankId: 'mg',
patterns: [/MG새마을금고/, /새마을금고/, /kfcc/i],

bankId: 'cu',
patterns: [/신협/],

bankId: 'kdb',
patterns: [/KDB산업은행/, /산업은행/, /kdbbank/i],
```

**Why it matters**: The pattern `/수협/` matches ANY occurrence of those characters in the file content, not just in the header. A transaction with merchant "수협중앙회" in the data rows would trigger suhyup detection. The pattern `/산업은행/` could match transaction references to "산업은행" that are not the statement's issuing bank. The `/신협/` pattern is a single-pattern bank with no disambiguation — a merchant named "신협" anywhere in the file triggers cu detection with up to 0.5 confidence (after the single-pattern cap).

While the confidence cap (0.5 for single-pattern banks) mitigates this somewhat, the detection logic in `parseCSV` uses the FIRST match from `detectBank`, not the highest-confidence match after all adapters have been tried. If a multi-pattern bank like kb (`/KB국민카드/`, `/국민카드/`, `/kbcard/i`) also matches, it would win because it scores higher. But if no other bank matches, the false positive becomes the detected bank, and the wrong adapter runs.

**Concrete failure scenario**: A Samsung Card statement contains a transaction at "수협" (Suhyup fisheries cooperative market). The `/수협/` pattern matches in the content, suhyup is detected as the bank (confidence 0.5). The suhyup adapter (which does not exist in the ADAPTERS list) fails to parse the file. The fallback generic parser runs with `bank: 'suhyup'`, which is incorrect and confuses the user.

**Confidence**: HIGH
**Fix**: Restrict detection patterns to header-specific markers. Either:
1. Search only the first N lines (metadata/header region) for bank identification, not the entire file.
2. Use more specific patterns that combine bank name with header keywords (e.g., `/수협.*이용일/` or `/수협.*거래일/`).
3. Add a minimum confidence threshold (e.g., 0.6) below which detection returns null and the generic parser runs without a bank label.

---

## Major Findings (causes significant rework)

### M-01: Full parser code duplication between server and web — divergent behavior

**Files**:
- Server: `packages/parser/src/csv/*.ts` (11 files)
- Web: `apps/web/src/lib/parser/csv.ts` (1 file, ~1030 lines)

**Evidence**: The web CSV parser at `apps/web/src/lib/parser/csv.ts` is an almost complete copy of the server-side parser logic. The comment at line 30-34 of the web parser acknowledges this:
```
// NOTE(C70-04): The helpers below (splitLine, parseAmount, parseInstallments,
// isValidAmount) duplicate logic from packages/parser/src/csv/shared.ts.
// Full dedup requires the D-01 architectural refactor (shared module between
// Bun and browser environments).
```

**Key divergences already present**:
1. **Header scan limit**: Server parsers scan up to 10 lines; web parsers scan up to 30 lines. A statement with >10 metadata rows parses differently on server vs web.
2. **BOM handling**: Web parser strips UTF-8 BOM at entry point (`content.replace(/^﻿/, '')` at line 969); server-side `packages/parser/src/csv/index.ts` does NOT strip BOM.
3. **Date error reporting**: Web parser calls `parseDateToISO(dateRaw, errors, i)` which reports unparseable dates as parse errors; server parsers call `parseDateStringToISO(dateRaw)` without error reporting.
4. **Summary row filtering**: Server-side bank-specific adapters (kb.ts, samsung.ts, etc.) filter `/합계|총계|소계|total|sum/i`; web bank-specific adapters also filter this. But the web generic parser has improved header detection requiring keywords from 2+ categories (lines 157-183), while the server generic parser does not.

**Why it matters**: Any bug fix or new bank format support must be applied in two places. The divergences already present mean the same CSV file can produce different transaction counts and amounts depending on whether it's parsed server-side or client-side. For a financial application, this is a data integrity risk.

**Concrete failure scenario**: A Hyundai Card CSV with 12 metadata rows before the header. Server parser scans only 10 rows, fails to find the header, returns 0 transactions with an error. Web parser scans 30 rows, finds the header, returns all transactions. User sees different results in CLI vs web.

**Confidence**: HIGH
**Fix**: Extract shared parsing logic into a platform-agnostic package that both Bun and browser can import. At minimum, align the header scan limits (use 30 everywhere) and add BOM stripping to the server-side entry point.

---

### M-02: ILP optimizer is a silent stub — users get greedy results without knowing

**File**: `packages/core/src/optimizer/ilp.ts` (lines 43-50)
**Evidence**:
```typescript
export function ilpOptimize(
  constraints: OptimizationConstraints,
  cardRules: CardRuleSet[],
): OptimizationResult {
  // TODO: Replace with actual ILP solver once glpk.js is integrated.
  console.debug('[cherrypicker] ILP optimizer is not yet implemented — falling back to greedy optimizer');
  return greedyOptimize(constraints, cardRules);
}
```

**Why it matters**: The `optimize()` function in `packages/core/src/optimizer/index.ts` accepts `method: 'ilp'` as an option. Callers who specify ILP expect optimal results but silently get greedy results instead. The only indication is a `console.debug` message, which is invisible in production. The ILP formulation in the comments describes a category-level assignment model that is fundamentally different from the greedy transaction-level model, so the "fallback" is not even solving the same problem.

Additionally, `packages/core/src/optimizer/greedy.ts` line 342 computes `savingsVsSingleCard = totalReward - bestSingleCard.totalReward`, which can be **negative** (the optimizer test at `packages/core/__tests__/optimizer.test.ts:296` explicitly tests this). This means the optimizer can recommend a card assignment that is worse than simply using the best single card — and the UI shows this as "additional cost" with no explanation of why the optimizer failed.

**Confidence**: HIGH (for the ILP stub); MEDIUM (for the negative savings UX impact — the UI does handle it)
**Fix**:
1. Either remove the ILP option from the public API until it's implemented, or make it throw an explicit error rather than silently falling back.
2. When `savingsVsSingleCard < 0`, the optimizer should return the best single card assignment instead of a suboptimal multi-card assignment, since the stated goal is optimization.

---

### M-03: CATEGORY_NAMES_KO is a hardcoded duplicate of the YAML taxonomy — drift risk

**File**: `packages/core/src/optimizer/greedy.ts` (lines 11-86)
**Evidence** (line 7-10):
```typescript
// TODO(C64-03): CATEGORY_NAMES_KO can silently drift from the YAML taxonomy in
// packages/rules/data/categories.yaml. When the taxonomy is updated, this map
// must be updated in lockstep. The correct long-term fix is to import labels
// from the rules package at CLI startup instead of maintaining a duplicate here.
```

**Why it matters**: This 76-entry map must be manually kept in sync with the YAML taxonomy. If a category is added or renamed in `categories.yaml` without updating this map, the optimizer falls back to displaying the raw English category ID (e.g., "dining.cafe" instead of the Korean "카페") for any missing entry. The TODO comment acknowledges the risk but it remains unfixed.

The map is used at line 176 and 245 as a fallback when `categoryLabels` is not provided:
```typescript
categoryNameKo: categoryLabels?.get(categoryKey) ?? CATEGORY_NAMES_KO[categoryKey] ?? ...
```

In the web app, `categoryLabels` is always provided (built from the taxonomy at runtime), so the web path is safe. But the CLI path relies on this hardcoded map.

**Confidence**: HIGH
**Fix**: At CLI startup, load the categories YAML and build the labels map from it, same as the web app does. This eliminates the duplicate and the drift risk entirely.

---

### M-04: loadAllCardRules silently swallows failed YAML loads with no count validation

**File**: `packages/rules/src/loader.ts` (lines 32-46)
**Evidence**:
```typescript
export async function loadAllCardRules(baseDir: string): Promise<CardRuleSet[]> {
  const yamlFiles = await collectYamlFiles(baseDir);
  const settled = await Promise.allSettled(
    yamlFiles.map((filePath) => loadCardRule(filePath)),
  );
  const results = [];
  for (const outcome of settled) {
    if (outcome.status === 'fulfilled') {
      results.push(outcome.value);
    } else {
      console.warn(`[rules] Failed to load card rule: ${outcome.reason}`);
    }
  }
  return results;
}
```

**Why it matters**: If a YAML file has a schema violation (wrong type, missing required field), it is silently dropped. The function returns a partial result with no indication of how many rules were expected vs loaded. If a schema change breaks 50% of card rules, the optimizer simply runs with half the cards and produces lower reward estimates — with no user-visible warning.

**Concrete failure scenario**: A schema migration adds a new required field. The Zod validation rejects all 81 YAML files. `loadAllCardRules` returns an empty array. The optimizer produces 0 rewards for everything. The user sees "0원" everywhere with no explanation.

**Confidence**: HIGH
**Fix**: Return a result object that includes the count of loaded vs expected rules, and a list of failures. When the failure rate exceeds a threshold (e.g., >10%), throw an error or return a strongly-typed failure result that callers must handle.

---

### M-05: Server-side parsers lack BOM stripping — Windows-generated files fail silently

**File**: `packages/parser/src/csv/index.ts` (lines 29-91)
**Evidence**: The web-side parser at `apps/web/src/lib/parser/csv.ts` line 969 strips BOM:
```typescript
const cleanContent = content.replace(/^﻿/, '');
```
The server-side `packages/parser/src/csv/index.ts` does NOT strip BOM. This means a Windows-generated CSV file with UTF-8 BOM will fail header detection on the server (because `indexOf('이용일')` won't match `'﻿이용일'`).

**Why it matters**: Korean bank card statement exports from Windows machines commonly include BOM. The web parser handles this correctly; the server (CLI) parser does not. CLI users get "헤더 행을 찾을 수 없습니다" errors on valid files.

**Confidence**: HIGH
**Fix**: Add BOM stripping to `packages/parser/src/csv/index.ts:parseCSV()` at the entry point, matching the web parser's behavior.

---

### M-06: Greedy optimizer's bestSingleCard computation uses all transactions, not just positive amounts

**File**: `packages/core/src/optimizer/greedy.ts` (lines 328-340)
**Evidence**:
```typescript
let bestSingleCard = { cardId: '', cardName: '', totalReward: 0 };
for (const rule of cardRules) {
  const previousMonthSpending = cardPreviousSpending.get(rule.card.id) ?? 0;
  const output = calculateCardOutput(sortedTransactions, previousMonthSpending, rule);

  if (output.totalReward > bestSingleCard.totalReward) {
    bestSingleCard = {
      cardId: rule.card.id,
      cardName: getCardName(rule),
      totalReward: output.totalReward,
    };
  }
}
```

The `sortedTransactions` array at this point contains only positive-amount, finite transactions (filtered at line 284-286). However, `calculateCardOutput` -> `calculateRewards` at line 218 also filters `tx.amount <= 0` and `tx.currency !== 'KRW'`. So the double-filtering is harmless but redundant. The real issue is that `sortedTransactions` was filtered for the optimizer's assignment loop, but `bestSingleCard` also uses it — meaning bestSingleCard sees the same filtered set, which is correct.

Wait — on closer inspection, this is actually fine. The `sortedTransactions` variable already contains only positive finite amounts (line 284-286), and `calculateRewards` applies its own filter redundantly. The computation is correct, just slightly wasteful.

**RETRACTED during self-audit**: This is not actually a finding. The code is correct. The redundant filter in `calculateRewards` is defensive, not a bug.

---

## Minor Findings (suboptimal but functional)

### m-01: `rewardConditionsSchema` uses `.passthrough()` allowing arbitrary extra fields

**File**: `packages/rules/src/schema.ts` line 31
**Evidence**: `}).passthrough();` on the rewardConditionsSchema allows any extra keys. While the `RewardConditions` interface has `[key: string]: unknown` to match, this means typos in YAML fields (e.g., `exludeOnline` instead of `excludeOnline`) are silently accepted instead of being caught as validation errors.

**Confidence**: HIGH
**Fix**: Remove `.passthrough()` or use `.strict()` on the conditions schema. Unknown fields should be rejected to catch YAML authoring errors early.

### m-02: `globalConstraintsSchema` also uses `.passthrough()`

**File**: `packages/rules/src/schema.ts` line 64
Same issue as m-01. The `note` field is already explicitly declared, so passthrough only adds risk of typo-silent-acceptance.

### m-03: `formatWon` normalizes negative zero but not NaN

**File**: `apps/web/src/lib/formatters.ts` lines 5-10
**Evidence**:
```typescript
export function formatWon(amount: number): string {
  if (!Number.isFinite(amount)) return '0원';
  if (amount === 0) amount = 0;
  return amount.toLocaleString('ko-KR') + '원';
}
```
The `Number.isFinite` check correctly catches NaN and Infinity. The negative-zero normalization is present. This is actually well-handled — no finding here.

### m-04: Duplicate `detectBank` and `BANK_SIGNATURES` between server and web

**Files**:
- `packages/parser/src/detect.ts` (lines 10-107)
- `apps/web/src/lib/parser/detect.ts` (lines 8-105)

The `BANK_SIGNATURES` array and `detectBank()` function are duplicated almost identically. The web version adds a comment about tie-breaking behavior (line 122-126). Any new bank must be added in both places.

**Confidence**: HIGH

### m-05: `formatIssuerNameKo` and `getIssuerColor` are hardcoded maps that must match BankId union type

**File**: `apps/web/src/lib/formatters.ts` lines 51-143
The `BankId` type in `packages/parser/src/types.ts` is a string union with 24 entries. The `formatIssuerNameKo` and `getIssuerColor` maps also have 24 entries each. Adding a new bank requires updating three places: the type, the name map, and the color map. No compile-time enforcement links them.

**Confidence**: MEDIUM (no runtime breakage, just maintenance burden)

### m-06: `getCardName` in greedy.ts uses `||` instead of `??`

**File**: `packages/core/src/optimizer/greedy.ts` line 105
```typescript
return rule.card.nameKo || rule.card.name;
```
If `nameKo` is an empty string `""`, the `||` operator falls through to `name`, which is probably not the intent — an explicitly-set empty Korean name would be silently replaced by the English name. `??` would only fall through on `null`/`undefined`. However, the Zod schema requires `nameKo: z.string()` without a min-length check, so an empty string is valid per the schema.

**Confidence**: MEDIUM (depends on whether empty nameKo is a realistic data state)

---

## What's Missing (gaps, unhandled edge cases, unstated assumptions)

1. **No encoding detection or conversion for CSV files**: The parsers assume UTF-8 encoding. Korean bank exports commonly use EUC-KR or CP949 encoding. There is no encoding detection or iconv-style conversion. Non-UTF-8 files will produce garbled text that breaks both header detection and merchant matching.

2. **No transaction deduplication across multiple files**: `analyzeMultipleFiles` in `apps/web/src/lib/analyzer.ts` merges transactions from all uploaded files by simply concatenating them. If a user uploads overlapping statement periods (e.g., January from two different export runs), transactions are duplicated with no dedup key beyond `tx-${fileIndex}-${idx}`.

3. **No validation of date consistency within a parsed file**: The parsers accept any date format without checking whether dates are within a reasonable range or consistent with each other. A corrupted CSV with dates from 1970 or 2099 would pass through without warning.

4. **No rate-limiting or circuit-breaking on the web's fetch for card data**: `loadCardsData` in `apps/web/src/lib/cards.ts` caches a single promise but does not implement retry logic, backoff, or stale-while-revalidate. If the GitHub Pages fetch fails, the user gets an error with no automatic recovery.

5. **No performance tier validation**: The `performanceTiers` array must have entries for every tier ID referenced by `rewardTierRate.performanceTier`, but there is no cross-validation. A typo in a tier ID would cause `findTierRate` to return undefined, silently producing 0 reward for that rule.

6. **Missing `won_per_liter` fuel volume tracking**: `packages/core/src/calculator/reward.ts` line 160-166 explicitly acknowledges that the transaction model doesn't carry fuel volume, so `won_per_liter` rewards are approximated as fixed per-transaction amounts. This is documented but could mislead users who see fuel discounts that don't match their actual per-liter rate.

7. **No test coverage evidence for the web parser**: The server-side parser has tests in `packages/parser/__tests__/`, but there is no corresponding test directory for `apps/web/src/lib/parser/`. The web parser's improved header detection logic (2-category keyword requirement) is untested.

---

## Ambiguity Risks

1. **"Performance tier matching" when multiple tiers have overlapping ranges**: The `selectTier` function in `packages/core/src/calculator/reward.ts` lines 9-22 filters tiers where `previousMonthSpending >= minSpending && (maxSpending === null || previousMonthSpending <= maxSpending)`, then picks the one with highest `minSpending`. If two tiers have the same `minSpending` but different `maxSpending`, the one returned depends on array order — not documented behavior.

2. **"savingsVsSingleCard" semantics**: The field is documented as "vs best single card" but can be negative. When negative, the UI shows "additional cost" — but the optimizer still assigns cards using the greedy algorithm. There is no documented policy on whether a negative savings result should fall back to the single-card assignment.

---

## Multi-Perspective Notes

**Security**:
- No input sanitization on merchant names before substring matching. A maliciously crafted CSV with very long merchant names (megabytes) would cause O(n*m) substring scans in the categorizer, potentially causing a DoS in the web app. The `MERCHANT_KEYWORDS` and `CategoryTaxonomy.keywordMap` scans are linear in keyword count per transaction.
- sessionStorage persistence of full optimization results including transaction data. While not a network-exposed vulnerability, any XSS in the app would expose the user's complete spending history.

**New-hire**:
- The comment referencing "D-01 architectural refactor" in `apps/web/src/lib/parser/csv.ts:30-34` is a cross-reference to an external tracking system that a new hire would not be able to locate. The TODO/C-notation system (C70-04, C37-02, etc.) references past review cycles but has no index or lookup mechanism.
- The type adapter pattern in `apps/web/src/lib/analyzer.ts` (lines 22-71) that bridges web types to core types is not documented anywhere outside the code. A new hire modifying card types would not know that changes must be reflected in both the web interface AND the adapter.

**Ops**:
- The `loadAllCardRules` function uses `fs/promises.readdir` recursively. On a large card catalog (100+ YAML files), this is a cold-start bottleneck with no caching or precompilation.
- The `CATEGORY_NAMES_KO` map in greedy.ts is a module-level constant — it cannot be updated at runtime if the taxonomy changes without a server restart.

**Skeptic**:
- The strongest argument that the current architecture will fail: the parser duplication is already showing divergent behavior (BOM handling, header scan limits). As more bank formats are added, the divergence will widen until the same CSV produces meaningfully different financial results on server vs client. For a financial tool, this is unacceptable.

---

## Verdict Justification

**Escalated to ADVERSARIAL mode** after discovering C-01 (bank names mis-categorized as utilities), C-02 (overly broad detection patterns), and M-01 (full parser duplication with divergent behavior). These are not isolated issues — they represent a pattern of copy-paste evolution and insufficient validation that runs through the codebase.

**Realist Check on severity**:
- C-01 (bank names as keywords): Downgraded from initial assessment. The realistic worst case is that card-fee/insurance transactions with bank card merchant names get categorized as `utilities` instead of their correct category. This produces a wrong reward estimate for those specific transactions, but it does not cause data loss or security breach. The overall optimization is only affected for the subset of transactions with bank-card merchant names, which is typically small. However, for a financial optimization tool, wrong reward estimates undermine the core value proposition. Severity stays at CRITICAL.
- M-02 (ILP stub): The realistic impact is nil because the ILP method is not exposed in the UI — only the CLI could potentially use it. Downgraded from initial consideration. Stays MAJOR because it's a correctness lie in the API.
- M-05 (BOM stripping): Realistic worst case is CLI users on Windows cannot parse their files. High user frustration but easy workaround (re-save as UTF-8 without BOM). Stays MAJOR because it affects a common use case.

**What would need to change for an upgrade to ACCEPT-WITH-RESERVATIONS**:
1. Fix C-01 (remove bank names from keyword map or downgrade to low-confidence)
2. Fix C-02 (restrict detection patterns to header region)
3. Fix M-05 (add BOM stripping to server parser)
4. Address M-04 (add load count validation)
5. Plan M-01 (parser dedup roadmap with timeline)

---

## Open Questions (unscored)

1. Are there real-world transaction merchant names that contain bank card issuer names (e.g., "삼성카드" as a merchant)? This would validate or refute C-01's severity. If bank card transactions never have bank names as merchants, the finding is theoretical.

2. Does the CLI actually support the `--method ilp` flag? If not, M-02 is purely an API design issue with no user-facing impact.

3. What percentage of Korean bank CSV exports use EUC-KR encoding? If it's significant, the missing encoding detection (gap #1) is more severe than assessed.

4. Is the `won_per_liter` fuel discount approximation (gap #6) causing measurable inaccuracy? Korean fuel discount cards are popular, and the per-transaction approximation could be significantly off for partial-tank fill-ups.

---
