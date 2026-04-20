# Cycle 34 Comprehensive Code Review -- 2026-04-22

**Scope:** Full re-read of all source files in `apps/web/src/`, `packages/core/src/`, `packages/rules/src/`, `packages/parser/src/`, `packages/viz/src/`, verification of all prior open findings, targeted pattern search for new issues.

---

## Verification of Prior Cycle Fixes

All previously open findings from the aggregate were verified against current source code:

| Finding | Status | Evidence |
|---|---|---|
| C7-04 | OPEN (LOW) | TransactionReview `$effect` re-sync still uses `generation` counter pattern |
| C7-06 | OPEN (LOW) | `analyzer.ts:329` still filters to latest month; `transactions` field includes all months |
| C7-07 | OPEN (LOW) | `BANK_SIGNATURES` duplicated between `apps/web/src/lib/parser/detect.ts` and `packages/parser/src/detect.ts` |
| C7-11 | OPEN (LOW) | `store.svelte.ts:156` persist warning message for 'corrupted' says "거래 내역을 불러오지 못했어요" -- could be more specific |
| C8-05/C4-09 | OPEN (LOW) | `CategoryBreakdown.svelte:6-49` still uses hardcoded `CATEGORY_COLORS` -- utility colors fixed (C29-01) |
| C8-07/C4-14 | OPEN (LOW) | `build-stats.ts:16-18` still has hardcoded fallback values `683/24/45` |
| C8-08 | OPEN (LOW) | `inferYear()` in `date-utils.ts:20` -- timezone-dependent near midnight Dec 31 |
| C8-09 | OPEN (LOW) | Test files still duplicate production code |
| C18-01 | OPEN (MEDIUM) | `VisibilityToggle.svelte:26-78` -- $effect with DOM manipulation. Has cached element refs with isConnected check but pattern remains fragile |
| C18-02 | OPEN (LOW) | `VisibilityToggle.svelte:38-58` -- stat element queries guarded but effect still runs on dashboard page |
| C18-03 | OPEN (LOW) | `SavingsComparison.svelte:218` annual projection still multiplies by 12 |
| C18-04 | OPEN (LOW) | `xlsx.ts:247` `isHTMLContent()` still only checks first 512 bytes |
| C19-04 | OPEN (LOW) | `FileDropzone.svelte:220` still uses `window.location.href` for navigation |
| C19-05 | OPEN (LOW) | `CardDetail.svelte:276` still uses `window.location.href` for navigation |
| C21-02 | OPEN (LOW) | cards.ts shared fetch AbortSignal race (deferred) |
| C21-04/C23-02/C25-02/C26-03 | OPEN (LOW->MEDIUM) | cachedCategoryLabels/cachedCoreRules invalidated on explicit reset but stale across long-lived tabs |
| C22-04 | OPEN (LOW) | CSV adapter registry only covers 10 of 24 detected banks |
| C22-05 | OPEN (LOW) | TransactionReview changeCategory O(n) array copy |
| C24-06 | OPEN (LOW) | buildCardResults totalSpending no negative amount guard (safe in practice) |
| C27-02 | OPEN (LOW) | Duplicate NaN/zero checks in parseGenericCSV vs isValidAmount() |
| C31-01 | OPEN (LOW) | SpendingSummary dismiss catch now has console.warn -- FIXED this cycle during verification |
| C31-02 | OPEN (LOW) | Redundant Map.set() in greedyOptimize -- FIXED in current code (C31-02 pattern replaced with if/else) |
| C33-01 | OPEN (MEDIUM) | MerchantMatcher substring scan -- SUBSTRING_SAFE_ENTRIES pre-computed at module level (partially fixed) |
| C33-02 | OPEN (MEDIUM) | cachedCategoryLabels stale across redeployments |
| C33-04 | OPEN (LOW) | splitCSVLine doubled-quote parity -- FIXED in current server-side code (line 142 now handles `""`) |
| C33-06 | OPEN (LOW) | buildCardResults Math.abs -- FIXED in current code (line 226 now uses `tx.amount` directly) |

