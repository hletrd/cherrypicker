# Comprehensive Code Review -- Cycle 35

**Date:** 2026-04-19
**Reviewer:** Multi-angle comprehensive review (cycle 35)
**Scope:** Full repository -- all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage

---

## Methodology

Read every source file in the repository (40+ source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, apps/web). Cross-referenced with prior cycle 1-34 reviews. Verified that all prior cycle 34 findings (C34-01 through C34-03) are already fixed in the current codebase. Ran `bun test` (266 pass, 0 fail). Focused on finding genuinely NEW issues not previously reported, with particular attention to:

1. The `packages/parser/src/csv/generic.ts` parseDateToISO missing range validation (C34-03 partial)
2. Cross-file consistency in the server-side vs web-side parsers
3. The greedy optimizer's quadratic complexity for large transaction sets
4. The LLM fallback's regex for JSON extraction

---

## Verification of Cycle 34 Findings

| Finding | Status | Evidence |
|---|---|---|
| C34-01 | **ALREADY FIXED** | `packages/parser/src/pdf/index.ts:26-94` now has full parseDateToISO with all date formats and range validation |
| C34-02 | **ALREADY FIXED** | `packages/parser/src/xlsx/index.ts:40-122` now has range validation on all date format branches |
| C34-03 | **ALREADY FIXED** | All 11 bank-specific CSV adapters in both `packages/parser/src/csv/` and `apps/web/src/lib/parser/csv.ts` now have range validation in their parseDateToISO functions |

---

## New Findings

### C35-01: `packages/parser/src/csv/generic.ts` parseDateToISO missing month/day range validation

- **Severity:** MEDIUM (correctness)
- **Confidence:** High
- **File:** `packages/parser/src/csv/generic.ts:42-87`
- **Description:** The server-side generic CSV parser's `parseDateToISO` handles all date formats (YYYYMMDD, full-date, short-year, Korean full, MM/DD, Korean short) but does **not** validate month/day ranges for any of them. This is inconsistent with:
  - `apps/web/src/lib/parser/csv.ts` -- has range validation for all formats
  - `packages/parser/src/csv/index.ts` (the wrapper) -- has range validation
  - All 11 bank-specific CSV adapters -- now have range validation
  - `packages/parser/src/pdf/index.ts` -- has range validation
  - `packages/parser/src/xlsx/index.ts` -- has range validation

  The generic CSV adapter is the fallback parser when no bank-specific adapter matches. A corrupted date like "20261399" in YYYYMMDD format would produce the invalid "2026-13-99" instead of being rejected.

- **Failure scenario:** A CSV file from an unrecognized bank contains a row with a corrupted date cell (e.g., "20261399"). The generic parser produces "2026-13-99" as the transaction date. Downstream optimization code that assumes valid ISO dates may behave unpredictably.

- **Fix:** Add month/day range validation (1-12 for month, 1-31 for day) to all date format branches in `packages/parser/src/csv/generic.ts`, matching the pattern used in the web-side csv.ts and the server-side pdf/xlsx parsers.

### C35-02: LLM fallback JSON regex uses non-greedy match that can truncate valid arrays

