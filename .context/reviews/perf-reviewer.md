# Performance Review — Cycle 1

**Reviewer:** perf-reviewer
**Date:** 2026-07-23
**Scope:** Entire current repository at `e6fe49b`; browser/CLI CPU, allocation, I/O, and scalability
**Outcome:** 2 High, 2 Medium findings

## Findings

### PERF-01 — Default optimization synchronously rescans all assigned history against all 683 cards

**Severity:** High
**Confidence:** High
**Status:** Confirmed by code inspection and local benchmark

**Evidence**

- The upload UI supplies no `cardIds`, so `apps/web/src/lib/analyzer.ts:191-219` passes all 683 generated card rules to the optimizer.
- For every transaction and card, `packages/core/src/optimizer/greedy.ts:39-70` calculates the card result before and after adding the transaction. The `after` path allocates `[...currentTransactions, transaction]`.
- Each calculation walks assigned transactions and calls `findRule`; `packages/core/src/calculator/reward.ts:67-94` allocates a filtered candidate array, sorts it, and calls `rules.indexOf` inside the comparator.
- `packages/core/src/optimizer/greedy.ts:70` fully sorts all 683 scores even though only the best six are retained, and lines 243-244 allocate another filtered array.
- After assignment, `packages/core/src/optimizer/greedy.ts:247-265` recalculates card outputs again for reporting and best-single-card comparison.

The work is at least `2 * cards * transactions` calculator invocations, while the total assigned-history replay grows quadratically with transaction count. All of it runs synchronously on the browser main thread.

**Benchmark**

Using the real 683-card `cards.json` and ordinary categorized transactions on this development host:

| Transactions | Optimizer only |
|---:|---:|
| 100 | 376 ms |
| 250 | 744 ms |
| 500 | 1,660 ms |
| 1,000 | 3,893 ms |

This excludes parsing, categorization, rendering, and slower mobile hardware.

**Concrete failure**

A 500–1,000-row statement can freeze interaction for seconds. Category editing calls the same optimizer again (`apps/web/src/lib/store.svelte.ts:613-619`), repeating the stall.

**Fix**

Pre-index rules by canonical category and compile them once. Maintain incremental per-card cap/tier state so a marginal score does not replay prior transactions. Track only the top six scores without sorting all cards. Move the solver to a Web Worker and expose progress/cancellation. If product semantics permit, prefilter obviously ineligible cards before scoring.

---

### PERF-02 — Every uncached merchant miss scans 12,740 static keywords and then the taxonomy

**Severity:** High
**Confidence:** High
**Status:** Confirmed by code inspection and local benchmark

**Evidence**

- `packages/core/src/categorizer/matcher.ts:8-19` builds 12,740 effective static keyword entries.
- Exact lookup is O(1), but `packages/core/src/categorizer/matcher.ts:72-91` linearly checks every entry for both forward and reverse substring matches.
- If that misses, `packages/core/src/categorizer/taxonomy.ts:58-107` linearly scans its keyword map up to two more times.
- The LRU holds only 500 keys (`packages/core/src/categorizer/matcher.ts:31-33,129-139`), so larger/high-cardinality statements churn it.

**Benchmark**

Unique unmatched merchant names on this development host:

| Names | Categorization time |
|---:|---:|
| 100 | 255 ms |
| 500 | 604 ms |
| 1,000 | 734 ms |
| 5,000 | 3,684 ms |

The 1,000-row categorization plus optimizer measurements already exceed 4.5 seconds before UI work.

**Concrete failure**

Statements containing issuer-specific merchant suffixes or mostly unique small merchants take the worst path. The shared matcher in `apps/web/src/lib/analyzer.ts:300-337` avoids reconstruction but not the per-name full scan.

**Fix**

Normalize merchant names once, then use a compiled multi-pattern matcher (Aho–Corasick/trie) or token/prefix indexes. Separate forward substring and reverse-fuzzy indexes by length. Cache all unique names for the duration of one analysis rather than evicting at 500. The category-contract cleanup should also remove duplicate/conflicting patterns before compilation.

---

### PERF-03 — Multi-file parsing is unbounded parallel CPU/memory work on the main thread

**Severity:** Medium
**Confidence:** High
**Status:** Confirmed by code inspection; device profiling required

**Evidence**

- Each file may be 10 MB and there is no file-count limit (`apps/web/src/components/upload/FileDropzone.svelte:154-220`).
- Exceeding the 50 MB aggregate threshold only shows a warning and explicitly lets the user proceed (`apps/web/src/components/upload/FileDropzone.svelte:201-205`).
- `apps/web/src/lib/analyzer.ts:325-337` starts every parse concurrently with `Promise.all`.
- `apps/web/src/lib/parser/index.ts:21-94` materializes an ArrayBuffer or full string per file. PDF and SheetJS parsing are CPU-heavy synchronous work after the await.

**Concrete failure**

Ten 10 MB XLSX/PDF files can retain source buffers, decoded text/workbooks, row arrays, parsed transactions, and categorization results at once. Promise concurrency does not create parallel CPU execution in the browser; it increases peak memory while still blocking the main thread.

**Fix**

Enforce a hard aggregate limit or stream files through a bounded queue (one or two at a time). Release parser intermediates before starting the next file. Move PDF/XLSX work to workers and yield between batches. Show per-file progress and allow cancellation.

---

### PERF-04 — Analysis eagerly downloads and transforms the complete catalog for every new session

**Severity:** Medium
**Confidence:** Medium
**Status:** Confirmed code path; network/device impact requires field measurement

**Evidence**

- `apps/web/public/data/cards.json` is 3,421,389 bytes (171,107 bytes with local gzip), containing 683 cards and 2,286 reward rules.
- `apps/web/src/lib/cards.ts:135-185,231-234` fetches and parses the whole object.
- `apps/web/src/lib/analyzer.ts:191-212` copies every rule and every reward/tier into another object graph before optimization.
- The transformation is cached only in memory and invalidated on store reset (`apps/web/src/lib/analyzer.ts:50-89`).

**Concrete failure**

On a cold mobile session the analysis must fetch/parse the entire catalog and allocate both JSON and transformed graphs before scoring can begin. A reset repeats the transformation even though static data did not change.

**Fix**

Generate a compact, calculator-ready artifact with interned category/rule IDs, or shard/index it by candidate category/issuer. Cache the immutable compiled artifact independently of analysis-store reset. Measure transfer decompression, JSON parse, and retained heap on a representative mobile device before choosing sharding.

## Coverage and validation

- Covered all 920 tracked non-`.context` files, including 152 code files, 683 card YAML files, generated JSON, build/config scripts, UI paths, and tests.
- Benchmarks used in-memory Bun execution and real repository artifacts; they did not create files or change source.
- No Playwright, Chrome, browser process, or deployment was started.
- Final sweep checked repeated scans, sorts, allocations, cache bounds, main-thread CPU, file concurrency, catalog transfer, and cleanup/cancellation paths.
