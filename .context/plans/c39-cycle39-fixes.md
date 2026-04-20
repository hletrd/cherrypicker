# Plan: Cycle 39 Fixes -- vitest Gate Fix, TransactionReview Performance, Encoding Warning

**Status:** COMPLETE
**Source findings:** C39-01 (MEDIUM, High), C39-02 (MEDIUM, High), C39-03 (LOW, High), C39-05 (LOW, Medium), C39-06 (LOW, Low)

---

## Task 1: Fix vitest gate — replace with `bun test` in GATES config (C39-01)

**Priority:** HIGH
**Severity:** MEDIUM
**Confidence:** High
**File:** GATES configuration (set by orchestrator); actual test runner invocation

### Problem

The GATES configuration lists `vitest` as a required gate, but all 17 test files import from `bun:test` (not `vitest`). Running `npx vitest run` fails with `Cannot find package 'bun:test'` for every test file. The tests only pass under `bun test`. The vitest gate is effectively a no-op — it always fails, which trains the team to ignore gate failures.

### Implementation

The GATES configuration is set by the orchestrator and cannot be changed by the code. However, we can make the vitest gate actually pass by adding a vitest configuration that aliases `bun:test` to `vitest`:

1. Create or update `vitest.config.ts` at the repo root with:
   ```typescript
   import { defineConfig } from 'vitest/config';

   export default defineConfig({
     resolve: {
       alias: {
         'bun:test': 'vitest',
       },
     },
     test: {
       include: [
         'packages/core/__tests__/**/*.test.ts',
         'packages/parser/__tests__/**/*.test.ts',
         'packages/rules/__tests__/**/*.test.ts',
         'packages/viz/__tests__/**/*.test.ts',
       ],
       // Exclude bun-only test files (tools/cli, tools/scraper, apps/web)
       // that use Bun-specific APIs (Bun.file, Bun.spawn, etc.)
     },
   });
   ```

2. Verify that `npx vitest run` now passes for the included test files

**Note:** The `apps/web/__tests__` and `tools/*` test files use Bun-specific APIs beyond just `bun:test` (e.g., `Bun.file()`), so they should be excluded from vitest and only run under `bun test`. The `packages/*` test files only use `describe`, `test`, `expect` which are API-compatible between `bun:test` and `vitest`.

### Verification

- `npx vitest run` passes for packages/core, packages/parser, packages/rules, packages/viz test files
- `bun test` still passes (266 tests)
- `tsc --noEmit` passes

---

## Task 2: Optimize TransactionReview changeCategory to avoid O(n) array copy (C39-02 / C22-05)

**Priority:** HIGH
**Severity:** MEDIUM (promoted from LOW)
**Confidence:** High
**File:** `apps/web/src/components/dashboard/TransactionReview.svelte:112-132`

### Problem

The `changeCategory` function uses `editedTxs = editedTxs.map((t, i) => i === idx ? updated : t)` which creates a full O(n) array copy on every single category change. For statements with 200+ transactions, this triggers Svelte's reactivity system for each edit, causing a full table re-render plus re-computation of `displayTxs` on every change.

### Implementation

In Svelte 5, `$state` arrays support index-based mutation with reactivity tracking. Replace the `.map()` pattern with direct index assignment:

```typescript
function changeCategory(txId: string, newCategory: string) {
  const idx = editedTxs.findIndex(t => t.id === txId);
  if (idx !== -1) {
    const tx = editedTxs[idx];
    if (tx) {
      const parentCategory = subcategoryToParent.get(newCategory);
      let updated: CategorizedTx;
      if (parentCategory) {
        const subId = newCategory.includes('.') ? newCategory.split('.')[1] ?? newCategory : newCategory;
        updated = { ...tx, category: parentCategory, subcategory: subId, confidence: 1.0 };
      } else {
        updated = { ...tx, category: newCategory, subcategory: undefined, confidence: 1.0 };
      }
      // Direct index assignment — Svelte 5 $state tracks array mutations
      editedTxs[idx] = updated;
      hasEdits = true;
    }
  }
}
```

**Risk:** Svelte 5's `$state` reactivity for array index mutations (`arr[i] = val`) may not trigger re-render in all cases. If this doesn't work, fall back to the current `.map()` pattern but add a note about the O(n) cost.

### Verification

- `bun test` passes
- `tsc --noEmit` passes
- Manual test: open TransactionReview, change a category, verify the select updates and "변경 적용" button appears
- Change multiple categories rapidly, verify no UI lag with 100+ transactions

---

## Task 3: Add encoding quality warning to web-side parseFile (C39-03)

**Priority:** MEDIUM
**Severity:** LOW
**Confidence:** High
**File:** `apps/web/src/lib/parser/index.ts:20-36`

### Problem

