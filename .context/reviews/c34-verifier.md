# Cycle 34 — Verifier Findings

**Date:** 2026-05-06
**Scope:** Evidence-based correctness checks

---

## Verification Results

### C33-F5 (getCalcFn throw)
- **Status:** VERIFIED FIXED
- **Evidence:** `packages/core/src/calculator/reward.ts:110` throws `Error('Unknown reward type: ...')`. Test at `packages/core/__tests__/calculator.test.ts:775` passes.

### C33-F9 (Security headers)
- **Status:** VERIFIED FIXED
- **Evidence:** `Layout.astro:52-53` contains `<meta http-equiv="X-Frame-Options" content="DENY" />` and `<meta http-equiv="X-Content-Type-Options" content="nosniff" />`.

### C33-F10 (previousMonthSpending negative)
- **Status:** VERIFIED FIXED
- **Evidence:** `FileDropzone.svelte:295` rejects `raw < 0`. `store.svelte.ts:578` checks `options.previousMonthSpending >= 0`.

### C33-F3 (LLM sanitization)
- **Status:** VERIFIED FIXED
- **Evidence:** `llm-fallback.ts:77-79` calls `sanitizeLLMInput()` before interpolating into prompt.

### C33-F11 (HTML sanitization loop)
- **Status:** VERIFIED FIXED
- **Evidence:** `html.ts:33-35` runs while-loop for nested script tags.

---

## New Verification: Analyzer Adapter Fallbacks

- **File:** `apps/web/src/lib/analyzer.ts:65-67,71-73`
- **Finding:** Both `source` and `type` fallbacks are fail-open (silent default) rather than fail-closed (throw/warn).
- **Evidence:**
  - Line 65-67: `VALID_SOURCES.has(rule.card.source) ? ... : 'web'`
  - Line 71-73: `VALID_REWARD_TYPES.has(r.type) ? ... : 'discount'`
- **Correctness Impact:** HIGH for reward type fallback (N1). A typo'd reward type produces incorrect calculations.

---

## Cross-Cycle Consistency

- No regressions introduced in previously fixed items.
- All 213 tests passing.