### Fixes confirmed this cycle

| Finding | Status | Evidence |
|---|---|---|
| C31-01 | FIXED | `SpendingSummary.svelte:147` dismiss catch now logs `console.warn` when sessionStorage is available |
| C31-02 | FIXED | `greedy.ts:290-296` now uses if/else pattern: only `.set()` on first insertion |
| C33-04 | FIXED | `generic.ts:142` now has `if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }` matching web-side |
| C33-06 | FIXED | `greedy.ts:226` now uses `tx.amount` directly with comment explaining optimizer invariant |
| C33-01 | PARTIALLY FIXED | `matcher.ts:18` SUBSTRING_SAFE_ENTRIES pre-computed at module level; still O(n) per transaction but avoids per-call allocation |

---

## New Findings

### C34-01: Server-side PDF `parseAmount` returns 0 for NaN and uses `parseInt` (truncation) instead of `Math.round(parseFloat(...))` -- parity bug with fixed web-side

**File:** `packages/parser/src/pdf/index.ts:102-108`

**Severity:** MEDIUM | **Confidence:** High

The C33-03 fix updated the web-side PDF `parseAmount` to return `null` for unparseable amounts and use `Math.round(parseFloat(...))`. The server-side PDF `parseAmount` was NOT updated:

```typescript
function parseAmount(raw: string): number {
  const n = parseInt(raw.replace(/원$/, '').replace(/,/g, ''), 10);
  return Number.isNaN(n) ? 0 : n;
}
```

Three specific parity bugs:
1. Returns `0` for NaN instead of `null` -- cannot distinguish parse failure from zero (the exact issue C33-03 fixed on web-side)
2. Uses `parseInt()` which truncates decimal remainders instead of `Math.round(parseFloat(...))` which rounds (the exact pattern C32-01/C21-03 fixed across all other parsers)
3. Does not handle parenthesized negative amounts like `(1,234)` which all other parsers support

**Impact:** Server-side PDF parsing silently converts unparseable amounts to 0 (which are then filtered by the `amount <= 0` check at line 158, silently dropping the transaction). Truncation of decimal remainders can produce off-by-1 Won errors for formula-rendered cells.

**Fix:** Update server-side PDF `parseAmount` to match the web-side pattern: return `number | null`, use `Math.round(parseFloat(...))`, handle parenthesized negatives. Update callers to handle `null` return with error reporting.

---

### C34-02: Server-side XLSX `parseAmount` string path uses `parseInt` (truncation) instead of `Math.round(parseFloat(...))`

**File:** `packages/parser/src/xlsx/index.ts:136`

**Severity:** LOW | **Confidence:** High

The XLSX `parseAmount` has inconsistent rounding between its numeric and string paths:

```typescript
// Numeric path (correct -- uses Math.round):
if (typeof raw === 'number') {
  return Number.isFinite(raw) ? Math.round(raw) : null;
}
// String path (incorrect -- uses parseInt which truncates):
if (typeof raw === 'string') {
  // ...
  const n = parseInt(cleaned, 10);  // <-- truncates, not rounds
  if (Number.isNaN(n)) return null;
  return isNeg ? -n : n;
}
```

The file's own comment at line 127 says "round to prevent decimal values" but `parseInt` truncates rather than rounding. For `parseFloat("1.7")` -> 1.7 -> `Math.round(1.7)` = 2, but `parseInt("1.7", 10)` = 1. The web-side XLSX parser uses `Math.round(parseFloat(...))` (per C20-01/C21-03).

**Impact:** Off-by-1 Won discrepancy for decimal amount strings in XLSX files. Korean Won amounts are typically integers, so this rarely manifests. The numeric path (which handles most XLSX amounts) correctly uses `Math.round`.

**Fix:** Replace `parseInt(cleaned, 10)` with `Math.round(parseFloat(cleaned))` in the string path, matching the numeric path and the web-side implementation.

