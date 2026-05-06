# Code Simplifier Review — Cycle 32

**Reviewer:** code-simplifier  
**Date:** 2026-05-06  
**Scope:** Entire `/Users/hletrd/flash-shared/cherrypicker` repository  
**Focus:** Unnecessary complexity, code duplication, over-engineering, and opportunities to reduce line count and cognitive load without changing behavior.

---

## Executive Summary

The codebase suffers from significant duplication between browser-side (`apps/web/src/lib/parser/`) and server-side (`packages/parser/src/`) parsers, with hundreds of lines of near-identical logic maintained in parallel. Several local patterns (forward-fill loops, bank adapter boilerplate, regex duplication) are repeated identically across files. The store persistence layer is over-engineered for the actual requirements. A few functions have grown too large and should be decomposed. Overall estimated simplification potential: **~1200–1500 lines removed** with zero behavioral change.

---

## F1: Browser/Server Parser Duplication — Massive Parallel Maintenance Burden

**Confidence:** High  
**Severity:** High

### Problem

The web app (`apps/web/src/lib/parser/`) and the Bun-based parser package (`packages/parser/src/`) contain nearly identical implementations of the same parsers. The web files contain extensive parity comments (e.g., `C19-01`, `C67-04`, `C98-02`) acknowledging this duplication. Key duplicated modules:

- `apps/web/src/lib/parser/csv.ts` ↔ `packages/parser/src/csv/` (generic.ts, shared.ts, adapter-factory.ts, index.ts)
- `apps/web/src/lib/parser/xlsx.ts` ↔ `packages/parser/src/xlsx/index.ts`
- `apps/web/src/lib/parser/html.ts` ↔ `packages/parser/src/html/index.ts`
- `apps/web/src/lib/parser/pdf.ts` ↔ `packages/parser/src/pdf/` (extractor.ts, table-parser.ts, index.ts)
- `apps/web/src/lib/parser/column-matcher.ts` ↔ `packages/parser/src/csv/column-matcher.ts`
- `apps/web/src/lib/parser/date-utils.ts` ↔ `packages/parser/src/date-utils.ts`

`csv.ts` line 100–107 even contains a comment admitting this:

> "Full dedup requires the D-01 architectural refactor (shared module between Bun and browser environments)."

This is not a future wish — it is actively costing maintainability. Every bug fix, new date format, or column pattern must be applied in two places, and discrepancies are already accumulating (e.g., the web PDF `parseDateToISO` takes `errors?: ParseError[]` while the server version may differ in signature).

### Concrete Failure Scenario

A developer fixes a date-parsing edge case in `packages/parser/src/date-utils.ts` but forgets to port it to `apps/web/src/lib/parser/date-utils.ts`. Users uploading files via the web app experience parse failures that the CLI handles correctly. The parity comments make this *detectable* but not *preventable*.

### Suggested Fix

Create a shared `packages/parser-shared/` or `packages/parser/browser-compat/` module that exports pure functions with no Bun/Node-specific APIs. Both the web app and the Bun package import from it. The web app can use Vite's `resolve.alias` to map the shared package. The only environment-specific code should be I/O (file reading, PDF text extraction using different libraries).

**Estimated savings:** ~800–1000 lines across the duplicated parser modules.

---

## F2: Forward-Fill Logic Copy-Pasted 6× in `xlsx.ts`

**Confidence:** High  
**File:** `apps/web/src/lib/parser/xlsx.ts`  
**Lines:** 502–557

### Problem

The forward-fill pattern for merged cells is repeated identically for each of 6 columns (date, merchant, category, installments, memo, amount). Each block is ~9 lines and differs only in the variable name:

```ts
// Date column forward-fill
const rawDateValue = dateCol !== -1 ? row[dateCol] : '';
if (dateCol !== -1 && isNonEmpty(rawDateValue)) {
  if (!isSummaryRow(String(rawDateValue))) {
    lastDate = rawDateValue;
  }
}
const dateRaw = dateCol !== -1 ? (isNonEmpty(rawDateValue) ? rawDateValue : lastDate) : '';
```

This pattern is also duplicated in `html.ts` (lines 191–244) and likely in the server-side XLSX/HTML parsers.

