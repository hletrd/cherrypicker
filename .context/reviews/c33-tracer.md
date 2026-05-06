# Cycle 33 Tracer Review — CherryPicker

**Agent:** c33-tracer  
**Date:** 2026-05-06  
**Status:** Agent spawn failed; review performed by orchestrator

---

## Finding 1: LLM fallback data flow has validation gaps at multiple checkpoints [MEDIUM / High confidence]

**Flow:** PDF text → `parsePDFWithLLM` → LLM API → JSON extraction → `LLMTransaction[]` → `RawTransaction[]`

**File:** `packages/parser/src/pdf/llm-fallback.ts`

**Problem:** The flow has these gaps:
1. Raw PDF text is not sanitized before being sent to LLM (prompt injection risk)
2. LLM response JSON is extracted via regex, not a proper JSON parser with recovery
3. Structural validation checks `typeof tx.date === 'string'` but doesn't validate `merchant` content
4. No checksum or integrity verification of the parsed result

**Failure scenario:** A PDF with embedded prompt injection text → LLM returns manipulated JSON → regex extracts it → validation passes (dates look valid, amounts are positive) → fake transactions enter the optimization pipeline.

**Suggested fix:** Add a signature/integrity check by hashing the original PDF and comparing with a trusted source. Sanitize LLM inputs.

**Confidence:** High

---

## Finding 2: `previousMonthSpendingOption` flows through analyze → reoptimize without upper-bound validation [LOW / Medium confidence]

**Flow:** User input → `analyzeMultipleFiles` → `analysisResult.previousMonthSpendingOption` → `reoptimize` → `optimizeFromTransactions` → `selectTier`

**File:** `apps/web/src/lib/store.svelte.ts:480,567-569`, `apps/web/src/lib/analyzer.ts:226`

**Problem:** The value is forwarded faithfully but never clamped or validated against reasonable bounds. A value of `1e15` would cause all tiers to match (since all `minSpending` are below this).

**Suggested fix:** Add a reasonable upper bound (e.g., 1 billion Won) in the analyze options validation.

**Confidence:** Medium

---

## Finding 3: Category label loading failure path traced — missing fallback [LOW / Medium confidence]

**Flow:** `loadCategories()` → network fetch → `[]` on AbortError → `throw` in `parseAndCategorize`

**File:** `apps/web/src/lib/analyzer.ts:127-129`

**Problem:** If `loadCategories()` returns `[]` (e.g., network timeout), the analyzer throws. But the error message is in Korean and may not be actionable for non-Korean speakers.

**Suggested fix:** Provide a fallback static category map for offline usage.

**Confidence:** Low

---

## Final Sweep

- No hidden state leaks between analyze calls (snapshot pattern at store.svelte.ts:520 prevents this).
- No race conditions in the store (Svelte 5 $state is synchronous).
- Transaction IDs include file index prefix, preventing collisions (analyzer.ts:141).
