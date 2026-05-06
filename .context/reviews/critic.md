# Critic Review — cherrypicker (Cycle 32)

**Reviewer:** critic (worker-3)
**Scope:** Full repository — design decisions, technical debt, over/under-engineering, conceptual inconsistencies, maintainability risks
**Date:** 2026-05-06
**Files examined:** 40+ source files across packages/core, packages/parser, packages/rules, packages/viz, apps/web, tools/cli, tools/scraper

---

## Summary

This codebase exhibits a pattern of **defensive duplication** rather than **intentional abstraction**. The monorepo structure suggests shared packages, but the web app re-implements nearly every parser and type. The optimizer works but has clear algorithmic inefficiencies. The categorization system is powerful but implemented twice (taxonomy + matcher) with slightly different semantics. Most critically, issues identified in cycles 2-20 remain unaddressed — the deferral culture has calcified into permanent technical debt.

---

## Critical Findings

### [C32-CRIT01-CRITICAL] Monorepo Runtime Schizophrenia — Same Logic, Two Incompatible Runtimes

**Files:** Root `package.json`, `apps/web/package.json`, `packages/parser/package.json`
**Confidence:** High

Root declares `"packageManager": "bun@1.2.6"` and scripts invoke `bun run`. The web app runs on Node 24 (`astro`, `svelte`). The parser package imports `fs/promises` and `path` (Node APIs) but is "pure TypeScript, no runtime-specific APIs" per CLAUDE.md.

Because the parser uses Node modules, the web app cannot import it. The result: the entire parser stack (CSV, XLSX, PDF, JSON, OFX, HTML) is re-implemented in `apps/web/src/lib/parser/` as a manually-maintained port. Comments like "Parity with server-side splitCSVLine (C13-01)" and "Parity with server-side which imports from packages/parser/src/date-utils.ts (C97-03)" prove this is conscious, ongoing duplication.

**Concrete failure:** A CP949 encoding fix in `packages/parser/src/detect.ts` (Bun/Node, byte-pattern heuristic) does not match the web app's strategy (`apps/web/src/lib/parser/detect.ts`: tries utf-8 and cp949, picks fewer replacement characters). A file parsing correctly in CLI shows mojibake in the browser.

**Fix:** Extract a runtime-agnostic parser core (pure functions over ArrayBuffer/string) and share it. Only file I/O should differ between environments.

---

### [C32-CRIT02-CRITICAL] Complete Parser Stack Duplication — Six Formats, Two Implementations Each

**Files:** `packages/parser/src/` vs `apps/web/src/lib/parser/`
**Confidence:** High

Every format parser exists in two versions:

| Format | Server (packages/parser) | Web (apps/web) | Lines (server) | Lines (web) |
|--------|--------------------------|----------------|----------------|-------------|
| CSV | `csv/index.ts`, `csv/shared.ts` | `csv.ts` | ~200 | ~180 |
| XLSX | `xlsx/index.ts` | `xlsx.ts` | ~150 | ~160 |
| PDF | `pdf/index.ts`, `pdf/table-parser.ts` | `pdf.ts` | ~431 | ~622 |
| HTML | `html/index.ts` | `html.ts` | ~279 | ~284 |
| JSON | `json/index.ts` | `json.ts` | ~90 | ~85 |
| OFX | `ofx/index.ts` | `ofx.ts` | ~80 | ~75 |

The web PDF parser is **622 lines** vs the server's **431 lines** — 44% larger because it ports the same logic with browser-specific APIs (`pdfjs-dist` instead of `unpdf`/`pdf-parse`). The `pdfjs-dist` text extraction loop (lines 449-494) duplicates server-side `extractor.ts` logic but uses `item.transform` and `item.str` with magic numbers (5px Y threshold, 6px char width).

**Fix:** See C32-CRIT01. Unify on a single runtime-agnostic core.

---

### [C32-CRIT03-HIGH] Greedy Optimizer is O(T² × C) — Quadratic Blowup

**File:** `packages/core/src/optimizer/greedy.ts` (lines 39-66)
**Confidence:** High

`scoreCardsForTransaction` calls `calculateCardOutput` for every card, for every transaction. `calculateCardOutput` internally calls `calculateRewards`, which iterates all transactions already assigned to that card. This creates:

```
For each transaction T:
  For each card C:
    calculateCardOutput(currentTxs + T)  // O(|currentTxs|)
```