### Concrete Failure Scenario

A future change to forward-fill logic (e.g., adding a new column like `cardNumber`) requires editing 6+ nearly identical blocks. It is easy to miss one, causing inconsistent behavior across columns.

### Suggested Fix

Extract a generic forward-fill helper:

```ts
function forwardFill(
  row: unknown[],
  colIdx: number,
  lastValue: unknown,
  isSummaryRow: (text: string) => boolean,
): { value: unknown; newLast: unknown } {
  if (colIdx === -1) return { value: '', newLast: lastValue };
  const raw = row[colIdx];
  if (isNonEmpty(raw) && !isSummaryRow(String(raw))) {
    return { value: raw, newLast: raw };
  }
  return { value: lastValue, newLast: lastValue };
}
```

Then replace each 9-line block with a 2-line call:

```ts
const dateFill = forwardFill(row, dateCol, lastDate, isSummaryRow);
const dateRaw = dateFill.value;
lastDate = dateFill.newLast;
```

Same helper applies to `html.ts`.

**Estimated savings:** ~40 lines in `xlsx.ts`, ~30 lines in `html.ts`.

---

## F3: `BANK_COLUMN_CONFIGS` + `createBankAdapter` Bank Boilerplate

**Confidence:** High  
**Files:** `apps/web/src/lib/parser/xlsx.ts` (lines 32–184), `apps/web/src/lib/parser/csv.ts` (lines 544–765)

### Problem

`xlsx.ts` defines 24 hand-written `ColumnConfig` objects (lines 32–184), and `csv.ts` defines 24 `createBankAdapter({...})` calls (lines 544–765). Each entry is structurally identical — only the Korean strings differ. In `csv.ts`, the factory eliminated parse-logic duplication (good), but the configuration table is still 220 lines of boilerplate.

### Concrete Failure Scenario

Adding a new bank requires editing two files with near-identical data. A typo in one config (e.g., `installmentsHeader: '할부'` vs `installments: '할부'`) causes inconsistent parsing between CSV and XLSX for the same bank.

### Suggested Fix

Move bank metadata to a single JSON or TS data file shared by both parsers:

```ts
// packages/core/src/bank-metadata.ts
export const BANK_CONFIGS: Record<BankId, BankConfig> = {
  hyundai: {
    date: '이용일', merchant: '이용처', amount: '이용금액',
    installments: '할부', memo: '비고',
    csvHeaders: ['이용일', '이용처', '이용금액', '할부', '비고'],
  },
  // ...etc
};
```

Both `csv.ts` and `xlsx.ts` import `BANK_CONFIGS`. The `xlsx.ts` `ColumnConfig` and `csv.ts` `createBankAdapter` calls collapse to a single loop.

**Estimated savings:** ~300 lines across the two files.

---

## F4: `store.svelte.ts` Persistence Layer is Over-Engineered

**Confidence:** High  
**File:** `apps/web/src/lib/store.svelte.ts`  
**Lines:** 99–366

### Problem

The sessionStorage persistence system includes:
- Schema versioning (`STORAGE_VERSION = 1`)
- Migration framework (`MIGRATIONS: Record<number, ...>`)
- Size-based truncation logic (`MAX_PERSIST_SIZE = 4MB`)
- Three different warning kinds (`'truncated' | 'corrupted' | 'quota_exceeded' | 'error'`)
- `safeJSONParse` with a forbidden-keys blocklist
- Deep validation of nested arrays on load

This is ~230 lines of code to persist a single analysis result in sessionStorage. The migration framework has zero migrations. The forbidden-key parser guards against prototype pollution from JSON.parse — but the data is generated entirely by the app's own code, never from an external source. The truncation logic is defensive but the actual payload is typically well under 1MB.

### Concrete Failure Scenario

The complexity makes the store harder to reason about. A bug in `loadFromStorage` (e.g., the `_truncatedTxCount` handling at lines 305–312) could cause spurious data-loss warnings or prevent legitimate data from loading.

### Suggested Fix

Simplify to a straightforward save/load with a single version check and a try/catch:

