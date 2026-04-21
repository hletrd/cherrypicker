# Cycle 77 Implementation Plan

**Date:** 2026-04-22
**Status:** In Progress

---

## Task 1: Fix `parseGenericCSV` header detection to validate candidate rows against known header keywords

**Finding:** C77-03 (MEDIUM / HIGH)
**File:** `apps/web/src/lib/parser/csv.ts:146-154`

**Problem:** The generic CSV parser's header detection (lines 147-154) searches the first 20 lines for the first row containing non-numeric cells (cells matching `/[가-힣a-zA-Z]/`). This heuristic assumes the header is the first row with text content. However, some bank statements have metadata rows before the header (e.g., bank name like "카드명: 우리 체크카드", statement period like "조회기간: 2024.01.01 ~ 2024.01.31") that also contain Korean text. If such a metadata row appears before the header, it would be incorrectly identified as the header row, causing all subsequent data rows to fail column matching.

**Fix:** After identifying a candidate header row via the Korean/alpha heuristic, validate that it contains at least one known header keyword. If not, continue searching subsequent rows. This mirrors the validation approach used by the bank-specific adapters and the XLSX parser's header detection.

**Implementation:**
Replace the current header detection block (lines 146-154):
```typescript
  // Find header row
  let headerIdx = 0;
  for (let i = 0; i < Math.min(20, lines.length); i++) {
    const cells = splitLine(lines[i] ?? '', delimiter);
    const hasNonNumeric = cells.some((c) => /[가-힣a-zA-Z]/.test(c));
    if (hasNonNumeric) {
      headerIdx = i;
      break;
    }
  }
```

With:
```typescript
  // Find header row — search for the first row with Korean/alpha text that
  // also contains at least one known header keyword. Rows with Korean text
  // but no header keywords are likely metadata (bank name, statement period)
  // rather than the actual column header row (C77-03).
  const HEADER_KEYWORDS = [
    '이용일', '이용일자', '거래일', '거래일시', '날짜', '일시', '결제일', '승인일', '매출일',
    '이용처', '가맹점', '가맹점명', '이용가맹점', '거래처', '매출처', '사용처', '결제처', '상호',
    '이용금액', '거래금액', '금액', '결제금액', '승인금액', '매출금액', '이용액',
  ];
  let headerIdx = 0;
  for (let i = 0; i < Math.min(20, lines.length); i++) {
    const cells = splitLine(lines[i] ?? '', delimiter);
    const hasNonNumeric = cells.some((c) => /[가-힣a-zA-Z]/.test(c));
    if (hasNonNumeric) {
      // Validate that this row contains at least one known header keyword.
      // Without this check, metadata rows (bank name, statement period) that
      // contain Korean text would be misidentified as the header row (C77-03).
      const hasHeaderKeyword = cells.some((c) => HEADER_KEYWORDS.includes(c.trim()));
      if (hasHeaderKeyword) {
        headerIdx = i;
        break;
      }
    }
  }
```

---

## Task 2: Run quality gates (eslint, tsc --noEmit, vitest, bun test)

**Requirement:** All gates must pass before cycle completion.

---

## Deferred Items (this cycle)

The following findings from this cycle's review are deferred per the repo's rules:

### C77-02: Annual savings projection uses simple *12 multiplication
- **Severity:** LOW / MEDIUM
- **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:60-71`
- **Reason for deferral:** Known issue flagged by 16+ prior cycles. The label "최근 월 기준 단순 연환산" makes the approximation transparent. The projection is an estimate, not a guarantee. Changing to a more sophisticated model (e.g., weighted average across all months) would require UI changes and is not a bug fix.
- **Exit criterion:** If user feedback indicates the simple projection is misleading, switch to a weighted average across all uploaded months.

### C77-04: formatIssuerNameKo and getIssuerColor are 7th/8th copies of the bank list
- **Severity:** LOW / HIGH
- **File:** `apps/web/src/lib/formatters.ts:51-79,115-143`
- **Reason for deferral:** Known issue (C66-08/C74-04) flagged by many prior cycles. All 5+ copies are currently in sync. Deduplication requires an architectural refactor (shared bank registry module) that is a larger change than justified for a sync risk that hasn't materialized.
- **Exit criterion:** When the shared bank registry module is created, consolidate all 5+ bank list copies into it.

### C76-02: FALLBACK_CATEGORIES leading-space labels cause browser-inconsistent dropdown rendering
- **Severity:** LOW / HIGH
- **File:** `apps/web/src/components/dashboard/TransactionReview.svelte:36-64`
- **Reason for deferral:** The leading spaces are intentional for visual hierarchy in the dropdown. The `includes()` search matching works correctly regardless of leading spaces. Browser rendering of leading spaces in `<option>` is inconsistent but does not cause functional issues.
- **Exit criterion:** If a browser is found that completely ignores leading spaces in `<option>` elements, switch to CSS-based indentation or Unicode em-spaces.

### C76-03: SpendingSummary dismissal not reset on store.reset()
- **Severity:** LOW / MEDIUM
- **File:** `apps/web/src/components/dashboard/SpendingSummary.svelte:17-27`
- **Reason for deferral:** The warning is informational ("tab close will lose data"). Once dismissed, re-showing it after each re-analysis would be disruptive. The dismissal clears on tab close (sessionStorage behavior).
- **Exit criterion:** If user feedback indicates the warning should re-appear after a fresh analysis, add a `reset()` listener.

### C76-04: VisibilityToggle $effect directly mutates DOM
- **Severity:** LOW / HIGH
- **File:** `apps/web/src/components/dashboard/OptimalCardMap.svelte:62-127`
- **Reason for deferral:** Known architectural limitation (C18-01/C50-08) flagged by many prior cycles. The direct DOM mutation is necessary because the managed elements belong to Astro's DOM tree.
- **Exit criterion:** When the Astro page is refactored to use Svelte-managed elements, replace direct DOM mutation with Svelte reactivity.

### C76-05: build-stats.ts fallback values will drift
- **Severity:** LOW / MEDIUM
- **File:** `apps/web/src/lib/build-stats.ts:17-19`
- **Reason for deferral:** Known issue (C8-07/C67-02) deferred by 13+ prior cycles. Fallback only used when cards.json is unavailable at build time.
- **Exit criterion:** When a CI step can validate fallback values against the actual cards.json at build time, automate the check.

---

## Progress

- [x] Task 1: Fix parseGenericCSV header detection
- [x] Task 2: Quality gates -- all pass (tsc: 0 errors, vitest: 189/189, bun test: 290/290)
