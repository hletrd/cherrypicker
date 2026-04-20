# Plan 45 — Medium Priority Fixes (Cycle 32)

**Source findings:** C32-02 (LOW, High confidence), C32-03 (LOW, Medium confidence)

---

## Task 1: Add zero-amount filter to server-side `parseGenericCSV`

**Finding:** C32-02
**Severity:** LOW
**Confidence:** High
**File:** `packages/parser/src/csv/generic.ts:231-236`

### Problem

The server-side `parseGenericCSV` does not filter zero-amount transactions, while the web-side does (C26-02). Zero-amount rows (balance inquiries, declined transactions) inflate transaction counts and appear in CLI output. The web-side `csv.ts` uses `isValidAmount()` which explicitly filters zero-amount rows.

### Implementation

1. Open `packages/parser/src/csv/generic.ts`
2. Locate the amount parsing block (around line 231-236):
   ```typescript
   const amount = parseAmount(amountRaw);
   if (amount === null) {
     // ...
     continue;
   }
   ```
3. Add a zero-amount filter after the null check:
   ```typescript
   // Skip zero-amount rows (e.g., balance inquiries, declined transactions)
   // which don't contribute to spending optimization — matching the web-side
   // parser's isValidAmount() behavior (C26-02).
   if (amount === 0) continue;
   ```
4. Run the test suite to verify

### Exit Criterion

- Server-side `parseGenericCSV` skips zero-amount transactions
- Consistent with web-side behavior

---

## Task 2: Add try/catch wrapper around server-side `parseCSV` generic fallback

**Finding:** C32-03
**Severity:** LOW
**Confidence:** Medium
**File:** `packages/parser/src/csv/index.ts:71-77`

### Problem

The server-side `parseCSV` wraps bank-specific adapter calls in try/catch (lines 42-52) but does not wrap the generic parser fallback in try/catch. The web-side added this protection in C30-02. If `parseGenericCSV` throws unexpectedly, the error propagates uncaught.

### Implementation

1. Open `packages/parser/src/csv/index.ts`
2. Locate the generic parser fallback (around line 71-77):
   ```typescript
   // Fall back to generic parser
   const result = parseGenericCSV(content, resolvedBank);
   // Collect any signature-detection adapter failures into the result
   for (const msg of signatureFailures) {
     result.errors.unshift({ message: msg });
   }
   return result;
   ```
3. Wrap in try/catch:
   ```typescript
   // Fall back to generic parser — wrap in try/catch for defensive consistency
   // with the bank-specific adapter path above (C30-02/C32-03).
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
4. Run the test suite to verify

### Exit Criterion

- Server-side `parseCSV` generic fallback is wrapped in try/catch
- Consistent with web-side C30-02 pattern

---

## Completion Tracking

| Task | Status |
|---|---|
| 1 | DONE |
| 2 | DONE |