---

### C34-03: Server-side PDF `findDateCell` does not validate month/day ranges for `SHORT_MD_DATE_PATTERN` -- parity bug with web-side `isValidShortDate`

**File:** `packages/parser/src/pdf/index.ts:110-122`

**Severity:** LOW | **Confidence:** High

The web-side PDF `findDateCell` validates short MM/DD date candidates using `isValidShortDate()` (which checks month 1-12, day 1-31) to prevent decimal amounts like "3.5" from being misidentified as dates (C8-11). The server-side uses the raw `SHORT_MD_DATE_PATTERN` regex without validation:

```typescript
// Server-side (no range validation):
if (
  STRICT_DATE_PATTERN.test(cell) ||
  SHORT_YEAR_DATE_PATTERN.test(cell) ||
  KOREAN_FULL_DATE_PATTERN.test(cell) ||
  KOREAN_SHORT_DATE_PATTERN.test(cell) ||
  SHORT_MD_DATE_PATTERN.test(cell)  // <-- no month/day range check
) return { idx: i, value: cell };

// Web-side (with range validation):
if (
  STRICT_DATE_PATTERN.test(cell) ||
  SHORT_YEAR_DATE_PATTERN.test(cell) ||
  KOREAN_FULL_DATE_PATTERN.test(cell) ||
  KOREAN_SHORT_DATE_PATTERN.test(cell) ||
  isValidShortDate(cell)  // <-- validates month/day ranges
) return { idx: i, value: cell };
```

**Impact:** Decimal amounts like "3.5" could be misidentified as dates (3rd of May) in the server-side PDF parser, causing the date and merchant columns to be swapped for that row.

**Fix:** Add `isValidShortDate` function to server-side PDF parser (matching web-side) and use it instead of raw `SHORT_MD_DATE_PATTERN.test(cell)`.

---

### C34-04: Server-side PDF `tryStructuredParse` has no fallback line scanner -- missing entire parsing tier

**File:** `packages/parser/src/pdf/index.ts:131-187, 189-258`

**Severity:** LOW | **Confidence:** High

The web-side PDF parser has a three-tier approach:
1. Structured table parsing (`tryStructuredParse`)
2. Fallback line scanner (regex-based per-line scanning)
3. (No LLM fallback on web)

The server-side PDF parser only has:
1. Structured table parsing (`tryStructuredParse`)
2. LLM fallback (requires `--allow-remote-llm`)

There is no fallback line scanner on the server side. If structured parsing fails and LLM is disabled (the default), the user gets zero transactions from a PDF that the web-side would successfully parse. The server-side uses `catch { if (err instanceof SyntaxError || ...) return null; throw err; }` which is correct for catching specific errors, but the missing fallback tier means many PDFs that fail structured parsing are simply not parsed at all.

**Impact:** Server-side PDF parsing has significantly lower success rate than web-side for PDFs where the table structure is malformed or unusual. This is an architectural gap rather than a bug -- the server-side was designed for the CLI where LLM fallback is the safety net.

**Fix:** Port the web-side fallback line scanner to the server-side PDF parser, or document that server-side PDF parsing requires structured tables and recommend CSV/XLSX for better coverage.

---

### C34-05: `inferYear` function duplicated 3 times across server-side parsers -- not centralized like web-side

**Files:**
- `packages/parser/src/csv/generic.ts:33-40`
- `packages/parser/src/xlsx/index.ts:31-38`
- `packages/parser/src/pdf/index.ts:23-30`

**Severity:** LOW | **Confidence:** High

The web-side parsers centralized `inferYear` into `date-utils.ts` (C19-01). The server-side parsers each have their own identical copy. If the heuristic changes (e.g., timezone handling per C8-08), all three copies must be updated independently, risking divergence.

**Impact:** Maintenance risk -- the three copies are currently identical but could diverge. Same class as D-35/D-55 on the web side, which was resolved by centralizing into `date-utils.ts`.

