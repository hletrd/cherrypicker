# Plan 57 — Low Priority Fixes (Cycle 31)

**Source findings:** C31-CR02, C31-CR03, C31-SEC03, C31-PERF01, C31-PERF03, C31-DEBUG02, C31-DEBUG03, C31-UI01, C31-UI02, C31-DOC01, C31-DOC02, C31-DOC03, C31-ARCH02, C31-ARCH03

---

## Task 1: Add explanatory comment to `parseOFXDate` timezone conversion

**Finding:** C31-CR02
**Severity:** LOW
**Confidence:** Medium
**Files:** `apps/web/src/lib/parser/ofx.ts:53-80`, `packages/parser/src/ofx/index.ts:82-109`

### Problem

The `parseOFXDate` function uses `getUTC*` on a +9h-shifted Date to get KST values, which is non-obvious without a comment.

### Implementation

1. Add comment explaining the KST conversion technique:
   ```typescript
   // Shift timestamp by +9 hours, then read with getUTC* to get KST values
   // This avoids timezone localization issues across different environments
   ```
2. Apply to both web and server implementations

### Exit Criterion

- Comment explains why `getUTC*` is used instead of local getters

---

## Task 2: Optimize `findField` to skip case-insensitive fallback for Korean aliases

**Finding:** C31-CR03
**Severity:** LOW
**Confidence:** Medium
**Files:** `apps/web/src/lib/parser/json.ts:66-75`, `packages/parser/src/json/index.ts:67-76`

### Problem

For each alias, the code first checks `Object.hasOwn(obj, alias)`, then falls back to iterating all keys with case-insensitive comparison. Korean aliases have no case variation, so the fallback is pure overhead.

### Implementation

1. Separate English aliases from Korean aliases, or add an early check for non-Latin aliases
2. For Korean aliases, skip the case-insensitive fallback loop
3. Measure performance difference

### Exit Criterion

- Korean aliases don't trigger the case-insensitive fallback loop
- English aliases still support case-insensitive matching

---

## Task 3: Expand `safeJSONParse` forbidden keys for completeness

**Finding:** C31-SEC03
**Severity:** LOW
**Confidence:** High
**File:** `apps/web/src/lib/store.svelte.ts:213-221`

### Problem

The reviver blocks `__proto__`, `constructor`, `prototype` but doesn't block `__defineGetter__`, `__defineSetter__`, `__lookupGetter__`, `__lookupSetter__`.

### Implementation

1. Expand the forbidden set:
   ```typescript
   const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype',
     '__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__']);
   ```
2. Add test verifying all forbidden keys are rejected

### Exit Criterion

- All listed forbidden keys are blocked
- Existing `__proto__` / `constructor` / `prototype` tests still pass

---

## Task 4: Optimize JSON `findField` with reverse lookup map

**Finding:** C31-PERF01
**Severity:** LOW
**Confidence:** Medium
**Files:** `apps/web/src/lib/parser/json.ts:66-75`, `packages/parser/src/json/index.ts:67-76`

### Problem

`findField` is O(n*m) per transaction. With 1000 transactions, this is ~1M key comparisons per field type.

### Implementation

1. Build a reverse lookup map once per object: `{ lowerCaseKey: actualKey }`
2. Alias lookup becomes O(n) instead of O(n*m)
3. Apply to both web and server implementations

### Exit Criterion

- `findField` uses a reverse lookup map
- Performance improvement is measurable for large JSON files

---

## Task 5: Document `cachedCoreRules` cache invariant

**Finding:** C31-PERF03
**Severity:** LOW
**Confidence:** High
**File:** `apps/web/src/lib/store.svelte.ts:58-89`

### Problem

`cachedCoreRules` is intentionally not keyed by `cardIds`, assuming a specific calling pattern. This invariant is not prominently documented.

### Implementation

1. Add a prominent comment:
   ```typescript
   // INVARIANT: This cache assumes analyzeAll() is called before reoptimize().
   // If calling patterns change, the cache must be keyed by cardIds or invalidated.
   ```
2. Consider adding a debug-mode assertion

### Exit Criterion

- Cache invariant is clearly documented in code

---

## Task 6: Fix LLM fallback truncation for multi-byte character safety

**Finding:** C31-DEBUG02
**Severity:** LOW
**Confidence:** Medium
**File:** `packages/parser/src/pdf/llm-fallback.ts:54`

### Problem

Truncation at 8000 characters may cut multi-byte Korean characters mid-sequence (though `slice` uses UTF-16 code units, not bytes).

### Implementation

1. Use a byte-aware truncation or ensure slice ends at a word boundary
2. Alternatively, use `TextEncoder` to check byte length and truncate safely
3. Add test with Korean text at boundary

### Exit Criterion

- Truncation doesn't produce invalid UTF-8/UTF-16 sequences
- Korean text is handled safely at truncation boundary

---

## Task 7: Verify OFX date regex handles all Korean bank timezone formats

**Finding:** C31-DEBUG03
**Severity:** LOW
**Confidence:** Low
**Files:** `apps/web/src/lib/parser/ofx.ts:55`, `packages/parser/src/ofx/index.ts:82`

### Problem

The regex expects `[offset:TZNAME]` format. Some OFX files use `[offset]` without `:TZNAME`.