```ts
const STORAGE_KEY = 'cherrypicker:analysis';
const STORAGE_VERSION = 1;
const MAX_SIZE = 4 * 1024 * 1024;

function persist(data: AnalysisResult): void {
  if (typeof sessionStorage === 'undefined') return;
  const payload = JSON.stringify({ ...data, _v: STORAGE_VERSION });
  if (new Blob([payload]).size > MAX_SIZE) {
    const { transactions: _, ...small } = data;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...small, _v: STORAGE_VERSION, _truncated: true }));
  } else {
    sessionStorage.setItem(STORAGE_KEY, payload);
  }
}

function load(): AnalysisResult | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?._v !== STORAGE_VERSION) { sessionStorage.removeItem(STORAGE_KEY); return null; }
    // Shallow validation only
    if (!parsed.optimization?.assignments) { sessionStorage.removeItem(STORAGE_KEY); return null; }
    return parsed as AnalysisResult;
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}
```

**Estimated savings:** ~180 lines.

---

## F5: `calculateRewards` is a 200-Line God Function

**Confidence:** High  
**File:** `packages/core/src/calculator/reward.ts`  
**Lines:** 181–363

### Problem

`calculateRewards` is ~180 lines with nested conditionals, multiple tracker Maps, inline comment blocks explaining business logic, and concerns mixed together (tier selection, rule matching, cap tracking, global cap rollback, reward type accumulation). It mutates a `bucket` object by reference across a complex loop.

### Concrete Failure Scenario

The global cap rollback logic (lines 288–305) is subtle: when the global cap clips a reward, the rule-level tracker must be decremented by the overcount. This is easy to break during maintenance. The `rewardTypeAccum` Map (lines 210, 313–315, 334–343) exists only to determine the "dominant" reward type per category — a concern that could be separated.

### Suggested Fix

Decompose into focused functions:

```ts
function selectTier(...): PerformanceTier | undefined;
function findMatchingRule(tx, rules, tierId): RewardRule | undefined;
function calculateTransactionReward(tx, rule, tierRate, trackers): { reward: number; capReached: boolean };
function applyGlobalCap(reward, globalCap, globalUsed): { reward: number; overcount: number };
function buildCategoryResults(buckets, rewardTypeAccum): CategoryReward[];
```

Each function is testable in isolation. The main `calculateRewards` becomes a pipeline of ~40 lines.

**Estimated savings:** Not lines, but massive reduction in cyclomatic complexity.

---

## F6: `isValidShortDate` Checks 4 Years of `daysInMonth`

**Confidence:** Medium  
**File:** `apps/web/src/lib/parser/date-utils.ts`  
**Lines:** 217–237

### Problem

```ts
return day >= 1 && (
  day <= daysInMonth(thisYear, month) ||
  day <= daysInMonth(thisYear - 1, month) ||
  day <= daysInMonth(thisYear - 2, month) ||
  day <= daysInMonth(thisYear - 3, month)
);
```

This accepts a short date if it is valid in ANY of the last 4 years. The rationale (C88-01) is to accept Feb 29 from leap-year statements. But Feb 29 is valid only in leap years, which occur every 4 years. Checking 4 consecutive years does NOT guarantee a leap year (e.g., 2023, 2022, 2021, 2020 — only 2020 is a leap year). The logic is both overbroad and still fails for non-leap-year spans.

### Concrete Failure Scenario

A statement with Feb 29 uploaded in 2025 (`thisYear = 2025`) checks 2025, 2024, 2023, 2022 — 2024 is a leap year, so it passes. But a statement with Feb 29 uploaded in 2023 checks 2023, 2022, 2021, 2020 — 2020 is a leap year, so it passes too. The issue is that the 4-year window is arbitrary; the real requirement is "is there ANY leap year in a reasonable window?" A simpler approach: just check if the day is ≤ 29 (for Feb) or use the standard `daysInMonth` for the current year and also check if `month === 2 && day === 29`.

### Suggested Fix

```ts
export function isValidShortDate(cell: string): boolean {
  const stripped = cell.replace(/[.\-\/．。]\s*$/, '');
  const match = stripped.match(/^\d{1,2}[.\-\/．。]\d{1,2}$/);
  if (!match) return false;
  const parts = stripped.split(/[.\-\/．。]/);
  const month = parseInt(parts[0] ?? '', 10);
  const day = parseInt(parts[1] ?? '', 10);
  if (month < 1 || month > 12) return false;
  // Feb 29 is always acceptable — leap-year statements exist
  if (month === 2 && day === 29) return true;
  return day >= 1 && day <= daysInMonth(new Date().getFullYear(), month);
}
```