**Fix:** Create a shared `date-utils.ts` in `packages/parser/src/` and have all three parsers import `inferYear` from it.

---

## Final Sweep -- Commonly Missed Issues

1. **All C33 findings verified:** C33-01 (MerchantMatcher) partially fixed with SUBSTRING_SAFE_ENTRIES; C33-02 (stale cache) still open; C33-03 (PDF parseAmount) fixed on web-side but NOT on server-side (C34-01); C33-04 (splitCSVLine) now fixed; C33-05 (unit narrowing) still open; C33-06 (Math.abs) now fixed.
2. **No XSS risk**: All dynamic content rendered through Svelte/Astro template syntax which auto-escapes. No `innerHTML` patterns found.
3. **No secret leakage**: No API keys, tokens, or credentials in source code.
4. **CSP is properly configured**: Layout.astro has appropriate CSP headers.
5. **parseAmount consistency across ALL parsers:**
   - Web CSV: `Math.round(parseFloat(...))` with NaN -> NaN + isValidAmount()
   - Web XLSX: `Math.round(parseFloat(...))` for string, `Math.round(raw)` for number
   - Web PDF: `Math.round(parseFloat(...))` with null for NaN (C33-03 fix)
   - Server CSV: `Math.round(parseFloat(...))` with null for NaN
   - Server XLSX: `parseInt(cleaned, 10)` for string (BUG -- C34-02), `Math.round(raw)` for number
   - Server PDF: `parseInt(...)` with 0 for NaN (BUG -- C34-01)
6. **findDateCell consistency:** Web PDF has `isValidShortDate` for SHORT_MD_DATE_PATTERN; Server PDF does not (BUG -- C34-03).
7. **SessionStorage access is properly guarded** across all access points.
8. **prefers-reduced-motion**: Handled at both CSS level and JS level.
9. **No new security issues**: All fetch calls use same-origin URLs.
10. **C31-01 FIX CONFIRMED**: SpendingSummary dismiss catch now logs `console.warn` matching the C27-01/C30-03 pattern.
11. **C31-02 FIX CONFIRMED**: `greedy.ts:290-296` uses if/else instead of redundant `.set()`.
12. **C33-04 FIX CONFIRMED**: Server-side `splitCSVLine` now handles RFC 4180 doubled quotes.
13. **C33-06 FIX CONFIRMED**: `buildCardResults` uses `tx.amount` directly without `Math.abs()`.
14. **AbortController patterns**: CardGrid, CardDetail, CardPage all properly clean up.
15. **No race conditions in store.svelte.ts**: setResult, analyze, reoptimize all update result + generation atomically.
16. **Negative amounts handled correctly**: All parsers handle negative amounts via `(1,234)` format and `-` prefix. Optimizer filters positive amounts only.
17. **`as any` usage**: Only in test files and `loadFromStorage` validation (lines 203, 242). Acceptable.
18. **console.warn usage**: Properly scoped with `[cherrypicker]` prefix everywhere except C31-01 which is now fixed.

---

## Summary

- **5 prior findings confirmed FIXED this cycle** (C31-01, C31-02, C33-04, C33-06; C33-01 partially fixed)
- **5 new findings** this cycle:
  - C34-01: Server-side PDF parseAmount parity bugs (MEDIUM, High) -- returns 0 for NaN, uses parseInt instead of Math.round, no parenthesized negative handling
  - C34-02: Server-side XLSX parseAmount string path uses parseInt instead of Math.round (LOW, High)
  - C34-03: Server-side PDF findDateCell missing isValidShortDate (LOW, High)
  - C34-04: Server-side PDF has no fallback line scanner (LOW, High) -- architectural gap
  - C34-05: inferYear duplicated 3 times in server-side parsers (LOW, High) -- DRY violation
- All prior open findings verified as still open with accurate file/line references
- No security, correctness, or data-loss issues found beyond the server-side parser parity bugs
