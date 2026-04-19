# Comprehensive Code Review — Cycle 34

**Date:** 2026-04-19
**Reviewer:** Multi-angle comprehensive review (cycle 34)
**Scope:** Full repository — all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage

---

## Methodology

Read every source file in the repository (40+ source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, apps/web). Cross-referenced with prior cycle 1-33 reviews. Verified that all prior cycle 33 finding C33-01 is now fixed. Ran `bun test` (266 pass, 0 fail). Focused on finding genuinely NEW issues not previously reported, with particular attention to date validation consistency across all parseDateToISO implementations.

---

## Verification of Cycle 33 Findings

| Finding | Status | Evidence |
|---|---|---|
| C33-01 | **FIXED** | `bunfig.toml` now has `pathIgnorePatterns = ["e2e/**"]`; `bun test` passes with 0 failures |

---

## New Findings

### C34-01: `packages/parser/src/pdf/index.ts` parseDateToISO is a minimal stub — missing all date format handlers and range validation

- **Severity:** HIGH (correctness)
- **Confidence:** High
- **File:** `packages/parser/src/pdf/index.ts:14-18`
- **Description:** The `parseDateToISO` function in the server-side PDF parser only handles `YYYY[.-/]MM[.-/]DD` format via a single regex match. It is missing:
  1. YYYYMMDD format handling
  2. Short-year (YY-MM-DD) format handling
  3. Korean full-date (YYYY년 M월 D일) format handling
  4. Korean short-date (M월 D일) with year inference
  5. MM/DD short-date with year inference
  6. **Month/day range validation** for the one format it does handle

  All other `parseDateToISO` implementations have been updated with range validation over prior cycles:
  - `apps/web/src/lib/parser/csv.ts` — full coverage with validation
  - `apps/web/src/lib/parser/xlsx.ts` — full coverage with validation
  - `apps/web/src/lib/parser/pdf.ts` — full coverage with validation
  - `packages/parser/src/csv/index.ts` — full coverage with validation
  - `packages/parser/src/csv/generic.ts` — full coverage with validation

  The server-side PDF parser was never updated, leaving it as a regression risk for CLI/server usage.

- **Failure scenario:** A user runs the CLI with a PDF statement containing dates in Korean format (e.g., "2025년 11월 30일") or compact format (e.g., "20251130"). The `parseDateToISO` returns the raw string unchanged, producing invalid date strings like "2025년 11월 30일" instead of "2025-11-30". Downstream optimization code expects ISO 8601 dates and fails to match these transactions to categories, resulting in 0 rewards.

- **Fix:** Replace the minimal `parseDateToISO` in `packages/parser/src/pdf/index.ts` with the full implementation from `apps/web/src/lib/parser/pdf.ts`, including all date format handlers and range validation.

### C34-02: `packages/parser/src/xlsx/index.ts` parseDateToISO missing month/day range validation

- **Severity:** MEDIUM (correctness)
- **Confidence:** High
- **File:** `packages/parser/src/xlsx/index.ts:28-78`
- **Description:** The server-side XLSX parser's `parseDateToISO` handles all date formats (full-date, YYYYMMDD, short-year, Korean full, Korean short) but does **not** validate month/day ranges for any of them. This is inconsistent with:
  - `apps/web/src/lib/parser/xlsx.ts` — has range validation for all formats
  - `packages/parser/src/csv/index.ts` — has range validation for all formats
  - `packages/parser/src/csv/generic.ts` — has range validation for all formats

  Corrupted data (e.g., "2026/13/99") would produce the invalid date string "2026-13-99" instead of being rejected.

- **Failure scenario:** An XLSX file with a malformed date cell (e.g., "2026-13-99") passes through without validation, producing an invalid ISO date string. Downstream code that assumes valid dates may behave unpredictably.

- **Fix:** Add month/day range validation (1-12 for month, 1-31 for day) to all date format branches in `packages/parser/src/xlsx/index.ts`, matching the pattern used in the web XLSX parser.

### C34-03: All 11 bank-specific CSV adapters lack month/day range validation in parseDateToISO

