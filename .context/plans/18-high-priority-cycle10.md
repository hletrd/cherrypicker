# Cycle 10 High-Priority Fixes

**Created:** 2026-05-05  
**Source:** cycle10 aggregate review (_aggregate.md)  
**Status:** Completed

---

## C10-01: Fix Infinity bug in parseAmountString (shared, server-side)
**Severity:** P0-CRITICAL  
**File:** `packages/parser/src/csv/shared.ts:160-162`  
**Description:** `Math.round(parseFloat(cleaned))` can return `Infinity` which passes `!Number.isNaN()` check.
**Fix:** Add `!Number.isFinite(n)` check.
**Code change:**
```typescript
// Before:
const n = Math.round(parseFloat(cleaned));
if (Number.isNaN(n)) return null;

// After:
const n = Math.round(parseFloat(cleaned));
if (Number.isNaN(n) || !Number.isFinite(n)) return null;
```
**Tests:** Add test cases for `"1e309"`, `"1e400"`, `"-1e309"` in parser tests.
**Status:** completed

---

## C10-02: Fix Infinity bug in parseOFXAmount (server-side)
**Severity:** P0-CRITICAL  
**File:** `packages/parser/src/ofx/index.ts:111-113`  
**Description:** Same pattern as C10-01.
**Fix:** Add `!Number.isFinite(n)` check.
**Code change:**
```typescript
// Before:
const n = parseFloat(cleaned);
if (Number.isNaN(n)) return null;
return Math.round(n);

// After:
const n = parseFloat(cleaned);
if (Number.isNaN(n) || !Number.isFinite(n)) return null;
return Math.round(n);
```
**Status:** completed

---

## C10-03: Fix Infinity bug in web-side parseAmount (csv.ts)
**Severity:** P0-CRITICAL  
**File:** `apps/web/src/lib/parser/csv.ts:148-150`  
**Description:** Same pattern as C10-01.
**Fix:** Add `!Number.isFinite(n)` check.
**Status:** completed

---

## C10-04: Fix Infinity bug in web-side parseAmount (pdf.ts)
**Severity:** P0-CRITICAL  
**File:** `apps/web/src/lib/parser/pdf.ts:271-273`  
**Description:** Same pattern as C10-01.
**Fix:** Add `!Number.isFinite(n)` check.
**Status:** completed

---

## C10-05: Fix Infinity bug in web-side parseOFXAmount
**Severity:** P0-CRITICAL  
**File:** `apps/web/src/lib/parser/ofx.ts:79-81`  
**Description:** Same pattern as C10-02.
**Fix:** Add `!Number.isFinite(n)` check.
**Status:** completed

---

## C10-06: Guard JSON normalizeAmount against Infinity (web-side)
**Severity:** P2-MEDIUM  
**File:** `apps/web/src/lib/parser/json.ts:67-75`  
**Description:** `normalizeAmount` checks `Number.isFinite` for number inputs but delegates string inputs to `parseCSVAmount` which has the Infinity bug.
**Fix:** Guard `parseCSVAmount` result:
```typescript
if (typeof raw === 'string') {
  const parsed = parseCSVAmount(raw);
  return parsed !== null && Number.isFinite(parsed) ? parsed : null;
}
```
**Status:** completed

---

## C10-07: Guard JSON normalizeAmount against Infinity (server-side)
**Severity:** P2-MEDIUM  
**File:** `packages/parser/src/json/index.ts:79-87`  
**Description:** Same as C10-06.
**Fix:** Same guard pattern.
**Status:** completed

---

## C10-08: Guard XLSX parseAmount against Infinity
**Severity:** P2-MEDIUM  
**File:** `packages/parser/src/xlsx/index.ts:157-160`  
**Description:** For string inputs, delegates to `parseAmountString` without guarding.
**Fix:** Guard the result:
```typescript
if (typeof raw === 'string') {
  const parsed = parseAmountString(raw);
  return parsed !== null && Number.isFinite(parsed) ? parsed : null;
}
```
**Status:** completed

---

## C10-09: Add Infinity edge case tests
**Severity:** P2-MEDIUM  
**Files:** `packages/parser/__tests__/*`, `apps/web/__tests__/*`  
**Description:** No existing tests cover Infinity amounts.
**Fix:** Add test cases for:
- `"1e309"` -> null (parse error)
- `"1e400"` -> null
- `"-1e309"` -> null
- `Number.MAX_VALUE + 1` -> null (for number inputs)
**Status:** completed
