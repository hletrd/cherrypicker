# Cycle 1 — LOW Priority Fixes

Source: `.context/reviews/_aggregate.md` findings C1-02, C1-03, U1-02, T1-01, T1-02.

## Task 1: Server-side detectCSVDelimiter 30-line limit (C1-02)

**Finding:** `packages/parser/src/detect.ts:148-165` — `detectCSVDelimiter` scans all lines. The web version limits to 30 lines (C83-05). For large CSV files, the server version does unnecessary O(n) work.

**Fix:** Add `.slice(0, 30)` to the lines array before the counting loop.

```ts
// Before:
const lines = content.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

// After:
const lines = content.split('\n').map((l) => l.trim()).filter((l) => l.length > 0).slice(0, 30);
```

## Task 2: toCoreCardRuleSets console.warn on fallback (C1-03)

**Finding:** `apps/web/src/lib/analyzer.ts:55-58` — Unknown `source` values silently fall back to `'web'`. Same for unknown `type` values falling back to `'discount'`. Misleading for scraped cards.

**Fix:** Add `console.warn` when a fallback is applied.

```ts
source: VALID_SOURCES.has(rule.card.source)
  ? (rule.card.source as 'manual' | 'llm-scrape' | 'web')
  : (console.warn(`Unknown card source "${rule.card.source}" for card ${rule.card.id}, falling back to "web"`), 'web'),
```

Same pattern for reward types.

## Task 3: FileDropzone number input stepper arrows (U1-02)

**Finding:** `apps/web/src/components/upload/FileDropzone.svelte:494-503` — `<input type="number">` shows stepper arrows on mobile, which are useless for Korean Won amounts.

**Fix:** Add CSS to hide stepper arrows. Add `inputmode="numeric"` for better mobile keyboard.

In `apps/web/src/app.css` or the component's scoped styles:
```css
/* Hide number input stepper arrows — Korean Won amounts don't need +/- 1 */
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type="number"] {
  -moz-appearance: textfield;
}
```

Also add `inputmode="numeric"` to the input element for better mobile keyboard display.

## Task 4: Test for CardDetail abort-then-labels (T1-01)

**Finding:** No unit or E2E test for CardDetail's abort-then-labels scenario.

**Fix:** Add a test in the E2E suite that navigates to CardDetail and aborts the category fetch, verifying that Korean labels are still shown (from the fallback map added in Task 1 of the high-priority plan).

This task is blocked by the high-priority Task 1 (C1-01) fix. It should be implemented after the fallback map is in place.

## Task 5: Test for detectCSVDelimiter 30-line limit (T1-02)

**Finding:** No test verifying the 30-line limit in server-side `detectCSVDelimiter`.

**Fix:** Add a test case in `packages/parser/__tests__/detect.test.ts` with a 1000-line CSV input, verifying that delimiter detection works correctly without scanning all lines (i.e., the result is the same as scanning all lines for typical inputs).