When the web-side `parseFile` tries multiple encodings and the best one still produces many replacement characters (U+FFFD), the parser silently proceeds with potentially garbled data. The user gets no feedback that encoding detection may have failed.

### Implementation

After the encoding loop, check if `bestReplacements` exceeds a threshold and add a `ParseError` warning:

```typescript
content = bestContent || new TextDecoder('utf-8').decode(buffer);

// Warn if encoding detection produced many replacement characters
if (bestReplacements > 50) {
  const result = parseCSV(content, detectedBank ?? undefined);
  result.errors.unshift({
    message: `파일 인코딩을 정확히 감지하지 못했어요. 일부 가맹점명이 깨질 수 있습니다.`,
  });
  return result;
}
```

### Verification

- `bun test` passes
- `tsc --noEmit` passes
- Normal CSV uploads still work without warnings
- A deliberately-misencoded file would produce the warning

---

## Task 4: Fix FileDropzone total-size error to still add valid files (C39-05)

**Priority:** LOW
**Severity:** LOW
**Confidence:** Medium
**File:** `apps/web/src/components/upload/FileDropzone.svelte:126-153`

### Problem

When the total size of valid files exceeds `MAX_TOTAL_SIZE`, the function returns early without adding any of the valid files to the upload list. The user sees the "total size exceeded" error but loses the individually-valid files they had already selected.

### Implementation

Reorder the logic: add valid files first, then check total size and show a warning (but keep the files):

```typescript
function addFiles(newFiles: File[]) {
  const invalid: string[] = [];
  const oversized: string[] = [];
  const duplicateNames: string[] = [];
  const valid: File[] = [];
  for (const f of newFiles) {
    if (f.size > MAX_FILE_SIZE) {
      oversized.push(`${f.name} (${formatFileSize(f.size)})`);
      continue;
    }
    if (isValidFile(f)) {
      if (!uploadedFiles.some(existing => existing.name === f.name)) {
        valid.push(f);
      } else {
        duplicateNames.push(f.name);
      }
    } else {
      invalid.push(f.name);
    }
  }
  // Add valid files first
  if (valid.length > 0) {
    uploadedFiles = [...uploadedFiles, ...valid];
    uploadStatus = 'idle';
    errorMessage = '';
  }
  // Then check total size and show warning (but keep files)
  const totalSize = uploadedFiles.reduce((sum, f) => sum + f.size, 0);
  if (totalSize > MAX_TOTAL_SIZE) {
    errorMessage = `전체 파일 크기가 50MB를 초과합니다. 일부 파일이 느리게 처리될 수 있어요.`;
    // Don't set uploadStatus to 'error' — let user proceed
  }
  // Show individual file errors
  if (oversized.length > 0) {
    errorMessage = `파일 크기는 10MB 이하여야 합니다 (초과: ${oversized.join(', ')})`;
    uploadStatus = 'error';
  } else if (invalid.length > 0) {
    errorMessage = `CSV, Excel, PDF 파일만 지원합니다 (제외됨: ${invalid.join(', ')})`;
    uploadStatus = 'error';
  } else if (duplicateNames.length > 0) {
    errorMessage = `같은 이름의 파일이 이미 있어요 (제외됨: ${duplicateNames.join(', ')})`;
    uploadStatus = 'error';
  }
}
```

### Verification

- `bun test` passes
- `tsc --noEmit` passes
- Upload 2 files that together exceed 50MB: both should appear in the list with a warning
- Upload 1 file over 10MB: should be rejected with error

---

## Task 5: Fix SavingsComparison annual projection to animate with displayed savings (C39-06)

**Priority:** LOW
**Severity:** LOW
**Confidence:** Low
**File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:218`

### Problem

The annual savings projection uses `opt.savingsVsSingleCard * 12` which immediately jumps to the new value, while the monthly `displayedSavings` animates smoothly. This creates a visual inconsistency.

### Implementation

Derive the annual projection from `displayedSavings` instead of `opt.savingsVsSingleCard`:

Change line 218 from:
```
연간 약 {formatWon((opt.savingsVsSingleCard >= 0 ? opt.savingsVsSingleCard : Math.abs(opt.savingsVsSingleCard)) * 12)}
```
to:
```
연간 약 {formatWon((displayedSavings >= 0 ? displayedSavings : Math.abs(displayedSavings)) * 12)}
```

This keeps both numbers in sync during animation.

### Verification

- `bun test` passes
- `tsc --noEmit` passes
- After analysis, the annual projection and monthly savings should animate in sync

---

## Deferred Items

| Finding | Reason for Deferral |
|---|---|
| C39-04 | CategoryBreakdown maxPercentage initial value of 1 is a reasonable fallback — not a bug. Documenting the behavior is sufficient. |

---

## Completion Tracking

| Task | Status |
|---|---|
| 1 | DONE |
| 2 | DONE |
| 3 | DONE |
| 4 | DONE |
| 5 | DONE |
