# Plan -- Cycle 30 Fixes

**Source findings:** C30-02 (LOW, High), C30-03 (LOW, Medium / same as C27-01)

---

## Task 1: Add try/catch around parseGenericCSV fallback in parseCSV

**Finding:** C30-02
**Severity:** LOW
**Confidence:** High
**File:** `apps/web/src/lib/parser/csv.ts:934`

### Problem

The `parseCSV` function at line 934 calls `parseGenericCSV(content, resolvedBank)` without a try/catch. The bank-specific adapter path (lines 902-916) has try/catch that falls through to the generic parser on failure, but if the generic parser itself throws, the error propagates uncaught. This is a defensive consistency gap.

### Implementation

1. Open `apps/web/src/lib/parser/csv.ts`
2. Wrap the `parseGenericCSV` call (around line 934) in a try/catch:
   ```typescript
   // Fall back to generic parser
   try {
     const result = parseGenericCSV(content, resolvedBank);
     for (const msg of signatureFailures) {
       result.errors.unshift({ message: msg });
     }
     return result;
   } catch (err) {
     return {
       bank: resolvedBank,
       format: 'csv',
       transactions: [],
       errors: [
         ...signatureFailures.map(msg => ({ message: msg })),
         { message: `제네릭 파서 실패: ${err instanceof Error ? err.message : String(err)}` },
       ],
     };
   }
   ```

### Exit Criterion

- parseCSV never throws from the generic fallback path
- Error is captured in the ParseResult errors array
- Consistent with bank-specific adapter error handling

---

## Task 2: Add console.warn logging to loadFromStorage inner catch (C27-01/C30-03)

**Finding:** C27-01/C30-03
**Severity:** MEDIUM (inconsistent error handling) / LOW (practical impact)
**Confidence:** Medium
**File:** `apps/web/src/lib/store.svelte.ts:252-253`

### Problem

The inner `catch` in `loadFromStorage` (line 253) silently swallows errors from `sessionStorage.removeItem`, even when `sessionStorage` is available. The `clearStorage` function (line 267-269) logs `console.warn` when sessionStorage is available but the remove fails. This inconsistency makes debugging harder.

### Implementation

1. Open `apps/web/src/lib/store.svelte.ts`
2. At line 253, change the inner catch from:
   ```typescript
   catch { /* best-effort cleanup: corrupted data removal, SecurityError in sandboxed iframes is expected */ }
   ```
   to:
   ```typescript
   catch (err) {
     // Best-effort cleanup: corrupted data removal.
     // SecurityError in sandboxed iframes is expected and safe to ignore.
     // Log when sessionStorage is available but the remove failed for another
     // reason, matching the pattern in clearStorage() (C24-02/C27-01).
     if (typeof sessionStorage !== 'undefined') {
       console.warn('[cherrypicker] Failed to remove corrupted data from sessionStorage:', err);
     }
   }
   ```

### Exit Criterion

- Inner catch in loadFromStorage logs console.warn when sessionStorage is available but removeItem fails
- Consistent with clearStorage error-logging pattern
- Still silently ignores errors in SSR/sandboxed environments where sessionStorage is unavailable

---

## Deferred Findings

| Finding | Severity | Reason for Deferral |
|---|---|---|
| C30-01 | MEDIUM | OptimalCardMap derived re-computation is not actionable at current scale (< 50 assignments). Re-derivation cost is negligible (< 1ms). Exit criterion: if assignments exceed 500, add shallow-equality memoization. |

---

## Completion Tracking

| Task | Status |
|---|---|
| 1 | pending |
| 2 | pending |
