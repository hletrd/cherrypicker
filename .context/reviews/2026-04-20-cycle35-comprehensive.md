# Cycle 35 Comprehensive Code Review -- 2026-04-20

**Scope:** Full re-read of all source files in `apps/web/src/`, `packages/core/src/`, `packages/rules/src/`, `packages/parser/src/`, `packages/viz/src/`, verification of all prior open findings, targeted pattern search for new issues. Cross-verification of parseAmount consistency across all parsers (web + server + bank adapters).

---

## Verification of Prior Cycle Fixes

All previously open findings from the aggregate were verified against current source code:

| Finding | Status | Evidence |
|---|---|---|
| C7-04 | OPEN (LOW) | TransactionReview `$effect` re-sync still uses `generation` counter pattern |
| C7-06 | OPEN (LOW) | `analyzer.ts:329` still filters to latest month; `transactions` field includes all months |
| C7-07 | OPEN (LOW) | `BANK_SIGNATURES` duplicated between `apps/web/src/lib/parser/detect.ts` and `packages/parser/src/detect.ts` |
| C7-11 | OPEN (LOW) | `store.svelte.ts:156` persist warning message still not specific about corruption vs truncation |
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
| C33-01 | OPEN (MEDIUM) | MerchantMatcher substring scan -- SUBSTRING_SAFE_ENTRIES pre-computed; still O(n) per transaction |
| C33-02 | OPEN (MEDIUM) | cachedCategoryLabels stale across redeployments |

### Fixes confirmed from prior cycles

| Finding | Status | Evidence |
|---|---|---|
| C34-01 | FIXED | `packages/parser/src/pdf/index.ts:106-118` now returns `number | null`, uses `Math.round(parseFloat(...))`, handles parenthesized negatives |
| C34-02 | FIXED | `packages/parser/src/xlsx/index.ts:128` now uses `Math.round(parseFloat(cleaned))` instead of `parseInt` |
| C34-03 | FIXED | `packages/parser/src/pdf/index.ts:24-31` now has `isValidShortDate()` used in `findDateCell` |
| C34-05 | FIXED | `packages/parser/src/csv/generic.ts:3`, `xlsx/index.ts:5`, `pdf/index.ts:3` all import `inferYear` from `../date-utils.js` |

---

## New Findings

### C35-01: All 10 bank-specific CSV adapters use `parseInt` (truncation) instead of `Math.round(parseFloat(...))` for amount parsing -- parity bug with all fixed parsers

**Files:**
- `packages/parser/src/csv/hyundai.ts:28`
- `packages/parser/src/csv/kb.ts:28`
- `packages/parser/src/csv/shinhan.ts:28`
- `packages/parser/src/csv/woori.ts:28`
- `packages/parser/src/csv/samsung.ts:28`
- `packages/parser/src/csv/hana.ts:28`
- `packages/parser/src/csv/nh.ts:28`
- `packages/parser/src/csv/lotte.ts:28`
- `packages/parser/src/csv/ibk.ts:28`
- `packages/parser/src/csv/bc.ts:28`

**Severity:** MEDIUM | **Confidence:** High

All 10 bank-specific CSV adapters have the same `parseAmount` implementation:

```typescript
function parseAmount(raw: string): number {
  let cleaned = raw.trim().replace(/원$/, '').replace(/,/g, '');
  const isNeg = cleaned.startsWith('(') && cleaned.endsWith(')');
  if (isNeg) cleaned = cleaned.slice(1, -1);
  const n = parseInt(cleaned, 10);  // <-- truncates, not rounds
  if (Number.isNaN(n)) return NaN;
  return isNeg ? -n : n;
}
```

This has TWO parity bugs with the fixed parsers (C34-01, C34-02, C33-03):

1. **Uses `parseInt` instead of `Math.round(parseFloat(...))`**: `parseInt("1.7", 10)` returns 1, but `Math.round(parseFloat("1.7"))` returns 2. For formula-rendered CSV cells containing decimal remainders, this produces off-by-1 Won errors. Every other parser (generic CSV, web-side XLSX, web-side PDF, server-side XLSX, server-side PDF) was fixed to use `Math.round(parseFloat(...))` but the bank adapters were missed.

2. **Returns `NaN` on parse failure instead of `null`**: The generic CSV and all other fixed parsers return `null` for unparseable amounts so callers can distinguish between genuinely zero amounts and parse failures. The bank adapters return `NaN`, which is a different sentinel and requires `Number.isNaN()` checks at every call site.

**Impact:** Off-by-1 Won discrepancy for decimal amount strings in bank-specific CSV files. Korean Won amounts are typically integers, so this rarely manifests. The `NaN` return type creates inconsistent error handling across the codebase.

**Fix:** Replace `parseInt(cleaned, 10)` with `Math.round(parseFloat(cleaned))` and change the return type to `number | null` (returning `null` for unparseable amounts) in all 10 bank adapters, matching the generic CSV pattern.

---

### C35-02: Bank-specific CSV adapters don't filter zero-amount rows

**Files:** All 10 bank-specific CSV adapters in `packages/parser/src/csv/`

**Severity:** LOW | **Confidence:** High

The generic CSV parser at `generic.ts:236` filters zero-amount rows with `if (amount === 0) continue;`, matching the web-side parser's `isValidAmount()` behavior (C26-02/C32-02). None of the 10 bank-specific adapters filter zero-amount rows:

```typescript
// Bank adapter pattern (no zero-amount filter):
const amount = parseAmount(amountRaw);
if (Number.isNaN(amount)) { ... continue; }
// Zero-amount rows pass through and become transactions
```

