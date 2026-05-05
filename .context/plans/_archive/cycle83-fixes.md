# Cycle 83 Plan — Fixes from Review

## Task 1: Fix ReportContent sign-prefix threshold to match SavingsComparison (C83-01)

**Severity:** MEDIUM | **Confidence:** HIGH
**File:** `apps/web/src/components/report/ReportContent.svelte:48`

**Problem:** The `+` prefix logic in ReportContent uses `opt.savingsVsSingleCard > 0` while SavingsComparison uses `displayedSavings >= 100` (the C82-03 fix). For small savings values (1-99 won), the report page shows "+1원" or "+50원" while the dashboard shows "1원" or "50원". This is a direct inconsistency between two views of the same data.

**Fix:** Change `opt.savingsVsSingleCard > 0` to `opt.savingsVsSingleCard >= 100` in ReportContent line 48, matching the SavingsComparison threshold. The 100-won threshold is justified because 100 won is the minimum meaningful amount in Korean banking.

**Implementation:**
Change line 48 from:
```
{opt.savingsVsSingleCard > 0 ? '+' : ''}{formatWon(opt.savingsVsSingleCard)}
```
to:
```
{opt.savingsVsSingleCard >= 100 ? '+' : ''}{formatWon(opt.savingsVsSingleCard)}
```

**Status:** DONE

---

## Task 2: Change unnecessary `$state` variables to plain `let` in SavingsComparison (C83-02)