- **Severity:** MEDIUM (correctness)
- **Confidence:** Medium
- **File:** `packages/parser/src/pdf/llm-fallback.ts:75`
- **Description:** The regex `/\[[\s\S]*?\](?=\s*$|\s*```)/` uses a non-greedy quantifier `*?` which matches the **shortest** possible array. If the LLM returns nested arrays or a response containing multiple JSON arrays (e.g., explanatory text followed by the actual data array), the regex would match only up to the first `]`, truncating the actual transaction data.

  For example, if the LLM response is:
  ```
  Here is the parsed data:
  [{"date":"2024-01-15","merchant":"A","amount":1000},
   {"date":"2024-01-16","merchant":"B","amount":2000}]
  ```

  The non-greedy match would correctly capture the full array here. But if the response includes something like `[note]` before the actual data:
  ```
  See [note1] for details.
  [{"date":"2024-01-15","merchant":"A","amount":1000}]
  ```
  The regex would match `[note1]` instead of the actual transaction array.

- **Failure scenario:** An LLM response that includes bracketed text before the transaction array (e.g., `[See notes]` or `[IMPORTANT]`) causes the regex to match the wrong bracket-delimited content, producing a JSON parse error or incorrect transaction data.

- **Fix:** Use a greedy match that captures from the first `[` to the last `]` on the response, or better yet, use a balanced-bracket matching approach. A simpler fix is to use `/\[[\s\S]*\](?=\s*$|\s*```)/` (greedy) which captures the longest possible array, then validate it parses correctly. If parsing fails, fall back to trying progressively shorter matches from the end.

### C35-03: Greedy optimizer has O(T*C^2) complexity per transaction, potentially slow for large datasets

- **Severity:** LOW (performance)
- **Confidence:** High
- **File:** `packages/core/src/optimizer/greedy.ts:116-141`
- **Description:** For each transaction, `scoreCardsForTransaction` calls `calculateCardOutput` twice per card (once for `before`, once for `after`), and `calculateCardOutput` calls `calculateRewards` which iterates over all transactions already assigned to that card. This means each transaction scoring is O(C * A) where C is the number of cards and A is the number of already-assigned transactions. For the full optimization, this is O(T * C * A_avg) = O(T^2 * C) in the worst case.

  For typical usage (a few dozen transactions and 5-10 cards), this is negligible. But for power users with hundreds of transactions across many cards, the optimization could take seconds.

- **Failure scenario:** A user uploads 500 transactions with 15 cards. The optimizer performs ~500 * 15 * 250 = ~1.9M reward calculations, each involving iterating over the assigned transaction list. On a low-end device, this could cause noticeable UI jank in the web app.

- **Fix:** This is a known algorithmic limitation of the greedy approach. A practical mitigation is to add a transaction count threshold above which the optimizer falls back to a simpler per-category assignment (assign all transactions in a category to the best card for that category) rather than per-transaction scoring. No immediate fix needed, but worth noting for scale.

### C35-04: `packages/parser/src/csv/generic.ts` parseDateToISO short-year format doesn't pad month/day

- **Severity:** LOW (correctness)
- **Confidence:** High
- **File:** `packages/parser/src/csv/generic.ts:57-62`
- **Description:** When handling the YY-MM-DD format, the server-side generic parser returns `${fullYear}-${shortYearMatch[2]}-${shortYearMatch[3]}` without padding month/day to 2 digits. If the short-year regex matches `99-1-5`, it would produce `2099-1-5` instead of `2099-01-05`. The same short-year branch in `apps/web/src/lib/parser/csv.ts` also lacks padding. However, the short-year regex uses `\d{2}` for month/day, which requires exactly 2 digits, so in practice single-digit months/days won't match this branch. The issue is cosmetic inconsistency -- all other branches pad to 2 digits, but this one doesn't.

  Note: The regex `^(\d{2})[.\-\/](\d{2})[.\-\/](\d{2})$` requires exactly 2-digit month/day, so the output will always be 2 digits. The missing padStart is therefore technically safe but inconsistent with the defensive style used elsewhere.

- **Failure scenario:** No practical failure -- the regex enforces 2-digit month/day. However, if the regex were ever relaxed to allow single-digit months (like the full-date regex), the missing padStart would produce non-ISO dates.

- **Fix:** Add `.padStart(2, '0')` to `shortYearMatch[2]` and `shortYearMatch[3]` for consistency with all other parseDateToISO implementations, even though the regex currently enforces 2-digit format.

### C35-05: `packages/parser/src/csv/generic.ts` parseDateToISO short-year format missing month/day range validation

- **Severity:** LOW (correctness)
- **Confidence:** High
- **File:** `packages/parser/src/csv/generic.ts:57-62`
- **Description:** Related to C35-01 but specifically calling out the short-year branch. The short-year format handler in the server-side generic CSV parser doesn't validate month/day ranges. A corrupted date like "25/13/99" would produce "2025-13-99" without rejection. This is part of the broader C35-01 finding but worth noting separately since the short-year format has the same validation gap in the web-side csv.ts as well.

- **Failure scenario:** Same as C35-01 -- corrupted short-year date passes through without validation.

- **Fix:** Same as C35-01 -- add range validation.

---

## Final Sweep -- Cross-File Interactions

1. **All prior findings confirmed fixed:** C34-01 through C34-03 are verified as resolved in the current codebase.

2. **Date validation consistency audit (updated):** I verified all 7+ `parseDateToISO` implementations:
   - `apps/web/src/lib/parser/csv.ts` -- FULL (all formats + validation)
   - `apps/web/src/lib/parser/xlsx.ts` -- FULL (all formats + validation)
   - `apps/web/src/lib/parser/pdf.ts` -- FULL (all formats + validation)
   - `packages/parser/src/csv/index.ts` -- FULL (all formats + validation)
   - `packages/parser/src/csv/generic.ts` -- **PARTIAL** (all formats, NO validation, missing padStart on short-year)
   - `packages/parser/src/pdf/index.ts` -- FULL (all formats + validation)
   - `packages/parser/src/xlsx/index.ts` -- FULL (all formats + validation)
   - 11 bank CSV adapters (both server and web) -- FULL (YYYY-MM-DD + YYYYMMDD + validation)

3. **Deferred items unchanged:** D-01 through D-105 remain unchanged from prior cycles.

4. **`cachedCoreRules` module-level cache:** Still present in `analyzer.ts:47`. Intentionally never invalidated since `cards.json` static data never changes within a session. Not a bug.

5. **AI categorizer disabled:** `categorizer-ai.ts` correctly stubs all methods to throw. `TransactionReview.svelte` checks `aiAvailable` before showing the AI button. No dead-code path issues.

6. **E2E test isolation:** `bunfig.toml` correctly excludes `e2e/**` from `bun test`. Confirmed working.

7. **Report HTML generator** (`packages/viz/src/report/generator.ts`): Uses `esc()` for HTML escaping of user-provided strings. The savings sign prefix (line 37) correctly prepends "+" for non-negative savings. No issues found.

8. **LLM fallback security:** The `ANTHROPIC_API_KEY` is read from `process.env` and only used server-side. The browser guard (`typeof window !== 'undefined'`) prevents client-side execution. The 30-second timeout and text truncation (8000 chars) are reasonable safeguards. No new security issues found.

9. **SessionStorage persistence:** The 4MB limit with transaction truncation fallback is well-implemented. The validation on load (`isValidTx`) correctly filters corrupted entries. No issues found.

---

## Summary of Active Findings (New in Cycle 35)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C35-01 | MEDIUM | High | `packages/parser/src/csv/generic.ts:42-87` | Server-side generic CSV parseDateToISO missing month/day range validation on all date formats |
| C35-02 | MEDIUM | Medium | `packages/parser/src/pdf/llm-fallback.ts:75` | LLM fallback JSON regex uses non-greedy match that can truncate or mis-match arrays when LLM response contains bracketed text |
| C35-03 | LOW | High | `packages/core/src/optimizer/greedy.ts:116-141` | Greedy optimizer O(T^2*C) complexity may cause slow optimization for large transaction sets |
| C35-04 | LOW | High | `packages/parser/src/csv/generic.ts:57-62` | Short-year format branch missing padStart for month/day (technically safe due to regex, but inconsistent) |
| C35-05 | LOW | High | `packages/parser/src/csv/generic.ts:57-62` | Short-year format branch missing month/day range validation (subset of C35-01) |