### Implementation

1. Test with real Korean bank OFX exports if available
2. If `[offset]` format is found, update regex to handle both formats:
   ```typescript
   /\[([+-]?\d+)(?::[A-Z]+)?\]/
   ```
3. Add test cases for both timezone formats

### Exit Criterion

- Both `[+9:KST]` and `[+9]` formats are handled
- Tests verify both patterns

---

## Task 8: Make parser error messages actionable

**Finding:** C31-UI01
**Severity:** LOW
**Confidence:** Medium
**File:** `apps/web/src/components/upload/FileDropzone.svelte`

### Problem

Parser error messages show raw garbled strings without suggesting next steps.

### Implementation

1. Enhance error messages with actionable suggestions:
   - "Check if the file format matches your bank"
   - "Try exporting as CSV instead"
   - "Ensure the file is not corrupted"
2. Keep technical details available (e.g., in a details expander)
3. Apply to all parser error paths

### Exit Criterion

- Users see actionable suggestions, not just raw error data
- Technical details are still accessible for debugging

---

## Task 9: Add loading state to category change dropdown during reoptimization

**Finding:** C31-UI02
**Severity:** LOW
**Confidence:** Low
**File:** `apps/web/src/components/dashboard/TransactionReview.svelte`

### Problem

When changing a transaction category, `reoptimize()` may take 500ms+ with no visual feedback.

### Implementation

1. Add a temporary loading indicator or disable the dropdown during reoptimization
2. Use Svelte 5 `$state` to track `isReoptimizing`
3. Show spinner or disable dropdown while `isReoptimizing` is true

### Exit Criterion

- UI provides visual feedback during reoptimization
- Dropdown is disabled or shows loading state

---

## Task 10: Clarify OFX XML vs SGML fallback comment

**Finding:** C31-DOC01
**Severity:** LOW
**Confidence:** High
**File:** `packages/parser/src/ofx/index.ts:16`

### Problem

Comment says "OFX 2.x uses XML-style with proper closing tags" but doesn't clarify that SGML-style is tried as fallback.

### Implementation

1. Update comment:
   ```typescript
   // XML-style blocks are tried first; if none found, fall back to SGML-style.
   ```

### Exit Criterion

- Comment accurately describes the dual fallback strategy

---

## Task 11: Fix JSON parity comment about import paths

**Finding:** C31-DOC02
**Severity:** LOW
**Confidence:** Medium
**File:** `apps/web/src/lib/parser/json.ts:5-6`

### Problem

File header claims "Parity with server-side" but import paths differ (web uses `./csv.js`, server uses `../csv/shared.js`).

### Implementation

1. Update comment to note that import paths differ but behavior is identical:
   ```typescript
   // Parity with server-side JSON parser. Import paths differ but implementations are identical.
   ```

### Exit Criterion

- Comment is accurate about module structure differences

---

## Task 12: Fix SheetJS import comment

**Finding:** C31-DOC03
**Severity:** LOW
**Confidence:** Medium
**File:** `apps/web/src/lib/parser/html.ts:25`

### Problem

Comment says "SheetJS is imported as a CommonJS module" but uses ES module syntax `import * as xlsx from 'xlsx'`.

### Implementation

1. Update comment to reflect actual import style:
   ```typescript
   // SheetJS is imported as an ES module
   ```

### Exit Criterion

- Comment matches actual import syntax

---

## Task 13: Move `parseAmountString` to `amount.ts` as canonical implementation

**Finding:** C31-ARCH02
**Severity:** LOW
**Confidence:** Medium
**Files:** `packages/parser/src/amount.ts`, `packages/parser/src/csv/shared.ts`

### Problem

`amount.ts` re-exports from `csv/shared.ts`, creating a circular dependency risk.

### Implementation

1. Move `parseAmountString` implementation to `amount.ts`
2. Have `csv/shared.ts` import from `amount.ts` instead
3. Ensure web-side (`apps/web/src/lib/parser/amount.ts`) stays consistent

### Exit Criterion

- `amount.ts` is the canonical source for `parseAmountString`
- `csv/shared.ts` imports from `amount.ts`
- No circular dependencies introduced

---

## Task 14: Extract persistence logic from `store.svelte.ts`

**Finding:** C31-ARCH03
**Severity:** LOW
**Confidence:** Medium
**File:** `apps/web/src/lib/store.svelte.ts`

### Problem

Store file exceeds 350 lines and mixes persistence, validation, and state management.

### Implementation

1. Extract persistence logic to `storage.ts`
2. Extract validation logic to `storage-validation.ts`
3. Keep only Svelte-specific state in `store.svelte.ts`
4. Update imports throughout the codebase

### Exit Criterion

- `store.svelte.ts` is under 200 lines
- Persistence and validation are in separate modules
- All existing functionality preserved

---

## Completion Tracking

| Task | Status |
|---|---|
| 1 | pending |
| 2 | pending |
| 3 | pending |
| 4 | pending |
| 5 | pending |
| 6 | pending |
| 7 | pending |
| 8 | pending |
| 9 | pending |
| 10 | pending |
| 11 | pending |
| 12 | pending |
| 13 | pending |
| 14 | pending |
