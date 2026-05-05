# Cycle 14 Code Review

## Findings

### C14-01: `isValidISODate` accepts invalid dates like "2024-99-99" (HIGH)
- **Files:** `packages/parser/src/date-utils.ts:228`, `apps/web/src/lib/parser/date-utils.ts:242`
- **Description:** The regex `/^\d{4}-\d{2}-\d{2}$/` only validates format, not actual month/day ranges. When `parseDateStringToISO` receives an unrecognizable input that happens to look ISO-like (e.g., "2024-99-99"), it returns the input as-is. `isValidISODate` then incorrectly returns `true`, causing the parser to accept invalid dates without reporting a parse error.
- **Failure scenario:** A corrupted bank export contains "2024-99-99" as a date. The CSV generic parser produces a transaction with `date: "2024-99-99"`, which later causes `tx.date.startsWith(latestMonth)` to fail, silently dropping the transaction from optimization. The user sees fewer transactions than expected with no error explaining why.
- **Fix:** Add month (01-12) and day (01-31) range validation to `isValidISODate`.
- **Confidence:** High

### C14-02: `console.warn` still present in `analyzer.ts` despite C11 cleanup (MEDIUM)
- **File:** `apps/web/src/lib/analyzer.ts:58, 64`
- **Description:** Commit `8fbe12a` (C11) claimed to "remove stale console.warn and TODO comments", but `toCoreCardRuleSets` still uses `console.warn` for unknown card sources and reward types. This creates noise in production browser consoles and contradicts the stated cleanup intent.
- **Failure scenario:** A scraped card rule has an unrecognized `source` or `type` field. The console emits warnings that users may see in production (if they open dev tools), and the warnings leak internal data (card IDs, field values).
- **Fix:** Remove `console.warn` calls. The fallback values (`'web'`, `'discount'`) are sufficient; silently normalize without logging.
- **Confidence:** High

### C14-03: `renderPageText` hardcoded character width of 6 (MEDIUM)
- **Files:** `packages/parser/src/pdf/extractor.ts:26`, `apps/web/src/lib/parser/pdf.ts:522`
- **Description:** The `lastEndX` calculation uses `item.str.length * 6` as a crude approximation for text width. Korean characters (e.g., Hangul) and Latin characters have different widths in PDF font metrics. This can cause incorrect space insertion (or omission) between adjacent text items, corrupting the extracted text before table parsing.
- **Failure scenario:** A Korean bank PDF uses a narrow font for Latin digits and a wide font for Korean merchant names. The width approximation causes missing spaces between adjacent items on the same line, merging "CU" and "편의점" into "CU편의점". The table parser then fails to detect column boundaries correctly.
- **Fix:** Use `item.width` from pdf-parse / pdfjs-dist if available, or calculate width from the transform matrix (item.transform[0] is the horizontal scaling factor).
- **Confidence:** Medium

### C14-04: `adapter-factory.ts` duplicate import paths (LOW)
- **File:** `packages/parser/src/csv/adapter-factory.ts:8-9`
- **Description:** Lines 8 and 9 import from `'../detect.js'` in two separate statements. Minor code smell.
- **Fix:** Combine into a single import statement.
- **Confidence:** High

### C14-05: `parseDateStringToISO` fullMatch regex lacks end anchor (MEDIUM)
- **Files:** `packages/parser/src/date-utils.ts:104`, `apps/web/src/lib/parser/date-utils.ts:80`
- **Description:** The regex `/^(\d{4})[\s]*[.\-\/．。][\s]*(\d{1,2})[\s]*[.\-\/．。][\s]*(\d{1,2})/` lacks a `$` end anchor. While trailing delimiters are intentionally handled, inputs like "2024-01-15xyz" would match and return "2024-01-15" with "xyz" silently discarded.
- **Fix:** Add a negative lookahead or stricter boundary check after the day group.
- **Confidence:** Medium

### C14-06: `console.warn` in `store.svelte.ts` (MEDIUM)
- **File:** `apps/web/src/lib/store.svelte.ts:191, 243, 246, 329, 330, 338, 358`
- **Description:** Multiple `console.warn` calls persist in the sessionStorage persistence layer. These were not removed in C11.
- **Fix:** Remove or gate behind a debug flag.
- **Confidence:** High
