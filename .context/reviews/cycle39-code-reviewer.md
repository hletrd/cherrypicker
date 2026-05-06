# Code Review — CherryPicker Cycle 39

**Reviewer:** code-reviewer (manual, Agent tool unavailable)
**Date:** 2026-05-06
**Cycle:** 39 / 100
**HEAD:** d265c46

---

## Findings

### CR-39-01 — Medium — `parseAmountString` silently ignores trailing alphabetic characters

**File:** `packages/parser/src/csv/shared.ts:175-178`
**File:** `apps/web/src/lib/parser/amount.ts` (same pattern)

The `parseAmountString` function strips and parses amount strings. After extracting the numeric prefix with `/^[+-]?\d+(?:\.\d+)?/`, it checks if the remaining characters contain digits or dots:

```typescript
const afterNum = cleaned.slice(numMatch[0].length);
if (/[\d.]/.test(afterNum)) return null;
```

**Problem:** This only rejects trailing digits and dots. Other characters (letters, symbols) are silently ignored by `parseFloat`. For example:
- `"1234abc"` → `parseFloat` returns `1234`, accepted as valid
- `"50000원금"` → `parseFloat` returns `50000`, accepted as valid
- `"10000!!!"` → `parseFloat` returns `10000`, accepted as valid

**Expected:** Any trailing non-whitespace characters after the numeric prefix should be rejected, since they indicate malformed input.

**Fix:** Change the check to reject any non-empty trailing content:
```typescript
if (afterNum.trim().length > 0) return null;
```

**Confidence:** High

---

### CR-39-02 — Low — ParseError for non-spending amounts uses empty merchant name

**File:** `packages/parser/src/xlsx/index.ts:416-422`
**File:** `apps/web/src/lib/parser/xlsx.ts:592-598`

When amount <= 0, the error message formats `merchantRaw` which may be an empty string:
```typescript
`지출로 처리되지 않는 금액입니다: ${String(merchantRaw ?? '').trim() || '알 수 없는 거래'} ${amount}원`
```

**Problem:** When `merchantRaw` is empty and `amount` is 0, the message reads: "지출로 처리되지 않는 금액입니다: 알 수 없는 거래 0원". The raw amount value (not the parsed amount) would be more useful for debugging.

**Fix:** Include the raw amount string in the error message to help users identify which row was filtered.

**Confidence:** Low

---

### CR-39-03 — Low — Web-side `parseFile` doesn't propagate detection errors

**File:** `apps/web/src/lib/parser/index.ts:21-101`

The web-side `parseFile` function calls `detectFormatFromFile` which returns only the format string, not any errors encountered during detection. The server-side `detectFormat` in `packages/parser/src/detect.ts:243-337` returns a `DetectionResult` with an `errors` array that captures JSON.parse failures during format sniffing.

**Problem:** When a file starts with `[` or `{` but isn't valid JSON, the server-side parser reports the JSON.parse error to the user. The web-side parser silently falls back to CSV without any error indication.

**Fix:** Make `detectFormatFromFile` return errors alongside the format, or add a similar error-capture mechanism.

**Confidence:** Medium

---

## Carryover Status

| ID | Status | Notes |
|----|--------|-------|
| CR-01 | FIXED | JSON.parse errors now surfaced in detect.ts |
| CR-02 | FIXED | HTML parse errors returned in result |
| CR-09 | FIXED | fileURLToPath used in CLI commands |
| CR-10 | FIXED | Model name env-driven |
| CR-15 | OPEN | SUMMARY_ROW_PATTERN ReDoS risk still present |
