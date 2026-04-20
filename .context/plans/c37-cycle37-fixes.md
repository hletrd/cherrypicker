# Plan: Cycle 37 Fixes -- CSV parseAmount Type Safety + FileDropzone Unmount Guard

**Status:** DONE
**Source findings:** C37-01 (MEDIUM, High), C37-02 (LOW, High), C37-03 (MEDIUM, High)

---

## Task 1: Fix web-side CSV parseAmount to return null instead of NaN (C37-01)

**Priority:** HIGH
**Severity:** MEDIUM
**Confidence:** High
**File:** `apps/web/src/lib/parser/csv.ts:33-45`

### Problem

The web-side CSV `parseAmount` returns `NaN` (a `number`) for unparseable inputs, while every other parser in the codebase returns `null`. The `number` return type hides the risk of NaN propagation -- if a future caller uses `parseAmount` directly without the `isValidAmount` guard, NaN will silently propagate into transaction amounts.

### Implementation

1. Change `parseAmount` return type from `number` to `number | null`
2. Return `null` instead of `NaN` for unparseable inputs
3. Update `isValidAmount` to handle `null` returns from `parseAmount`
4. Simplify `isValidAmount` to just check for null and zero (after parseAmount returns null instead of NaN)

Replace the current `parseAmount` and `isValidAmount`:

```typescript
function parseAmount(raw: string): number | null {
  let cleaned = raw.trim();
  // Handle (1,234) format for negative amounts
  const isNegative = cleaned.startsWith('(') && cleaned.endsWith(')');
  if (isNegative) cleaned = cleaned.slice(1, -1);
  cleaned = cleaned.replace(/원$/, '').replace(/,/g, '').replace(/\s/g, '');
  const parsed = Math.round(parseFloat(cleaned));
  if (Number.isNaN(parsed)) return null;
  return isNegative ? -parsed : parsed;
}

/** Check if a parsed amount is valid (not null, not zero). Pushes an error
 *  and returns false if the amount is null, so the caller can skip the
 *  transaction. Zero-amount rows are also skipped (balance inquiries,
 *  declined transactions) which don't contribute to optimization. */
function isValidAmount(amount: number | null, amountRaw: string, lineIdx: number, errors: ParseError[]): boolean {
  if (amount === null) {
    if (amountRaw.trim()) {
      errors.push({ line: lineIdx + 1, message: `금액을 해석할 수 없습니다: ${amountRaw}` });
    }
    return false;
  }
  if (amount === 0) return false;
  return true;
}
```

### Verification

- `bun test` from repo root should pass
- `bun run lint` should pass (0 errors)
- `bun run typecheck` should pass (0 errors)
- Web CSV parsing behavior is unchanged (null is caught by isValidAmount)

---

## Task 2: Simplify isValidAmount after parseAmount returns null (C37-02)

**Priority:** MEDIUM
**Severity:** LOW
**Confidence:** High
**File:** `apps/web/src/lib/parser/csv.ts:49-61`

### Problem

`isValidAmount` currently combines NaN check and zero-amount filter. After Task 1 makes `parseAmount` return `null` instead of `NaN`, the NaN check becomes a null check, which is the same pattern used by all other parsers (PDF, XLSX, server CSV). This task is done as part of Task 1 -- the simplified `isValidAmount` shown above handles both concerns cleanly.

### Verification

- Same as Task 1 -- covered by the same changes

---

## Task 3: Add active guard to FileDropzone page-level drag handlers (C37-03)

**Priority:** HIGH
**Severity:** MEDIUM
**Confidence:** High
**File:** `apps/web/src/components/upload/FileDropzone.svelte:11-43`

### Problem

The `onMount` callback adds four event listeners to `document` for page-wide drag and drop. The cleanup function correctly removes them, but there is no guard preventing the handlers from running after the component is unmounted. During Astro View Transitions, the component may be unmounted and remounted, and stale closures could cause `isDragOver` to get stuck in a true state.

### Implementation

Add an `active` guard that is set to `false` in the cleanup function:

```typescript
onMount(() => {
  let active = true;
  let dragCount = 0;
  function onDragEnter(e: DragEvent) {
    if (!active) return;
    e.preventDefault();
    dragCount++;
    if (dragCount === 1) isDragOver = true;
  }
  function onDragLeave(e: DragEvent) {
    if (!active) return;
    e.preventDefault();
    dragCount--;
    if (dragCount <= 0) { dragCount = 0; isDragOver = false; }
  }
  function onDragOver(e: DragEvent) { if (!active) return; e.preventDefault(); }
  function onPageDrop(e: DragEvent) {
    if (!active) return;
    e.preventDefault();
    dragCount = 0;
    isDragOver = false;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      addFiles(Array.from(files));
    }
  }
  document.addEventListener('dragenter', onDragEnter);
  document.addEventListener('dragleave', onDragLeave);
  document.addEventListener('dragover', onDragOver);
  document.addEventListener('drop', onPageDrop);
  return () => {
    active = false;
    document.removeEventListener('dragenter', onDragEnter);
    document.removeEventListener('dragleave', onDragLeave);
    document.removeEventListener('dragover', onDragOver);
    document.removeEventListener('drop', onPageDrop);
  };
});
```

### Verification

- `bun test` from repo root should pass
- `bun run lint` should pass (0 errors)
- `bun run typecheck` should pass (0 errors)
- Drag-and-drop file upload still works correctly
- `isDragOver` cannot get stuck after component unmount

---

## Deferred Items

| Finding | Reason for Deferral |
|---|---|
| None | All findings have tasks scheduled above |

---

## Completion Tracking

| Task | Status |
|---|---|
| 1 | DONE |
| 2 | DONE (covered by Task 1) |
| 3 | DONE |