With T transactions and C cards, worst-case is O(T² × C). For 500 transactions × 50 cards: 500 × 50 × 500 = 12.5 million reward calculation iterations.

**Fix:** Compute marginal rewards incrementally. Track per-card running totals and compute only the delta from adding one transaction. Reduces to O(T × C).

---

### [C32-CRIT04-HIGH] Global Cap Rollback Misses capReached Flag

**File:** `packages/core/src/calculator/reward.ts` (lines 286-305)
**Confidence:** High

When a reward exceeds `globalCap`, the code rolls back `ruleMonthUsed` but never sets `bucket.capReached = true`. The `capReached` boolean only reflects rule-level cap hits (line 318). Users see `capReached: false` for categories clipped by the global cap, misleading them into thinking more spending would yield more rewards.

**Fix:** Set `bucket.capReached = true` when global cap clips a reward, or add a separate `globalCapReached` flag to `CapInfo`.

---

### [C32-CRIT05-HIGH] Massive Type Duplication Between Core and Web

**Files:** `apps/web/src/lib/store.svelte.ts` (lines 11-66) vs `packages/core/src/models/result.ts`
**Confidence:** High

`store.svelte.ts` re-declares `CategoryReward`, `CapInfo`, `CardRewardResult`, `CardAssignment`, `OptimizationResult` — identical shapes to `@cherrypicker/core` exports. When core changes, the web store type becomes a stale shadow. TypeScript won't catch mismatches.

Additionally, `analyzer.ts` (lines 24-89) contains `toRulesCategoryNodes()` and `toCoreCardRuleSets()` — adapter functions that bridge the web app's divergent `CategoryNode` (`label` instead of `labelKo`/`labelEn`) and `CardRuleSet` (`source: string` instead of enum) to the package types. This "type adapter tax" is evidence of poorly drawn type boundaries.

**Fix:** Import model types from `@cherrypicker/core`. Unify the web app's static JSON loader to conform to the same Zod schemas as server-side loaders.

---

## High Findings

### [C32-CRIT06-HIGH] MerchantMatcher Cache Claims LRU but Implements FIFO

**File:** `packages/core/src/categorizer/matcher.ts` (lines 31-138)
**Confidence:** High

Comment says "LRU cache keyed by normalized merchant name + rawCategory." Eviction code (lines 130-136):

```typescript
const firstKey = this.cache.keys().next().value;
this.cache.delete(firstKey);
```

JavaScript Maps iterate in insertion order. Evicting the first key is **FIFO**, not LRU. Frequently accessed early-inserted items get evicted before rarely-accessed recent items.

**Fix:** Implement a real LRU with access tracking, or use a library like `lru-cache`. Or change the comment to accurately describe FIFO behavior.

---

### [C32-CRIT07-HIGH] findRule Sort Comparator Uses O(n) indexOf

**File:** `packages/core/src/calculator/reward.ts` (lines 86-90)
**Confidence:** High

Tiebreaker in `findRule`: `rules.indexOf(a) - rules.indexOf(b)`. Each `indexOf` is O(n), and sort calls the comparator O(n log n) times. For 100 rules: ~460 comparisons × 200 ops = ~92,000 operations for a simple deterministic tiebreak.

**Fix:** Pre-compute rule indices into a `Map<Rule, number>` before sorting, or add an `index` field to `RewardRule`.

---

### [C32-CRIT08-HIGH] reoptimize() Sets Transaction Counts Incorrectly

**File:** `apps/web/src/lib/store.svelte.ts` (lines 600-601)
**Confidence:** High

```typescript
const newTransactionCount = editedTransactions.length;
const newTotalTransactionCount = editedTransactions.length;
```

Both are set to the same value. But `transactionCount` should represent the optimized month only (matching initial `analyzeMultipleFiles` behavior), while `totalTransactionCount` should represent all months. After editing, the UI shows the full count for the optimized month.

**Fix:** `newTransactionCount` should be `latestTransactions.length` (the filtered latest month), not `editedTransactions.length`.

---

### [C32-CRIT09-HIGH] PDF Parsing Uses Two Entirely Different Libraries

**Files:** `packages/parser/package.json` vs `apps/web/package.json`
**Confidence:** High

Server: `unpdf` (^0.12.0) + `pdf-parse` (^1.1.1). Browser: `pdfjs-dist` (^4.10.38). Different extraction heuristics produce different results. A PDF working in CLI may fail in browser, or vice versa.

