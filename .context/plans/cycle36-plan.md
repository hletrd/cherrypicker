# Cycle 36 Implementation Plan

**Date:** 2026-05-06
**Source reviews:** `.context/reviews/_aggregate.md`, `.context/reviews/{code-reviewer,security-reviewer,perf-reviewer}.md`
**Status:** In Progress

---

## Quick Wins (Low Risk, High Confidence)

### Task 1: Add zero-amount guard in `scoreCardsForTransaction` [CR-05]
- **File:** `packages/core/src/optimizer/greedy.ts:39-50`
- **Change:** Add `if (transaction.amount <= 0 || !Number.isFinite(transaction.amount)) return [];` at function top
- **Risk:** None — defensive guard, already pre-filtered upstream
- **Tests:** Existing optimizer tests should pass; add explicit test for zero-amount tx

### Task 2: Fix Windows path bug in CLI tools [CR-09]
- **Files:** `tools/cli/src/commands/analyze.ts`, `tools/cli/src/commands/optimize.ts`, `tools/cli/src/commands/report.ts`
- **Change:** Replace `new URL('../../../..', import.meta.url).pathname` with `fileURLToPath(new URL('../../../..', import.meta.url))`
- **Risk:** Low — `fileURLToPath` is the standard Node.js solution for cross-platform paths
- **Tests:** N/A (no Windows CI currently)

### Task 3: Update hardcoded model name in scraper [CR-10]
- **File:** `tools/scraper/src/extractor.ts:34`
- **Change:** Replace `claude-sonnet-4-6` with `claude-sonnet-4-20250514` (or env-driven)
- **Risk:** Low — model name update only; no logic change
- **Tests:** N/A

### Task 4: Fix CP949 detection for small buffers [CR-12]
- **File:** `packages/parser/src/detect.ts:43`
- **Change:** Add `scanLen >= 1024` guard before ratio calculation, OR use absolute threshold `cp949SignalBytes > 10`
- **Risk:** Low — only affects files < 1KB with high-byte content
- **Tests:** Add test with 100-byte pseudo-CP949 buffer

### Task 5: Tighten Anthropic API key regex [SEC-04]
- **File:** `packages/parser/src/pdf/llm-fallback.ts:66`
- **Change:** Update regex from `sk-ant-api00-[a-zA-Z0-9_-]{30,}` to `sk-ant-api03-[a-zA-Z0-9_-]{90,}` (current format)
- **Risk:** Low — only affects validation error message
- **Tests:** Add test for valid/invalid key formats

### Task 6: Add max-size guard before LLM fallback [SEC-03]
- **File:** `packages/parser/src/pdf/llm-fallback.ts:77-79`
- **Change:** Add `if (text.length > 50000) throw new Error('PDF text too large for LLM processing');` before truncation
- **Risk:** Low — prevents memory pressure from massive PDFs
- **Tests:** Add test with oversized text

### Task 7: Add timeout to static JSON fetches [CR-14]
- **File:** `apps/web/src/lib/cards.ts`
- **Change:** Add `setTimeout(() => controller.abort(), 10000)` in both `loadCardsData` and `loadCategories`
- **Risk:** Low — standard fetch timeout pattern
- **Tests:** N/A

### Task 8: Validate categoryLabels Map is non-empty [CR-08]
- **File:** `apps/web/src/lib/analyzer.ts:260-265`
- **Change:** Add `if (categoryLabels.size === 0) throw new Error(...)` before passing to optimizer
- **Risk:** Low — already fails silently; this makes it explicit
- **Tests:** N/A

---

## Medium Complexity (Type/Interface Changes Required)

### Task 9: Surface JSON.parse errors in detect.ts [CR-01]
- **File:** `packages/parser/src/detect.ts:286-295`
- **Change:** DetectionResult needs an `errors` field; catch block should populate it with a ParseError instead of silently defaulting to CSV
- **Risk:** Medium — changes DetectionResult interface; consumers must handle new field
- **Tests:** Add test for malformed JSON sniffing

### Task 10: Surface parse errors in HTML parser [CR-02]
- **File:** `packages/parser/src/html/index.ts:48`
- **Change:** Return caught error in `errors` array instead of empty array
- **Risk:** Medium — changes return shape for error cases
- **Tests:** Add test for HTML parse failure

---

## Higher Complexity (Architectural Changes)

### Task 11: Surface non-KRW skipped transactions [SEC-07]
- **File:** `packages/core/src/calculator/reward.ts:220`, `packages/core/src/models/result.ts`
- **Change:** Add `skippedTransactions: {id, reason}[]` to CalculationOutput; populate when non-KRW tx is skipped
- **Risk:** Medium — changes public API of calculateRewards; web UI needs to display skipped tx
- **Tests:** Add test for non-KRW tx being tracked in skipped array
- **Note:** Web UI display is optional for this cycle; plumbing the data through is the goal

### Task 12: Optimize `cardPreviousSpending` calculation [PERF-06]
- **File:** `apps/web/src/lib/analyzer.ts:224-250`
- **Change:** Single-pass pre-computation: build Map of category->spending, then each card sums categories minus exclusions
- **Risk:** Medium — same output, different algorithm; verify with optimizer tests
- **Tests:** Existing optimizer tests should confirm identical results

---

## Deferred to Future Cycles

| Finding | Severity | Reason | Exit Criterion |
|---------|----------|--------|----------------|
| SEC-01 (CSP nonce) | Medium | Requires Astro build-time nonce generation and injection into all inline scripts/styles | Dedicated security cycle |
| CR-15 (ReDoS) | Medium | Regex decomposition requires understanding all Korean summary row patterns; high regression risk | Dedicated parser hardening cycle |
| CR-11/PERF-08 (buffer reuse/header-only read) | Low | Requires refactor of parseStatement signature to accept Buffer; touches many call sites | Parser API refactor cycle |
| CR-13 (any->unknown) | Low | Store.svelte.ts uses `any` in multiple places; full fix requires Zod schema for storage | Store refactoring cycle |
| CR-16 (cancellation) | Low | Requires AbortController or Promise tracking across async boundaries; UX design needed | UX/async cycle |
| PERF-03 (pre-size arrays) | Low | Micro-optimization; real-world impact unproven | Benchmark cycle |
| PERF-04 (debounce dropzone) | Low | UX enhancement; not correctness-critical | UX cycle |
| PERF-05 (debounce persist) | Low | UX enhancement; current behavior is correct if janky | UX cycle |
| PERF-07 (Trie matcher) | Low | Large algorithmic change; needs benchmarking | Benchmark cycle |
| SEC-06 (LLM sanitizer) | Low | Replace regex with allowlist sanitizer; requires dependency addition | Security hardening cycle |
| SEC-08 (sessionStorage encryption) | Low | Deferred per Cycle 35 | Security audit |
| PERF-01 (keywords.ts bundle) | Low | Deferred per Cycle 35 | Bundle analysis |
| PERF-02 (optimizer incremental) | Medium | Deferred per Cycle 35 | Benchmarking |
| CR-07/CR-17 (type unification, parser dedup) | Low-Medium | Deferred per Cycle 35 | Dedicated refactor cycle |

---

## Implementation Order

1. Tasks 1-8 (quick wins) — parallel where possible
2. Tasks 9-10 (medium complexity) — sequential, type changes first
3. Tasks 11-12 (higher complexity) — after quick wins stabilize
4. Run gates after each task group
5. Commit each task separately with semantic messages
