# Cycle 7 Implementation Plan

**Date:** 2026-05-05
**Source reviews:** `.context/reviews/cycle7-*.md`, `.context/reviews/_aggregate.md`
**Status:** COMPLETED

---

## Tasks

### Task 1: Fix web-side JSON parser Math.abs regression [C7-01] ✅ DONE

- **Severity:** HIGH
- **Confidence:** High
- **Files:** `apps/web/src/lib/parser/json.ts:98-111`
- **Description:** The server-side JSON parser was fixed in Cycle 6 to preserve negative amounts (refunds/credits). The web-side parser still takes `Math.abs()`, converting refunds to positive purchases. The comment at lines 98-99 falsely claims this matches server-side behavior.
- **Fix:**
  1. Remove `const absAmount = Math.abs(amount);` at line 101
  2. Change `amount: absAmount` at line 111 to `amount`
  3. Update comment to accurately describe behavior (preserves negative amounts; optimizer filters them)
- **Verification:** Parse `[{date:'2024-01-15',merchant:'Refund',amount:-15000}]` via web-side parser. Result must have `amount: -15000`.

### Task 2: Fix web-side HTML parser negative amount handling [C7-02] ✅ DONE

- **Severity:** MEDIUM
- **Confidence:** High
- **Files:** `apps/web/src/lib/parser/html.ts:220-223`
- **Description:** Web-side HTML parser does `amount: Math.abs(amount)` while server-side uses `if (amount <= 0) continue;`. Different semantics produce different transaction counts and totals.
- **Fix:**
  1. Replace `amount: Math.abs(amount)` with `amount`
  2. Add `if (amount <= 0) continue;` before transaction creation to align with server-side
- **Verification:** Parse HTML with negative amount cells. Non-positive amounts should be skipped.

### Task 3: Align web-side HTML parser xlsx.read with server-side [C7-CR-03] ✅ DONE

- **Severity:** MEDIUM
- **Confidence:** Medium
- **Files:** `apps/web/src/lib/parser/html.ts:39`
- **Description:** Web-side uses `xlsx.read(normalized, { type: 'string' })` while server-side uses `xlsx.read(Buffer.from(normalized, 'utf-8'), { type: 'buffer' })`. Potential encoding issues with non-ASCII Korean content.
- **Fix:**
  1. Change web-side to wrap normalized HTML in `Buffer.from(normalized, 'utf-8')`
  2. Change `type: 'string'` to `type: 'buffer'`
- **Verification:** Parse Korean HTML statements with non-ASCII characters. Ensure correct encoding.

### Task 4: Add timezone handling to web-side OFX parser [C7-03] ✅ DONE

- **Severity:** MEDIUM
- **Confidence:** Medium
- **Files:** `apps/web/src/lib/parser/ofx.ts:43-49`
- **Description:** Web-side OFX parser strips non-digits from dates. Server-side has KST timezone conversion. Same OFX file produces different dates between server and web.
- **Fix:**
  1. Copy server-side `parseOFXDate` implementation from `packages/parser/src/ofx/index.ts:75-102` to web-side
  2. Ensure `parseDateStringToISO` and `isValidISODate` imports are available
- **Verification:** Parse OFX with timezone offsets (e.g., `20240115T230000[-05:GMT]`). Web and server must produce identical ISO dates.

### Task 5: Replace FALLBACK_CATEGORY_LABELS with buildCategoryLabelMap [C7-04] ✅ DONE

- **Severity:** HIGH
- **Confidence:** High
- **Files:** `apps/web/src/lib/category-labels.ts`
- **Description:** 78-entry hardcoded `FALLBACK_CATEGORY_LABELS` Map duplicates taxonomy and recreates the `CATEGORY_NAMES_KO` anti-pattern eliminated in Cycle 6.
- **Fix:**
  1. Import `buildCategoryLabelMap` from `@cherrypicker/rules` (if available in web bundle)
  2. If not available, import the function directly or generate fallback at build time
  3. Alternatively: keep the Map but generate it from categories.json at build time to eliminate manual maintenance
  4. Remove the hardcoded entries
- **Verification:** Build passes, web app category labels display correctly even when fetch fails.

### Task 6: Harden HTML report esc() and add CSP [C7-05] ✅ DONE

- **Severity:** MEDIUM
- **Confidence:** High
- **Files:** `packages/viz/src/report/generator.ts:31-40`, report template
- **Description:** `esc()` handles only 7 entities. Missing control character handling. No CSP meta tag in generated reports.
- **Fix:**
  1. Add control character stripping to `esc()`: `.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')`
  2. Add CSP meta tag to report HTML template
- **Verification:** Generate report with special characters in merchant names. No XSS vectors possible.

### Task 7: Add JSON negative amount tests [C7-06 / T6-03] ✅ DONE

- **Severity:** MEDIUM
- **Confidence:** High
- **Files:** `packages/parser/__tests__/json.test.ts`
- **Description:** No tests verify that negative amounts are preserved in JSON parser.
- **Fix:**
  1. Add test case with negative amount
  2. Add test case with zero amount (should be skipped)
  3. Add test case with positive amount (should be preserved)
- **Verification:** Tests pass.

---

## Deferred Items

The following long-standing findings remain deferred per repo convention (see `.context/plans/00-deferred-items.md`). They are architectural or tooling investments beyond the scope of a single fix cycle.

### Deferred: Server/web parser structural unification
- **Original finding:** D-01 (Cycle 1), F-CRI-01, A-ARCH-01
- **Severity:** HIGH (architectural)
- **Reason:** Major refactor requiring design doc and incremental implementation
- **Exit criterion:** Extract shared parser core into `packages/parser/src/shared/`, both server and web import from it

### Deferred: Non-KRW transactions silently dropped
- **Original finding:** C-CR-01 (Cycle 5)
- **Severity:** HIGH (correctness)
- **Reason:** Requires currency detection in parsers and multi-currency support in calculator
- **Exit criterion:** Add currency field to RawTransaction, add exchange rate handling, or add explicit logging when non-KRW transactions are skipped

### Deferred: Regex DoS in column patterns
- **Original finding:** Cycle 4
- **Severity:** MEDIUM (security/performance)
- **Reason:** Requires regex audit and timeout guards
- **Exit criterion:** Add ReDoS-safe validation or timeout wrappers to all user-input regexes

### Deferred: PDF three code paths
- **Original finding:** Cycle 4
- **Severity:** MEDIUM (maintainability)
- **Reason:** Requires consolidation of table-parser, extractor, and LLM fallback paths
- **Exit criterion:** Merge into single coherent pipeline with clear fallback ordering

### Deferred: No brute-force benchmark
- **Original finding:** Cycle 4
- **Severity:** LOW (tooling)
- **Exit criterion:** Add benchmark script comparing greedy vs ILP vs brute-force for small inputs

### Deferred: Deferred-fix tracking fragmented
- **Original finding:** Cycle 4
- **Severity:** LOW (process)
- **Exit criterion:** Consolidate all deferred items into a single tracked file with review dates

---

## Archive

The following Cycle 6 plan tasks are fully implemented and verified. Archive references:

| Task | Commit | Status |
|------|--------|--------|
| C6-01: JSON Math.abs (server) | `fcd398b` | DONE — but web-side not updated (regression found in C7) |
| C6-02: Web ParseError parity | `c55005d` | DONE |
| A6-01: buildCategoryLabelMap extraction | `88836e7` | DONE |
| C6-03: Anthropic model name | `86100a8` | DONE |
| C6-04: LLM consent localization | `2f3a3ee` | DONE |
| S6-01: Path validation | `ea98316` | DONE |