**Fix:** Unify on `pdfjs-dist` everywhere. It works in both Node and browser.

---

### [C32-CRIT10-HIGH] CategoryTaxonomy.findCategory Duplicates MerchantMatcher Logic

**Files:** `packages/core/src/categorizer/taxonomy.ts` (lines 58-111) vs `packages/core/src/categorizer/matcher.ts` (lines 40-127)
**Confidence:** High

Both implement three-stage matching (exact → substring → fuzzy) with slightly different thresholds and confidence scores. DRY violation. When a bug is fixed in one, the other may remain broken.

**Fix:** Extract the matching strategy into a shared function or class.

---

## Medium Findings

### [C32-CRIT11-MEDIUM] constraints.ts "Shallow Copy" Comment is Misleading

**File:** `packages/core/src/optimizer/constraints.ts` (lines 14-17)
**Confidence:** Medium

```typescript
const preservedTransactions = transactions;
```

The comment calls this a "shallow copy" and says it's "unnecessary." This is not a copy — it's an alias. The comment is actively misleading for future maintainers who might add mutation.

**Fix:** Rename to `transactionsRef` or remove the comment. Document immutability on the `OptimizationConstraints` interface if that's the contract.

---

### [C32-CRIT12-MEDIUM] OptimizeMethod is a Fake Choice

**File:** `packages/core/src/optimizer/index.ts` (lines 10-31)
**Confidence:** Medium

```typescript
export type OptimizeMethod = 'greedy';
// ...
switch (method) {
  case 'greedy':
  default:
    return greedyOptimize(...);
}
```

The type system pretends there's a choice. There's only one value. The `default` falls through to greedy, silently accepting any invalid method string.

**Fix:** Remove `OptimizeMethod` and `OptimizeOptions`. Call `greedyOptimize` directly. Re-add abstraction when a second method actually exists.

---

### [C32-CRIT13-MEDIUM] detectBank Defensively Resets lastIndex on Non-Global Regexes

**File:** `packages/parser/src/detect.ts` (lines 177-184)
**Confidence:** Medium

```typescript
pattern.lastIndex = 0;
if (pattern.test(content)) { score++; }
```

All patterns in `BANK_SIGNATURES` are statically-defined literals without `/g`. Resetting `lastIndex` is unnecessary overhead. Defensive coding against a hypothetical future `/g` flag.

**Fix:** Confirm no `/g` flags exist, remove the reset. Or add a lint rule.

---

### [C32-CRIT14-MEDIUM] MIGRATIONS in store.svelte.ts is Over-Engineered

**File:** `apps/web/src/lib/store.svelte.ts` (lines 115-117, 247-250)
**Confidence:** Medium

50+ lines of infrastructure for a migration system with zero migrations after 32 cycles. The sessionStorage persistence is a best-effort cache, not a database.

**Fix:** Remove the migration system. On version mismatch, clear storage and let the user re-upload.

---

### [C32-CRIT15-MEDIUM] Keyword Files are Massive Static Blobs

**Files:** `packages/core/src/categorizer/keywords.ts` (394KB)
**Confidence:** Medium

394KB of hand-maintained merchant-to-category mappings. Too large for code review. Impossible to tree-shake. Every web user downloads the entire database.

**Fix:** Store as JSON data files loaded on demand, or split by category. Consider a Trie for efficient matching.

---

### [C32-CRIT16-MEDIUM] Amount Regexes in PDF Parser are Unmaintainable

**File:** `apps/web/src/lib/parser/pdf.ts` (lines 37, 541)
**Confidence:** Medium

`AMOUNT_PATTERN` and `fallbackAmountPattern` are 300+ character regexes with nested capture groups, lookbehinds, and 7-level fallback chains (`amountMatch[1] ?? ... ?? amountMatch[7]`).

**Fix:** Replace with a token-based parser or composable simpler regexes tried in order.

---

### [C32-CRIT17-MEDIUM] BANK_COLUMN_CONFIGS Hardcodes 24 Banks in Source

**File:** `apps/web/src/lib/parser/xlsx.ts` (lines 32-100+)
**Confidence:** Medium

24 banks' column names hardcoded in TypeScript. Adding a bank requires editing source and recompiling.

**Fix:** Move to JSON/YAML in `public/data/` loaded at runtime.

---

### [C32-CRIT18-MEDIUM] Silent Error Swallowing in tryStructuredParse

