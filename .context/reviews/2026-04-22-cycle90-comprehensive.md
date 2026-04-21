# Cycle 90 Comprehensive Review

**Date:** 2026-04-22
**Scope:** Full repository re-review with focus on fresh findings and verification of open items from C89 aggregate

---

## Verification of Prior Cycle Fixes (C89 Open Findings)

| Finding | Status | Evidence |
|---|---|---|
| C89-01 | **CONFIRMED OPEN (LOW)** | `VisibilityToggle.svelte:70-71` forward-direction `classList.toggle` still has no `isConnected` guard. Cleanup function at line 123 has the guard. `classList.toggle` on a disconnected element is a no-op, so no user-facing bug. |
| C89-02 | **CONFIRMED OPEN (LOW)** | `CategoryBreakdown.svelte:129` `rawPct < 2` threshold uses unrounded value while displayed pct is rounded. Known design choice documented in code comment. |
| C89-03 | **CONFIRMED OPEN (LOW)** | `formatters.ts:155-157` `formatYearMonthKo` uses `m!` non-null assertion after length check. Defensive chain works via `Number.isNaN` guard. No bug. |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C90-01 | MEDIUM | HIGH | `SpendingSummary.svelte:137-147` | Multi-month breakdown block uses `{@const}` declarations to compute `monthDiff`, `prevLabel`, etc. These are computed as template-level constants inside an `{#if}` block. If `mb.length >= 2` but the last two entries have malformed `month` strings (e.g., not matching `/^\d{4}-\d{2}$/`), the `monthRe.test()` guards correctly set `m1Valid/m2Valid` to `false`, but the `prevLabel` computation at line 147 falls back to "이전 실적" (the `!Number.isFinite(monthDiff)` branch). This is correct behavior -- not a bug. However, I note that `prevMonth` is accessed without a bounds check at line 150 (`prevMonth?.spending`). Since the `{#if}` condition at line 135 already confirms `mb.length > 1`, `mb[mb.length - 2]` is guaranteed to exist, so the optional chaining `?.` is defensive but correct. No issue. |
| C90-02 | LOW | MEDIUM | `OptimalCardMap.svelte:91-93` | The `getIssuerColor(issuer)` result is used as inline `style="background-color: ..."`. If `issuer` is `"kakao"`, the color is `#fee500` (bright yellow) which has very low contrast against white text (`color: white` on the badge). The same pattern exists in `SavingsComparison.svelte:198` and `TransactionReview.svelte:112`. This is a pre-existing accessibility issue (yellow-on-white fails WCAG AA contrast ratio 4.5:1) but it only affects the KakaoBank issuer badge -- a narrow cosmetic issue. Same as prior cycles' CATEGORY_COLORS dark mode contrast finding scope (affects one issuer badge, not data integrity). |
| C90-03 | LOW | LOW | `csv.ts:950-960` | `ADAPTERS` array has 10 entries (hyundai, kb, ibk, woori, samsung, shinhan, lotte, hana, nh, bc). The `BANK_SIGNATURES` in `detect.ts` has 24 entries. This means 14 banks (kakao, toss, kbank, bnk, dgb, suhyup, jb, kwangju, jeju, sc, mg, cu, kdb, epost) detected by `detectBank()` will fall through to the generic CSV parser. Same as C22-04/C74-08 -- already known and deferred. |
| C90-04 | LOW | LOW | `ReportContent.svelte:48` | `formatWon(opt.savingsVsSingleCard < 0 ? Math.abs(opt.savingsVsSingleCard) : opt.savingsVsSingleCard)` uses the FINAL value (not animated), which is correct for a static report view. The `>= 100` threshold for the '+' prefix is also applied at line 48. Consistent with SavingsComparison. No issue. |

---

## Fresh Deep Analysis: Cross-File Interaction Review

### 1. Parser Chain Consistency
All three parsers (CSV, XLSX, PDF) now delegate date parsing to `date-utils.ts` via `parseDateStringToISO()`. Amount parsing follows consistent patterns:
- CSV: `parseAmount()` returns `number | null`, `isValidAmount()` type guard filters zero/negative
- XLSX: `parseAmount()` returns `number | null`, inline `if (amount <= 0) continue`
- PDF: `parseAmount()` returns `number | null`, inline `if (amount > 0)` filter

All three paths correctly skip zero/negative amounts. No divergence found.

### 2. Store Consistency
`analysisStore.reoptimize()` captures a `snapshot` at function entry to prevent reactive variable changes during async gaps (C81-01). The snapshot is used for `...snapshot` spread at the end. The `previousMonthSpendingOption` is correctly preserved from the snapshot. No race condition found.

### 3. Category Label Caching
`cachedCategoryLabels` in `store.svelte.ts:378` is not invalidated on Astro View Transitions (C70-02, known deferred). The cache is reset only on `store.reset()`. If categories change between deployments while a user has the tab open, labels could be stale. This is the known deferred finding -- no change this cycle.

### 4. Session Storage Persistence
`persistToStorage()` correctly handles:
- Size limits (4MB with transaction truncation)
- Quota exceeded errors (DOMException detection)
- Non-quota errors (returns 'error' kind)
- Schema versioning with migration path (STORAGE_VERSION = 1, MIGRATIONS map)
- Validation on load with `isOptimizableTx()` type guard

No new issues found in the persistence layer.

### 5. Bank Detection
`detectBank()` caps confidence for single-pattern banks at 0.5 (C70-01). The `lastIndex` reset guard (line 139) prevents global-flag regex mutation. No issue.

### 6. XLSX HTML-as-XLS
`isHTMLContent()` decodes first 512 bytes as UTF-8 only. EUC-KR encoded files would not be detected. This is the known deferred C88-07/C73-06 finding. No change.

### 7. Dark Mode Color Contrast
Several hardcoded color maps (`CATEGORY_COLORS`, `getIssuerColor()`, `formatIssuerNameKo()`) do not adapt to dark mode. The `#fee500` (Kakao yellow) on white text fails WCAG AA. This is the aggregate of C8-05/C4-09/C73-07/C86-14 and C90-02. Known deferred.

---

## Still-Open Actionable Findings (fixable this cycle)

No actionable findings this cycle. All remaining open findings are LOW severity and deferred, carried forward from prior cycles.

---

## Deferred Findings (carried forward, not new)

All prior deferred findings from the C89 aggregate remain in effect. No changes to severity, confidence, or deferral status this cycle.