**Severity:** LOW | **Confidence:** MEDIUM
**File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:46-47`

**Problem:** `lastTargetSavings` and `lastTargetAnnual` are `$state` but only read/written within the same `$effect`. No other reactive binding depends on them. Plain `let` would be semantically correct and avoid unnecessary reactivity tracking.

**Fix:** Change from `$state` to plain `let`.

**Implementation:**
Change lines 46-47 from:
```typescript
let lastTargetSavings = $state(0);
let lastTargetAnnual = $state(0);
```
to:
```typescript
let lastTargetSavings = 0;
let lastTargetAnnual = 0;
```

**Status:** DONE

---

## Task 3: Fix redundant minus sign under "추가 비용" label in both ReportContent and SavingsComparison (C83-03)

**Severity:** LOW | **Confidence:** MEDIUM
**File:** `apps/web/src/components/report/ReportContent.svelte:46-49` + `apps/web/src/components/dashboard/SavingsComparison.svelte:223,230`

**Problem:** When cherry-picking is worse than a single card, the label changes to "추가 비용" but the amount still shows a minus sign (e.g., "추가 비용: -5,000원"). The minus sign and "추가 비용" label both indicate the same negative direction, making the minus sign redundant and potentially confusing. The `formatWon` function also formats negative numbers with a minus sign, so the display is doubly negative.

**Fix:** When `savingsVsSingleCard < 0`, show the absolute value of the savings. The "추가 비용" label already communicates the negative direction.

**Implementation:**

In ReportContent.svelte line 48, change:
```
{opt.savingsVsSingleCard > 0 ? '+' : ''}{formatWon(opt.savingsVsSingleCard)}
```
to (with both C83-01 and C83-03 fixes applied):
```
{opt.savingsVsSingleCard >= 100 ? '+' : ''}{formatWon(opt.savingsVsSingleCard < 0 ? Math.abs(opt.savingsVsSingleCard) : opt.savingsVsSingleCard)}
```

In SavingsComparison.svelte line 230, change:
```
{displayedSavings >= 100 ? '+' : ''}{formatWon(displayedSavings)}
```
to:
```
{displayedSavings >= 100 ? '+' : ''}{formatWon(displayedSavings < 0 ? Math.abs(displayedSavings) : displayedSavings)}
```

Also update the label at line 223 from `{opt.savingsVsSingleCard >= 0 ? '추가 절약' : '추가 비용'}` -- this is already correct (the label changes based on sign).

**Status:** DONE

---

## Task 4: Change unnecessary `$state` variable to plain `let` in SpendingSummary (C83-04)

**Severity:** LOW | **Confidence:** MEDIUM
**File:** `apps/web/src/components/dashboard/SpendingSummary.svelte:13`

**Problem:** Same pattern as C83-02: `lastWarningGeneration` is `$state` but only read/written within the same `$effect`. Plain `let` would suffice.

**Fix:** Change from `$state` to plain `let`.

**Implementation:**
Change line 13 from:
```typescript
let lastWarningGeneration = $state(0);
```
to:
```typescript
let lastWarningGeneration = 0;
```

**Status:** DONE

---

## Task 5: Add line sampling limit to `detectCSVDelimiter` (C83-05)

**Severity:** LOW | **Confidence:** MEDIUM
**File:** `apps/web/src/lib/parser/detect.ts:171-188`

**Problem:** `detectCSVDelimiter` splits the content by newlines and counts delimiter occurrences on every line. For large files with thousands of lines, this creates many regex match arrays unnecessarily. The delimiter pattern is consistent throughout a file, so sampling the first 30 lines is sufficient.

**Fix:** Add a sampling limit of 30 lines, matching the header scan limit used elsewhere.

**Implementation:**
Change line 172 from:
```typescript
const lines = content.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
```
to:
```typescript
const lines = content.split('\n').map((l) => l.trim()).filter((l) => l.length > 0).slice(0, 30);
```

**Status:** DONE

---

## Deferred Items from This Cycle

### C82-04: parseFile double memory for CSV (ArrayBuffer + decoded string)
- **Original finding:** C82-04 (re-confirmed C83)
- **Severity:** LOW
- **Confidence:** MEDIUM
- **File+line:** `apps/web/src/lib/parser/index.ts:17-68`
- **Reason for deferral:** For CSV files, `parseFile` reads the file into an ArrayBuffer (~10MB) then decodes with TextDecoder into a JavaScript string (~30MB UTF-16), creating ~40MB peak memory for a 10MB file. However, the encoding detection heuristic requires comparing decoded outputs from multiple encodings (utf-8 vs cp949), which needs the raw ArrayBuffer. The 10MB file size limit bounds peak memory at ~40MB, which is acceptable for a client-side app.
- **Exit criterion:** If memory usage becomes an issue on mobile devices with large CSV uploads, refactor to use streaming text decoding with encoding detection on a partial buffer.

### C82-05: VisibilityToggle direct DOM mutation (re-confirmation of C18-01/C76-04/C79-02)
- **Original finding:** C82-05/C83 (re-confirmation)
- **Severity:** LOW
- **Confidence:** HIGH
- **File+line:** `apps/web/src/components/ui/VisibilityToggle.svelte:70-71,90-108,119-125`
- **Reason for deferral:** Same as prior deferrals. The pattern works correctly with the `isConnected` guard (C21-01) but bypasses Svelte's DOM diffing. The architectural fix requires refactoring how the dashboard and results pages manage their data/empty state visibility.
- **Exit criterion:** When the dashboard page is refactored to use Svelte-only state management (no server-rendered empty state divs), replace VisibilityToggle with Svelte reactive bindings.

### C78-02: FALLBACK_CATEGORIES leading-space labels
- **Original finding:** C78-02/C83 (re-confirmation)
- **Severity:** LOW
- **Confidence:** HIGH
- **File+line:** `apps/web/src/components/dashboard/TransactionReview.svelte:36-64`
- **Reason for deferral:** The leading spaces provide visual hierarchy in the dropdown (indenting subcategories under parent categories). Removing them would flatten the visual hierarchy, making it harder for users to distinguish parent from child categories. Alternative approaches (CSS padding, optgroup) would require more significant changes to the select element rendering across browsers.
- **Exit criterion:** When the select dropdown is replaced with a custom dropdown component that supports visual hierarchy via CSS, remove the leading spaces and use CSS for indentation.
