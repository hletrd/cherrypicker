# Cycle 80 Plan — Fixes from Review

## Task 1: Fix FileDropzone filename-only dedup (C80-01)

**Severity:** MEDIUM | **Confidence:** HIGH  
**File:** `apps/web/src/components/upload/FileDropzone.svelte:138`

**Problem:** Duplicate-file detection uses filename only (`existing.name === f.name`). Two different credit card statements with the same filename (e.g., "statement.csv" from different months/banks) are silently dropped. The user sees "같은 이름의 파일이 이미 있어요" but may not realize the second file is a different statement.

**Fix:** Change dedup to compare both name AND size. If same name but different size, allow the file through. If same name AND same size, still drop (likely same file re-uploaded).

**Implementation:**
```typescript
// Before:
if (!uploadedFiles.some(existing => existing.name === f.name)) {
  valid.push(f);
} else {
  duplicateNames.push(f.name);
}

// After:
if (!uploadedFiles.some(existing => existing.name === f.name && existing.size === f.size)) {
  valid.push(f);
} else {
  duplicateNames.push(f.name);
}
```

**Status:** DONE

---

## Task 2: Disable TransactionReview category select during reoptimization (C80-02)

**Severity:** LOW | **Confidence:** MEDIUM  
**File:** `apps/web/src/components/dashboard/TransactionReview.svelte:288-299`

**Problem:** Category `<select>` dropdowns are NOT disabled during reoptimization. If the user changes a category while reoptimization is in progress, that edit is lost -- the reoptimization result overwrites `editedTxs` from the captured call-time value.

**Fix:** Add `disabled={reoptimizing}` to the `<select>` element in the transaction table.

**Implementation:**
```svelte
<select
  disabled={reoptimizing}
  value={...}
  ...
>
```

**Status:** DONE

---

## Task 3: Align CSV header scan limit with XLSX parser (C80-03)

**Severity:** LOW | **Confidence:** MEDIUM  
**File:** `apps/web/src/lib/parser/csv.ts:158`

**Problem:** CSV generic parser scans up to 20 lines for header detection (`Math.min(20, lines.length)`), while XLSX parser scans up to 30 rows (`Math.min(30, rows.length)`). Some bank CSV exports may have more than 20 metadata rows.

**Fix:** Increase CSV scan limit from 20 to 30 to match XLSX parser.

**Implementation:**
```typescript
// Before:
for (let i = 0; i < Math.min(20, lines.length); i++) {

// After:
for (let i = 0; i < Math.min(30, lines.length); i++) {
```

**Status:** DONE

---

## Deferred Items from This Cycle

### C80-01/D-47 extension: Same-name different-file dedup could still miss edge cases

- **Original finding:** C80-01 (extends D-47)
- **Severity:** LOW (UX)
- **Confidence:** Medium
- **File+line:** `apps/web/src/components/upload/FileDropzone.svelte:138`
- **Reason for deferral:** The name+size fix handles the common case (same name, different content = different file). However, two genuinely different statements could have the same name AND same size (extremely unlikely with real data). A more robust approach would be a confirmation dialog for same-name files, but that adds UX complexity.
- **Exit criterion:** If users report issues with same-name different-size statements being treated as different when they shouldn't be, add a confirmation dialog.