**Estimated savings:** 10 lines, plus clearer intent.

---

## F7: `SUMMARY_ROW_PATTERN` is an Unmaintainable 30-Clause Regex

**Confidence:** High  
**File:** `apps/web/src/lib/parser/column-matcher.ts`  
**Line:** 79

### Problem

The `SUMMARY_ROW_PATTERN` is a single regex with ~30 alternatives, each using lookbehind/lookahead assertions. It is ~1200 characters on one line. It is also duplicated in `packages/parser/src/csv/column-matcher.ts` (the server-side mirror).

### Concrete Failure Scenario

Adding a new summary keyword requires careful regex escaping and understanding of the lookbehind constraints. A mistake (e.g., forgetting a boundary assertion) could cause merchant names like "합계마트" to be incorrectly skipped.

### Suggested Fix

Replace with a simple array of normalized keywords and a helper:

```ts
const SUMMARY_KEYWORDS = [
  '총합계', '합계', '합산', '소계', '총계', '누계', '잔액',
  '당월', '명세', '이월잔액', '전월이월', '이월금액',
  // ... etc
];

export function isSummaryRow(text: string): boolean {
  const normalized = text.slice(0, 500).replace(/\s+/g, '').toLowerCase();
  return SUMMARY_KEYWORDS.some(kw => normalized.includes(kw));
}
```

This is more readable, easier to extend, and avoids regex ReDoS risk entirely. The current regex already caps at 500 chars for ReDoS protection — a plain string search is inherently safe.

**Estimated savings:** ~1 line (but massive readability gain).

---

## F8: `analyzer.ts` Builds Two Maps with Identical Loop Structure

**Confidence:** High  
**File:** `apps/web/src/lib/analyzer.ts`  
**Lines:** 536–551

### Problem

```ts
const monthlySpending = new Map<string, number>();
const monthlyTxCount = new Map<string, number>();
for (const tx of editedTransactions) {
  if (!tx.date || tx.date.length < 7) continue;
  const month = tx.date.slice(0, 7);
  if (tx.amount > 0) {
    monthlySpending.set(month, (monthlySpending.get(month) ?? 0) + tx.amount);
  }
  monthlyTxCount.set(month, (monthlyTxCount.get(month) ?? 0) + 1);
}
```

This identical pattern appears again in `analyzeMultipleFiles` (lines 332–347). Both could be a single helper.

### Suggested Fix

```ts
function aggregateByMonth(txs: CategorizedTx[]): { spending: Map<string, number>; count: Map<string, number> } {
  const spending = new Map<string, number>();
  const count = new Map<string, number>();
  for (const tx of txs) {
    if (!tx.date || tx.date.length < 7) continue;
    const month = tx.date.slice(0, 7);
    if (tx.amount > 0) spending.set(month, (spending.get(month) ?? 0) + tx.amount);
    count.set(month, (count.get(month) ?? 0) + 1);
  }
  return { spending, count };
}
```

**Estimated savings:** ~30 lines.

---

## F9: `parsePDF` Fallback Line Scanner Reconstructs Date/Amount Regexes

**Confidence:** Medium  
**File:** `apps/web/src/lib/parser/pdf.ts`  
**Lines:** 519–602

### Problem

The fallback scanner in `parsePDF` defines local regexes (`fallbackDatePattern`, `fallbackAmountPattern`) that are variants of the module-level `DATE_PATTERN` and `AMOUNT_PATTERN`. The fallback amount pattern has 7 capture groups and a complex extraction:

```ts
const amountRaw = (amountMatch[1] ?? amountMatch[2] ?? amountMatch[3] ?? amountMatch[4] ?? amountMatch[5] ?? amountMatch[6] ?? amountMatch[7])!;
```

This is fragile — if the regex groups are reordered, the extraction breaks silently.

### Concrete Failure Scenario

