# Cycle 22 — Test Engineer

**Date:** 2026-05-05
**Scope:** packages/parser/__tests__/, apps/web/__tests__/
**Previous:** 21 cycles completed; 499 bun + 239 vitest tests passing

---

## Finding C22-TEST01: No test for HTML event handler sanitization [LOW]

**File:** `apps/web/src/lib/parser/html.ts` (no corresponding test)

**Problem:** The `normalizeHTML` function performs security-relevant sanitization:
- Strips `<script>` tags and contents
- Strips `<style>` tags and contents
- Strips `<iframe>`, `<object>`, `<embed>` tags
- Removes event handler attributes (`onclick`, `onerror`, etc.)
- Fixes malformed closing tags

There are no unit tests verifying that these sanitization behaviors work correctly. A regression in the regex patterns (e.g., accidental removal of the event-handler regex) would not be caught by existing tests.

**Fix:** Add tests in `apps/web/__tests__/parser-html.test.ts` (or create it):
```ts
expect(normalizeHTML('<td onclick="alert(1)">value</td>')).not.toContain('onclick');
expect(normalizeHTML('<script>alert(1)</script>')).not.toContain('<script>');
expect(normalizeHTML('<iframe src="evil"></iframe>')).not.toContain('<iframe>');
```

**Confidence:** High

---

## Finding C22-TEST02: No test for sessionStorage truncation path [LOW]

**File:** `apps/web/src/lib/store.svelte.ts:170-176`

**Problem:** The truncation logic that omits transactions when the serialized payload exceeds `MAX_PERSIST_SIZE` is not exercised by any test. The `_truncatedTxCount` field and the `truncated` persist warning kind are set in production code but not verified.

**Fix:** Add a test that creates an `AnalysisResult` with enough transactions to exceed `MAX_PERSIST_SIZE`, calls `persistToStorage`, and verifies:
1. `kind === 'truncated'`
2. `truncatedTxCount` matches the transaction count
3. The persisted data lacks the `transactions` key

**Confidence:** High

---

## Finding C22-TEST03: No test for full-width dot in date parsing [LOW]

**File:** `packages/parser/src/date-utils.ts` / `apps/web/src/lib/parser/date-utils.ts`

**Problem:** The date patterns were updated in a previous cycle (C22-01) to support full-width dots (`．`, U+FF0E) and ideographic full stops (`。`, U+3002). However, there is no explicit test verifying that dates like `2024．01．15` or `2024。01。15` parse correctly.

**Fix:** Add test cases to `packages/parser/__tests__/date-utils.test.ts` and `apps/web/__tests__/parser-date.test.ts` for full-width dot separators.

**Confidence:** High

---

## Test Coverage Assessment

| Area | Coverage | Gaps |
|------|----------|------|
| CSV parsing | Good | Full-width dot dates (C22-TEST03) |
| XLSX parsing | Good | None |
| PDF parsing | Good | None |
| OFX parsing | Good | None |
| JSON parsing | Good | None |
| HTML parsing | Partial | Event handler sanitization (C22-TEST01) |
| Date utils | Good | Full-width dot dates (C22-TEST03) |
| Format detection | Good | None |
| Web store | Partial | Truncation path (C22-TEST02) |

---

## Regressions

None found. All tests pass.