- **Severity:** LOW (consistency)
- **Confidence:** High
- **Files:**
  - `packages/parser/src/csv/hyundai.ts:4-10`
  - `packages/parser/src/csv/kb.ts:4-10`
  - `packages/parser/src/csv/ibk.ts:4-10`
  - `packages/parser/src/csv/woori.ts:4-10`
  - `packages/parser/src/csv/samsung.ts:4-10`
  - `packages/parser/src/csv/shinhan.ts:4-10`
  - `packages/parser/src/csv/lotte.ts:4-10`
  - `packages/parser/src/csv/hana.ts:4-10`
  - `packages/parser/src/csv/nh.ts:4-10`
  - `packages/parser/src/csv/bc.ts:4-10`
  - `packages/parser/src/csv/generic.ts:42-87` (already has validation)
- **Description:** Each bank-specific CSV adapter has its own local `parseDateToISO` function that handles YYYY-MM-DD and YYYYMMDD formats but does not validate month/day ranges. The main `packages/parser/src/csv/index.ts` (which wraps these adapters and provides its own generic fallback) does have range validation. The bank-specific adapters are called first; if they succeed, the validated generic fallback is never reached.

  The actual risk is low because bank-specific adapters receive data from known bank formats where date corruption is extremely unlikely. However, this is a consistency gap that should be addressed for defense-in-depth.

- **Failure scenario:** A corrupted CSV file that is correctly detected as a specific bank (e.g., 삼성카드 signature found) but has a malformed date in a transaction row. The bank adapter produces an invalid date string like "2026-13-99" without rejecting it.

- **Fix:** Add month/day range validation to each bank adapter's `parseDateToISO`, or better yet, extract a shared `parseDateToISO` utility to eliminate the 11 copies.

---

## Final Sweep — Cross-File Interactions

1. **All prior findings confirmed fixed:** C33-01 is verified as resolved. `bun test` passes with 266 tests, 0 failures.

2. **Date validation consistency audit complete:** I verified all 7 `parseDateToISO` implementations across the codebase:
   - `apps/web/src/lib/parser/csv.ts` — FULL (all formats + validation)
   - `apps/web/src/lib/parser/xlsx.ts` — FULL (all formats + validation)
   - `apps/web/src/lib/parser/pdf.ts` — FULL (all formats + validation)
   - `packages/parser/src/csv/index.ts` — FULL (all formats + validation)
   - `packages/parser/src/pdf/index.ts` — MINIMAL (only YYYY.MM.DD, no validation)
   - `packages/parser/src/xlsx/index.ts` — PARTIAL (all formats, NO validation)
   - 11 bank CSV adapters — PARTIAL (YYYY-MM-DD + YYYYMMDD, NO validation)

3. **Deferred items unchanged:** D-01 through D-105 remain unchanged from prior cycles.

4. **`cachedCoreRules` module-level cache:** Still present in `analyzer.ts:47`. Intentionally never invalidated since `cards.json` static data never changes within a session. Not a bug.

5. **AI categorizer disabled:** `categorizer-ai.ts` correctly stubs all methods to throw. `TransactionReview.svelte` checks `aiAvailable` before showing the AI button. No dead-code path issues.

6. **E2E test isolation:** `bunfig.toml` correctly excludes `e2e/**` from `bun test`. Confirmed working.

7. **Report HTML generator** (`packages/viz/src/report/generator.ts`): Uses `esc()` for HTML escaping of user-provided strings. The savings sign prefix (line 37) correctly prepends "+" for non-negative savings. No issues found.

---

## Summary of Active Findings (New in Cycle 34)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C34-01 | HIGH | High | `packages/parser/src/pdf/index.ts:14-18` | Server-side PDF parseDateToISO is a minimal stub — missing all date formats and range validation |
| C34-02 | MEDIUM | High | `packages/parser/src/xlsx/index.ts:28-78` | Server-side XLSX parseDateToISO missing month/day range validation |
| C34-03 | LOW | High | 11 bank CSV adapters | Bank-specific CSV adapters lack month/day range validation in parseDateToISO |