**Files:** `packages/parser/src/pdf/index.ts` (lines 255-260), `apps/web/src/lib/parser/pdf.ts` (lines 443-446)
**Confidence:** Medium

```typescript
try { /* 80 lines of table parsing */ } catch (err) { return null; }
```

Any error in the table parser is completely swallowed. Users get "PDF에서 거래를 찾지 못했어요" with no indication whether the PDF was unreadable, malformed, or just had an unexpected format.

**Fix:** Append the caught error to the `errors` array instead of returning null silently.

---

### [C32-CRIT19-MEDIUM] Unsafe JSON Parsing with `as` Casts

**Files:** `tools/scraper/src/cli.ts:79`, `apps/web/src/lib/cards.ts:151,201`, `packages/rules/src/loader.ts:55`
**Confidence:** Medium

Multiple locations parse JSON and immediately cast with `as`. No runtime validation with Zod. Malformed files crash with opaque errors.

**Fix:** Validate with Zod schemas at runtime, especially for external data (scraped JSON, fetched API responses).

---

## Low Findings

### [C32-CRIT20-LOW] turbo.json lint Depends on Build

**File:** `turbo.json` (lines 15-17)
**Confidence:** Low

```json
"lint": { "dependsOn": ["^build"] }
```

Linting (`tsc --noEmit`) does not need build artifacts. This adds unnecessary latency.

**Fix:** Remove `"dependsOn": ["^build"]` from the `lint` task.

---

### [C32-CRIT21-LOW] isOptimizableTx Name/Behavior Mismatch

**File:** `apps/web/src/lib/tx-validation.ts` (lines 8-20)
**Confidence:** Low

Returns `true` for negative-amount transactions (refunds), but the name implies optimizable. Downstream code filters negatives again.

**Fix:** Rename to `isValidTx` or add `obj.amount > 0` to the guard.

---

### [C32-CRIT22-LOW] Web App Depends on papaparse but Uses Custom CSV Parser

**File:** `apps/web/package.json` (line 25)
**Confidence:** Low

`papaparse` is listed as a dependency but never imported in the web source. The custom `splitLine`/`splitCSVContent` in `csv.ts` handles all CSV parsing.

**Fix:** Remove `papaparse` from dependencies, or replace custom splitter with it.

---

### [C32-CRIT23-LOW] Dist Files Committed to Git

**Files:** `packages/core/dist/optimizer/ilp.js`, `packages/core/dist/categorizer/keywords.js`
**Confidence:** Low

Compiled `dist/` files tracked in git. `ilp.js` contains a TODO about ILP integration — an abandoned feature whose ghost remains.

**Fix:** Add `dist/` to `.gitignore`. Remove `ilp.js` if ILP is not on the roadmap.

---

### [C32-CRIT24-LOW] No Structured CLI Framework

**Files:** `tools/scraper/src/cli.ts`, `tools/cli/src/index.ts`
**Confidence:** Low

Both CLIs use manual `process.argv` slicing and `switch` statements. No typed argument parsing, no middleware, no subcommand-specific help.

**Fix:** Use `commander`, `clipanion`, or `oclif`.

---

## Cross-Cycle Status: Issues Reported in Cycles 2-20 That Remain Open

| Issue | First Reported | Current Status |
|-------|---------------|----------------|
| Server/web parser duplication | Cycle 2 | **Still open** — now 6 formats |
| CATEGORY_NAMES_KO hardcoding | Cycle 3 | **Still open** — in greedy.ts, CategoryBreakdown.svelte |
| No parity tests between server/web parsers | Cycle 6 | **Still open** |
| No architecture documentation | Cycle 4 | **Still open** |
| Keyword files as static blobs | Cycle 8 | **Still open** — 394KB |
| Optimizer O(T² × C) | Cycle 12 | **Still open** |
| Bank adapter configs hardcoded | Cycle 15 | **Still open** — 24 banks |

The deferral culture has calcified. Each cycle identifies the same issues, adds them to `.context/plans/`, and moves on. The plans directory now has 40+ files, many from cycles 1-10 containing fixes completed long ago. The cost of deferral compounds: each new parser format must be implemented twice.

**Recommendation:** Schedule a dedicated refactoring sprint for C32-CRIT01/02 (parser unification) and C32-CRIT03 (optimizer complexity). These are structural issues that cannot be fixed incrementally. Close indefinitely deferred issues as "won't fix" with explicit rationale rather than letting them accumulate across cycles.