Zero-amount rows typically represent balance inquiries or declined transactions that should not be included in spending optimization. The optimizer's `tx.amount > 0` filter in `greedy.ts:272` catches these downstream, so the impact is cosmetic (zero-amount transactions appear in the TransactionReview table but don't affect reward calculations).

**Impact:** Zero-amount transactions from bank-specific CSV files appear in the UI but don't affect optimization. Consistency issue rather than correctness bug.

**Fix:** Add `if (amount === 0) continue;` after the NaN check in all 10 bank adapters, matching the generic CSV pattern.

---

### C35-03: Bank-specific CSV adapters have duplicated `parseDateToISO` without `inferYear` support

**Files:** All 10 bank-specific CSV adapters in `packages/parser/src/csv/`

**Severity:** LOW | **Confidence:** High

Each bank adapter has its own copy of `parseDateToISO` that only handles:
- YYYY.MM.DD / YYYY-MM-DD / YYYY/MM/DD (with month/day validation)
- YYYYMMDD (with month/day validation)

The generic CSV's `parseDateToISO` also handles:
- Korean full dates: `2025년 11월 30일`
- Korean short dates: `1월 15일` (with `inferYear`)
- Short MM/DD dates (with `inferYear`)
- YY.MM.DD short-year dates

None of the bank adapters import `inferYear` from `date-utils.ts`, so they cannot handle short dates that need year inference. Additionally, the date parsing logic is duplicated 10 times instead of being shared.

**Impact:** Bank-specific CSV files with Korean-format dates or short MM/DD dates will not be parsed correctly. This is unlikely for most Korean bank CSV exports (which use YYYY.MM.DD), but the code duplication is a maintenance risk -- if date validation logic changes (e.g., to fix C8-08 timezone handling), all 10 copies must be updated independently.

**Fix:** Have all bank adapters import `parseDateToISO` from a shared module (e.g., `../date-utils.ts`) instead of defining their own copies, matching the pattern used by `generic.ts`.

---

## Final Sweep -- Commonly Missed Issues

1. **parseAmount consistency matrix (verified this cycle):**
   - Web CSV (`csv.ts`): `Math.round(parseFloat(...))`, null for NaN -- CORRECT
   - Web XLSX (`xlsx.ts`): `Math.round(parseFloat(...))` for string, `Math.round(raw)` for number -- CORRECT
   - Web PDF (`pdf.ts`): `Math.round(parseFloat(...))`, null for NaN -- CORRECT
   - Server generic CSV (`generic.ts`): `Math.round(parseFloat(...))`, null for NaN -- CORRECT
   - Server XLSX (`xlsx/index.ts`): `Math.round(parseFloat(...))` for string, `Math.round(raw)` for number -- CORRECT (C34-02 fixed)
   - Server PDF (`pdf/index.ts`): `Math.round(parseFloat(...))`, null for NaN -- CORRECT (C34-01 fixed)
   - Server bank adapters (10 files): `parseInt(cleaned, 10)`, returns NaN -- BUG (C35-01)

2. **Zero-amount filter consistency:**
   - Web CSV/XLSX/PDF: `isValidAmount()` or `amount === 0` check
   - Server generic CSV: `amount === 0` check
   - Server XLSX: `amount === 0` check
   - Server PDF: `amount <= 0` check
   - Server bank adapters: NO zero-amount check -- INCONSISTENT (C35-02)

3. **Date parsing consistency:**
   - Web CSV/XLSX/PDF: centralized via `date-utils.ts` with `inferYear`
   - Server generic CSV: imports `inferYear` from `date-utils.ts`
   - Server XLSX/PDF: import `inferYear` from `date-utils.ts`
   - Server bank adapters: own `parseDateToISO` without `inferYear` -- INCONSISTENT (C35-03)

4. **No XSS risk**: All dynamic content rendered through Svelte/Astro template syntax which auto-escapes. No `innerHTML` patterns found.

5. **No secret leakage**: No API keys, tokens, or credentials in source code.

6. **CSP properly configured**: Layout.astro has appropriate CSP headers.

7. **No new security issues**: All fetch calls use same-origin URLs.

8. **SessionStorage access properly guarded** across all access points.

9. **prefers-reduced-motion**: Handled at both CSS level and JS level.

10. **AbortController patterns**: CardGrid, CardDetail, CardPage all properly clean up.

11. **No race conditions in store.svelte.ts**: setResult, analyze, reoptimize all update result + generation atomically.

12. **Negative amounts handled correctly**: All fixed parsers handle negative amounts via `(1,234)` format and `-` prefix. Bank adapters also handle parenthesized negatives. Optimizer filters positive amounts only.

13. **`as any` usage**: Only in test files and `loadFromStorage` validation (lines 203, 242). Acceptable.

14. **console.warn usage**: Properly scoped with `[cherrypicker]` prefix everywhere.

---

## Summary

- **4 prior findings confirmed FIXED this cycle** (C34-01, C34-02, C34-03, C34-05)
- **3 new findings** this cycle:
  - C35-01: All 10 bank-specific CSV adapters use `parseInt` instead of `Math.round(parseFloat(...))` and return `NaN` instead of `null` -- parity bug with all fixed parsers (MEDIUM, High)
  - C35-02: Bank-specific CSV adapters don't filter zero-amount rows -- consistency issue (LOW, High)
  - C35-03: Bank-specific CSV adapters have duplicated `parseDateToISO` without `inferYear` support -- DRY violation + missing date formats (LOW, High)
- All prior open findings verified as still open with accurate file/line references
- No security, correctness, or data-loss issues found beyond the bank adapter parity bugs