A developer adds an 8th capture group to `fallbackAmountPattern` but forgets to update the `amountMatch[N]` chain. The new group is silently ignored, causing parse failures for certain amount formats.

### Suggested Fix

Instead of capture groups, use a single non-capturing match and extract the matched text directly:

```ts
const fallbackAmountPattern = /\([\d,]+\)|[₩￦][\d,]+원?|마이너스[\d,]+원?|－[\d,]+원?|KRW[\d,]+원?|[\d,]*(?:,|\d{5,})[\d,]*-|[\d,]*(?:,|\d{5,})[\d,]*원?/g;
// Then use amountMatch[0] directly, and parseAmount handles normalization
```

Or better: reuse the existing `parseAmount` / `AMOUNT_PATTERN` infrastructure rather than maintaining a separate fallback regex.

**Estimated savings:** ~15 lines and reduced fragility.

---

## F10: `constraints.ts` is a Trivial Pass-Through

**Confidence:** High  
**File:** `packages/core/src/optimizer/constraints.ts`  
**Lines:** 1–26

### Problem

```ts
export function buildConstraints(
  transactions: CategorizedTransaction[],
  cardPreviousSpending: Map<string, number>,
  categoryLabels: Map<string, string>,
): OptimizationConstraints {
  const preservedTransactions = transactions;
  const cards: { cardId: string; previousMonthSpending: number }[] = [];
  for (const [cardId, previousMonthSpending] of cardPreviousSpending) {
    cards.push({ cardId, previousMonthSpending });
  }
  return { cards, transactions: preservedTransactions, categoryLabels };
}
```

This function:
1. Creates an alias `preservedTransactions = transactions` with a comment about shallow copies that was already addressed
2. Manually pushes Map entries into an array instead of using `Array.from(cardPreviousSpending.entries())`
3. Exists as a separate module with a single trivial function

### Suggested Fix

Inline in `greedy.ts` or simplify to:

```ts
export function buildConstraints(
  transactions: CategorizedTransaction[],
  cardPreviousSpending: Map<string, number>,
  categoryLabels: Map<string, string>,
): OptimizationConstraints {
  return {
    cards: Array.from(cardPreviousSpending, ([cardId, previousMonthSpending]) => ({ cardId, previousMonthSpending })),
    transactions,
    categoryLabels,
  };
}
```

Or simply remove `constraints.ts` entirely and construct the object directly in `greedyOptimize` or `analyzer.ts`.

**Estimated savings:** ~25 lines (module overhead + function).

---

## F11: `getCardById` Linear Scan Fallback is Dead Code

**Confidence:** Medium  
**File:** `apps/web/src/lib/cards.ts`  
**Lines:** 286–309

### Problem

`getCardById` has an O(1) index path (lines 262–284) and a fallback O(n) linear scan (lines 286–309). The fallback is 23 lines of duplicated object mapping. The comment says "should not normally be reached." If the index is built synchronously with `loadCardsData` (line 155), it is always available when data is available.

### Concrete Failure Scenario

The fallback path masks a real bug: if `cardIndex` is null when data is present, something went wrong during index building. Silently falling back to linear scan hides the issue and performs worse.

### Suggested Fix

Remove the fallback. If `cardIndex` is null, throw or return null — the index should always exist when data is loaded.

**Estimated savings:** ~23 lines.

---

## F12: `toRulesCategoryNodes` Recursively Rebuilds Entire Tree on Every Call

**Confidence:** Medium  
**File:** `apps/web/src/lib/analyzer.ts`  
**Lines:** 29–39

### Problem

```ts
function toRulesCategoryNodes(nodes: CategoryNode[]): RulesCategoryNode[] {
  return nodes.map((node) => ({
    id: node.id,
    labelKo: node.labelKo,
    labelEn: '',
    keywords: node.keywords,
    ...(node.subcategories
      ? { subcategories: toRulesCategoryNodes(node.subcategories) }
      : {}),
  }));
}
```

This recursively clones the entire category tree just to add an empty `labelEn` field. The tree is fetched from JSON and is immutable for the session. The clone is unnecessary — a simple adapter wrapper or type assertion would suffice.

### Suggested Fix

If the types truly require `labelEn`, either:
1. Add `labelEn: ''` to the web `CategoryNode` type (simplest), or
2. Use a lightweight proxy/wrapper instead of deep cloning:

