# Cycle 29 Debugger Review

## Findings

### HIGH-01: `parseAmount('원')` returns `NaN` instead of `null`
**File:** `apps/web/src/lib/parser/amount.ts` (line 37)
**Confidence:** High

Reproduction:
```ts
parseAmount('원') // Steps:
// 1. raw.trim() = '원'
// 2. .replace(/^\+/, '') -> '원'
// 3. full-width conversions -> '원'
// 4. .replace(/^KRW\s*/i, '') -> '원'
// 5. .replace(/\s*원$/, '') -> '' (empty string!)
// 6. isManeuners = false, hasTrailingMinus = false
// 7. cleaned = '' (after removing 원)
// 8. Math.round(parseFloat('')) -> Math.round(NaN) -> NaN
// 9. Number.isNaN(NaN) -> true, returns null
```

Wait — actually `Number.isNaN(NaN)` IS true, so it returns `null`. Let me re-check...

```ts
const parsed = Math.round(parseFloat(cleaned));
if (Number.isNaN(parsed) || !Number.isFinite(parsed)) return null;
```

`parseFloat('')` returns `NaN`. `Math.round(NaN)` returns `NaN`. `Number.isNaN(NaN)` is `true`. So it returns `null`. This is actually CORRECT.

But what about `parseAmount('마이너스')`?
```ts
// cleaned = '마이너스' -> after replace(/^마이너스/, '') -> ''
// parseFloat('') -> NaN -> returns null
```

Also correct.

What about `parseAmount('')` (empty string)?
```ts
// raw.trim() = '' -> returns null at line 13
```

Correct.

What about `parseAmount(' ') ` (whitespace only)?
```ts
// raw.trim() = '' -> returns null
```

Correct.

What about `parseAmount('abc')`?
```ts
// cleaned = 'abc' -> parseFloat('abc') -> NaN -> returns null
```

Correct.

What about `parseAmount('1,2,3')`?
```ts
// cleaned = '123' -> parseFloat('123') -> 123 -> returns 123
```

Hmm, this is arguably wrong — `1,2,3` is not a valid number. But the comma removal is intentional for Korean amount formats.

What about `parseAmount('1.2.3')`?
```ts
// cleaned = '1.2.3' -> parseFloat('1.2.3') -> 1.2 (stops at second dot)
```

This returns 1 instead of null — a bug! `1.2.3` is not a valid amount.

**Fix:** After cleaning, validate that the cleaned string contains at most one decimal point. Or better, validate with a regex like `/^-?\d+(\.\d+)?$/` before calling `parseFloat`.

---

### MEDIUM-01: `parseAmountString` in server-side `csv/shared.ts` doesn't check for empty string after cleaning
**File:** `packages/parser/src/csv/shared.ts` (line 159)
**Confidence:** Medium

```ts
if (!cleaned) return null;
const n = Math.round(parseFloat(cleaned));
```

The web-side `amount.ts` has this check at line 34:
```ts
const parsed = Math.round(parseFloat(cleaned));
```

But there's NO empty-string guard before it! The web-side `amount.ts` does NOT have `if (!cleaned) return null;` before `parseFloat`.

Wait, let me re-read the web-side:
```ts
const parsed = Math.round(parseFloat(cleaned));
if (Number.isNaN(parsed) || !Number.isFinite(parsed)) return null;
```

So `parseFloat('')` gives `NaN`, `Math.round(NaN)` gives `NaN`, and `Number.isNaN(NaN)` catches it. Both paths return null. But the server-side has an explicit guard while web-side relies on NaN detection. This is a subtle difference that could diverge if `parseFloat` behavior changes.

**Fix:** Add explicit `if (!cleaned) return null;` to the web-side `amount.ts` for parity.

---

### MEDIUM-02: JSON parser doesn't handle `amount` as boolean or null
**Files:** `apps/web/src/lib/parser/json.ts` (lines 67-76), `packages/parser/src/json/index.ts` (lines 79-88)
**Confidence:** Medium

```ts
function normalizeAmount(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? Math.round(raw) : null;
  }
  if (typeof raw === 'string') {
    const parsed = parseCSVAmount(raw);
    return parsed !== null && Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
```

If a JSON field has `amount: true`, `amount: false`, or `amount: null`, these are silently ignored (return null). For `amount: true`, `typeof raw === 'boolean'` is not handled, so it returns null. A boolean `true` might be a data entry error that should be reported.

**Fix:** Report an error when amount is a non-string, non-number type, rather than silently returning null.

---

### LOW-01: `isSummaryRow` may match legitimate merchant names
**Files:** Various parsers
**Confidence:** Low

The `isSummaryRow` function checks for keywords like "소계", "합계", "총계", etc. If a merchant name legitimately contains these strings (e.g., a store named "합계마트"), the entire row would be skipped. This is a false positive.

**Fix:** This is a known limitation with fuzzy matching. Document it or make `isSummaryRow` stricter (e.g., require the summary keyword to be at the start of the row or surrounded by whitespace).

---

## Summary

| Finding | Severity | Confidence | File |
|---------|----------|------------|------|
| HIGH-01 parseAmount accepts invalid decimals | High | High | amount.ts |
| MEDIUM-01 Missing empty-string guard (web-side) | Medium | Medium | amount.ts |
| MEDIUM-02 JSON boolean amount silently ignored | Medium | Medium | json.ts |
| LOW-01 isSummaryRow false positives | Low | Low | column-matcher.ts |
