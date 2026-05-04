# Cycle 20 Comprehensive Review

**Date:** 2026-05-05
**Reviewer:** comprehensive (all-in-one)
**Scope:** Full parser package deep review after 19 cycles

## Summary

After 19 cycles of improvements, the parser package is mature with 489 bun + 233 vitest tests passing. Three actionable format-diversity bugs remain.

## Findings

### F20-01: Server PDF fallback drops parenthesized amounts (BUG - HIGH)

**File:** `packages/parser/src/pdf/index.ts` line 284

The fallback line scanner's regex `/\([\d,]+\)|([\d,]+)원?/g` has a capture group issue. For parenthesized amounts like `(1,234)`, the regex matches but `amountMatch[1]` (the unnamed capture group `([\d,]+)`) is `undefined`. The code at line 306 does `const amountRaw = amountMatch[1]!;` which passes `undefined` to `parseAmount()`.

The `parseAmount(undefined)` flow:
1. `raw.replace(/원$/, '')` coerces undefined to `"undefined"`, returns `"undefined"`
2. After all replacements, `parseFloat("undefined")` returns `NaN`
3. `parseAmount` returns `null`
4. The error path checks `cleaned && !/^0+$/.test(cleaned)` -- `cleaned = "undefined"`, truthy, not all zeros
5. But wait -- `amountRaw` was `undefined` when used as `amountRaw.replace(...)`, which also produces "undefined"
6. The error IS pushed but with message containing "undefined" instead of the actual amount

Actually, re-checking: `amountRaw = amountMatch[1]!` -- for parenthesized matches, group 1 doesn't participate. `undefined!.replace(...)` would throw in strict mode, but in JS `String(undefined).replace(...)` gives "undefined". Since `!` is a TS non-null assertion (no runtime effect), the value is truly `undefined`.

At line 311: `amountRaw.replace(/원$/, '').replace(/,/g, '').trim()` -- calling `.replace` on `undefined` would throw a TypeError at runtime. This means parenthesized amounts cause a runtime crash in the fallback scanner, which is caught by the try/catch in the outer function or crashes silently.

**Fix:** Change regex to `/\([\d,]+\)|([\d,]+)원?/g` and use `amountMatch[0]` for the full match, or adjust capture group.

### F20-02: CSV isDateLike false-positive on decimal amounts (MEDIUM)

**Files:** `packages/parser/src/csv/generic.ts` line 24, `apps/web/src/lib/parser/csv.ts` line 128

The `DATE_PATTERNS` array includes:
```
/^\d{1,2}[\s]*[.\-\/][\s]*\d{1,2}$/  // 01/15, "1 / 5" (MM/DD)
```

This matches decimal numbers like `3.5`, `12.34`, `9.99` which are NOT dates but decimal amounts. The PDF parser validates short dates with `isValidShortDate()` to reject impossible day values (e.g., month 12 day 34), but the CSV generic parser has no such validation.

When header detection fails and column detection falls back to data inference, a column containing decimal amounts could be misidentified as a date column via `isDateLike()`. This would set `dateCol` to the amount column and prevent `amountCol` from being set (since the else-if chain skips amount when date matches first).

**Impact:** Only affects CSV files where header detection fails AND the file contains decimal amounts. Low frequency but high consequence (zero transactions parsed).

**Fix:** Add short-date validation to `isDateLike` in both server and web CSV parsers, or add a negative lookahead for decimal-like patterns.

### F20-03: normalizeHeader missing fullwidth space (LOW)

**Files:** `packages/parser/src/csv/column-matcher.ts` line 12, `apps/web/src/lib/parser/column-matcher.ts` line 16

The `normalizeHeader` function strips various invisible Unicode characters but misses fullwidth space (U+3000, `　`), which is common in East Asian text. Korean bank exports occasionally use fullwidth spaces in column headers.

Current regex: `/[​‌‍­　\t\n\r]/g` -- the `　` (ideographic space) IS actually present (the `　` character at the 5th position). On closer inspection, this is already handled.

**Status:** FALSE POSITIVE -- fullwidth space is already in the character class.

### F20-04: Web CSV parseAmount missing internal whitespace stripping (LOW)

**File:** `apps/web/src/lib/parser/csv.ts` line 68-79

The web-side CSV `parseAmount` does NOT strip internal whitespace from the raw string before parsing. The server-side `parseCSVAmount` in `packages/parser/src/csv/shared.ts` does strip whitespace (`/\s/g`).

```typescript
// Server (shared.ts line 37):
let cleaned = raw.trim().replace(/원$/, '').replace(/[₩￦]/g, '').replace(/,/g, '').replace(/\s/g, '');

// Web (csv.ts line 68-72):
let cleaned = raw.trim();
// ... handles negatives ...
cleaned = cleaned.replace(/원$/, '').replace(/[₩￦]/g, '').replace(/,/g, '').replace(/\s/g, '');
```

Wait -- actually the web side DOES strip whitespace (`.replace(/\s/g, '')` at line 72). The order is different (trim happens before negative detection on web, after on server) but the end result is equivalent for well-formed inputs.

**Status:** NOT A BUG -- whitespace stripping is present in both.

### F20-05: Server/web CSV adapter duplication (ARCHITECTURE - DEFERRED)

The web-side `apps/web/src/lib/parser/csv.ts` has 10 hand-written bank adapters (~700 lines) that duplicate the server-side factory pattern in `packages/parser/src/csv/adapter-factory.ts`. The server side uses `createBankAdapter()` factory to reduce 10 adapters to config objects. The web side could use the same pattern but is constrained by different build systems (Astro/Vite vs Bun).

**Status:** DEFERRED -- architectural, not a parser format issue.

## New Findings Count: 2 actionable (F20-01, F20-02)

## Test Status
- **Bun tests:** 489 pass, 0 fail
- **Vitest tests:** 233 pass, 0 fail