```ts
function toRulesCategoryNodes(nodes: CategoryNode[]): RulesCategoryNode[] {
  // Mutate in place since nodes come from fetched JSON and are session-local
  for (const node of nodes) {
    (node as unknown as RulesCategoryNode).labelEn = '';
    if (node.subcategories) toRulesCategoryNodes(node.subcategories);
  }
  return nodes as unknown as RulesCategoryNode[];
}
```

Or better: align the types between `@cherrypicker/rules` and the web app so no adapter is needed.

**Estimated savings:** ~10 lines and avoids O(n) recursion per analysis.

---

## Cross-File Interactions

### C1: Parser Parity Comments Create Maintenance Debt
The `C##-##` comment tags (e.g., `C19-01`, `C67-04`) scattered throughout the parser files are a manual tracking system for cross-file parity. They are evidence that the codebase already recognizes the duplication problem. However, they are not machine-enforced — a developer can change one file without the other, and there is no automated check. The comments themselves add noise (~200+ lines of parity comments across parser files).

**Recommendation:** Either implement the D-01 shared module refactor, or add a CI step that diffs the web and server parser implementations and flags divergence.

### C2: `column-matcher.ts` Header Keyword Arrays are Duplicated
The `HEADER_KEYWORDS` array (line 89) and the individual category Sets (`DATE_KEYWORDS`, `MERCHANT_KEYWORDS`, etc., lines 100–104) contain the same strings. The Sets are derived from the array but are maintained separately. If a keyword is added to `HEADER_KEYWORDS` but not to the corresponding Set, `isValidHeaderRow` may under-count categories.

**Recommendation:** Derive the Sets from the array automatically:

```ts
const KEYWORD_CATEGORIES = [
  { name: 'date', keywords: ['이용일', '이용일자', ...] },
  // ...
];
export const DATE_KEYWORDS = new Set(KEYWORD_CATEGORIES[0].keywords);
```

---

## Final Sweep — Commonly Missed Issues

- **Dead code:** `parseAmountString` in `apps/web/src/lib/parser/csv.ts` (line 123) is an alias for `parseAmount` — exported only for HTML parser parity. Could be unified.
- **Magic numbers:** `30` (max header scan rows) appears in `csv.ts`, `xlsx.ts`, `html.ts`, and server-side parsers. Should be a constant.
- **Regex compilation:** `DATE_PATTERN`, `AMOUNT_PATTERN` in `pdf.ts` are recompiled on every module load — fine, but the fallback scanner in `parsePDF` creates *new* regex instances locally. Could hoist.
- **Commented-out dead code:** `// C27-01: Bare integers...` comments in `pdf.ts` (lines 33–36) explain regex behavior that is already evident from the regex itself — the comment is longer than the pattern.

---

## Summary Table

| Finding | File(s) | Lines to Remove | Confidence |
|---------|---------|-----------------|------------|
| F1 Browser/Server Duplication | `apps/web/src/lib/parser/*` ↔ `packages/parser/src/*` | ~800–1000 | High |
| F2 Forward-Fill Duplication | `xlsx.ts`, `html.ts` | ~70 | High |
| F3 Bank Config Boilerplate | `xlsx.ts`, `csv.ts` | ~300 | High |
| F4 Store Persistence Over-Engineering | `store.svelte.ts` | ~180 | High |
| F5 calculateRewards God Function | `reward.ts` | N/A (refactor) | High |
| F6 isValidShortDate 4-Year Check | `date-utils.ts` | ~10 | Medium |
| F7 SUMMARY_ROW_PATTERN | `column-matcher.ts` | N/A (refactor) | High |
| F8 Monthly Aggregation Duplication | `analyzer.ts` | ~30 | High |
| F9 Fallback Regex Fragility | `pdf.ts` | ~15 | Medium |
| F10 constraints.ts Pass-Through | `constraints.ts` | ~25 | High |
| F11 getCardById Fallback | `cards.ts` | ~23 | Medium |
| F12 toRulesCategoryNodes Clone | `analyzer.ts` | ~10 | Medium |

**Total estimated removable lines:** ~1500–1700 (with behavioral equivalence).
