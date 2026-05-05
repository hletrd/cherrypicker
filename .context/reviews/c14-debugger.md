# Cycle 14 Debugger Review

## Findings

### C14-DB01: `isValidISODate` false-positive on invalid dates (HIGH)
- **Files:** `packages/parser/src/date-utils.ts:228`, `apps/web/src/lib/parser/date-utils.ts:242`
- **Description:** The `isValidISODate` function uses a format-only regex. Invalid dates like "2024-99-99", "0000-00-00", "1234-56-78" all pass validation. Downstream code in parsers assumes `isValidISODate === true` means the date is genuinely usable.
- **Failure scenario:** See C14-01. The transaction survives into the result array with an invalid date, bypassing error reporting. Later, date-based filtering (`startsWith`, `.sort()`) produces unexpected ordering or silent exclusion.
- **Fix:** Add month/day range validation.
- **Confidence:** High

### C14-DB02: Web-side `parseAmount` uses `parseFloat` on cleaned string (LOW)
- **File:** `apps/web/src/lib/parser/pdf.ts:271`
- **Description:** `parseFloat("1.2.3")` returns `1.2`, silently truncating malformed input. While `isFinite` and `isNaN` checks catch some cases, `parseFloat` is tolerant of trailing garbage.
- **Failure scenario:** A PDF with corrupted amount text "1,234.56.78" gets cleaned to "1234.56.78", `parseFloat` returns `1234.56`, and the transaction is accepted with a wrong amount.
- **Fix:** After cleaning, validate that the string contains at most one decimal point before calling `parseFloat`.
- **Confidence:** Low

### C14-DB03: `toCoreCardRuleSets` fallback values bypass type safety (MEDIUM)
- **File:** `apps/web/src/lib/analyzer.ts:58, 64`
- **Description:** When `rule.card.source` or `r.type` is unrecognized, the code falls back to `'web'` and `'discount'` respectively. But these fallback values are arbitrary and may produce incorrect optimization results if the actual data has different semantics.
- **Failure scenario:** A newly scraped card rule has `type: 'miles'` (not in `VALID_REWARD_TYPES`). The optimizer treats it as `'discount'`, potentially recommending the card for categories where it offers poor value.
- **Fix:** Consider rejecting unknown types with an explicit error rather than silently normalizing.
- **Confidence:** Medium
