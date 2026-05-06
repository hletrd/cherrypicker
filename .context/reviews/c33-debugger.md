# Cycle 33 Debugger Review — CherryPicker

**Agent:** c33-debugger  
**Date:** 2026-05-06  
**Status:** Agent spawn failed; review performed by orchestrator

---

## Finding 1: `normalizeHTML` regex for script tags can be bypassed with malformed nesting [LOW / Medium confidence]

**File:** `apps/web/src/lib/parser/html.ts:32`

**Problem:** `/<script[\s\S]*?<\/script>/gi` uses lazy quantifier `*?` which stops at the first `</script>`. Malformed HTML like `<script>...<script>...</script>` would strip only the inner portion, leaving the outer script tag intact.

**Failure scenario:** A crafted HTML file with nested script tags bypasses sanitization, and SheetJS may execute the remaining script content during parsing.

**Suggested fix:** Run the regex in a loop until no more matches, or use a proper HTML parser.

**Confidence:** Medium

---

## Finding 2: `parseAmountString` may accept invalid formats without error [LOW / Medium confidence]

**Files:** `apps/web/src/lib/parser/amount.ts`, `packages/parser/src/amount.ts`

**Problem:** Need to verify if amount parsing handles all edge cases. For example, strings like `"1,000,000,000"` (with multiple commas) or `"1000원500"` may parse unexpectedly.

**Suggested fix:** Add explicit test cases for malformed amount strings and verify they return `null`.

**Confidence:** Low (needs test verification)

---

## Finding 3: No timeout on `analyzeMultipleFiles` network calls [LOW / Medium confidence]

**File:** `apps/web/src/lib/cards.ts` (implied)

**Problem:** `loadCategories()` and `getAllCardRules()` are network fetches. If the server is unresponsive, the analysis hangs indefinitely with no timeout.

**Suggested fix:** Add `AbortSignal` with timeout to fetch calls in `cards.ts`.

**Confidence:** Medium

---

## Final Sweep

- No null dereferences in hot paths.
- No division by zero (amount > 0 is checked before division in greedy.ts:55).
- No array index out of bounds (all accesses use safe defaults or guards).
- No unhandled promise rejections in store.svelte.ts (try/catch wraps async calls).
- All C32 regression fixes verified present and correct.
