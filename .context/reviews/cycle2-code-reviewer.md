# Cycle 2 Code Review — Code Quality, Logic, SOLID, Maintainability

## Review Scope
Full repository with special focus on apps/web/ components and parser parity.

---

## F-CR-01: FileDropzone.svelte uses undeclared variable `errorMessage` [CRITICAL]
**Severity: Critical | Confidence: High**
**File**: `apps/web/src/components/upload/FileDropzone.svelte` lines 251, 314, 363

The reactive variable is declared as `errorMessages` (plural, line 76) but referenced as `errorMessage` (singular) on lines 251, 314, and 363. This causes a `ReferenceError` at runtime whenever file validation fails, file upload fails, or retry fails.

**Impact**: Complete runtime crash of the file dropzone component on any error path. Users cannot see validation errors or retry failures.

**Fix**: Rename all references to `errorMessages` to match the declaration, or rename the declaration to `errorMessage`.

---

## F-CR-02: FileDropzone ACCEPTED_EXTENSIONS blocks supported formats [CRITICAL]
**Severity: Critical | Confidence: High**
**File**: `apps/web/src/components/upload/FileDropzone.svelte` lines 97-103

`ACCEPTED_EXTENSIONS` is `['csv', 'xlsx', 'pdf']` and `ACCEPTED_TYPES` is `['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/pdf']`. However, `apps/web/src/lib/parser/index.ts` (lines 70-81) supports JSON, OFX, and HTML formats. The UI blocks files that the parser can handle.

**Impact**: Users cannot upload OFX/QFX, HTML table, or JSON transaction files through the web UI despite full parser support.

**Fix**: Extend ACCEPTED_EXTENSIONS to include `json`, `ofx`, `qfx`, `html`, `htm` and ACCEPTED_TYPES to include `application/json`, `application/ofx`, `text/html`.

---

## F-CR-03: Web-side CSV parser silently drops refund transactions
**Severity: High | Confidence: High**
**File**: `apps/web/src/lib/parser/csv.ts` line 175

`isValidAmount` returns `false` for `amount <= 0`, which filters out refund/return transactions with negative amounts. The server-side generic CSV parser and the web-side JSON parser correctly handle negatives.

**Impact**: Refund transactions are silently discarded from CSV uploads, causing incorrect spending totals.

**Fix**: Change `if (amount <= 0) return false;` to `if (amount === 0) return false;` and store `Math.abs(amount)`.

---

## F-CR-04: Web-side HTML parser silently drops refund transactions
**Severity: High | Confidence: High**
**File**: `apps/web/src/lib/parser/html.ts` line 212

`if (amount <= 0) continue;` skips rows with negative amounts. The server-side HTML parser and web-side JSON parser handle negatives correctly.

**Fix**: Change to `if (amount === 0) continue;` and use `Math.abs(amount)`.

---

## F-CR-05: Web-side XLSX parser silently drops refund transactions
**Severity: High | Confidence: High**
**File**: `apps/web/src/lib/parser/xlsx.ts` line 617

Same issue as F-CR-03 and F-CR-04: `if (amount <= 0) continue;` filters refunds.

**Fix**: Change to `if (amount === 0) continue;` and use `Math.abs(amount)`.

---

## F-CR-06: Web-side PDF parser silently drops refund transactions
**Severity: High | Confidence: High**
**File**: `apps/web/src/lib/parser/pdf.ts` line 440

Same pattern: `if (amount <= 0) continue;` filters refunds.

**Fix**: Change to `if (amount === 0) continue;` and use `Math.abs(amount)`.

---

## F-CR-07: Web JSON parser correctly handles negatives (inconsistent with siblings)
**Severity: Medium | Confidence: High**
**File**: `apps/web/src/lib/parser/json.ts` lines 99-100

The JSON parser correctly uses `if (amount === 0) return null; const absAmount = Math.abs(amount);`. This is inconsistent with the other 4 web parsers that all use `<= 0`. All parsers should share the same amount validation logic.

**Fix**: Extract shared amount validation to a utility function used by all web parsers.

---

## F-CR-08: Server-side adapter-factory header detection weaker than generic parser
**Severity: Medium | Confidence: High**
**File**: `packages/parser/src/csv/adapter-factory.ts` line 79

Header detection only requires a single keyword match, while the generic parser requires 2+ distinct categories. Can misidentify summary rows as headers.

---

## F-CR-09: Server-side XLSX returns first sheet with transactions, not the best
**Severity: Low | Confidence: High**
**File**: `packages/parser/src/xlsx/index.ts` lines 106-116

Returns the first sheet with any transactions instead of the sheet with the most transactions (web-side behavior).

---

## F-CR-10: Unused `isValidCSVAmount` export from shared.ts
**Severity: Low | Confidence: High**
**File**: `packages/parser/src/csv/shared.ts` lines 51-65

Exported but adapter-factory has inline null/negative checking instead.

---

## F-CR-11: Web-side CSV adapters still use exact `indexOf()` — cycle 1 deferred
**Severity: Medium | Confidence: High**
**File**: `apps/web/src/lib/parser/csv.ts` lines 318-321, 383-387, 449-453

All 10 web-side bank CSV adapters use `headers.indexOf('exact string')`. Server-side was fixed with ColumnMatcher. Web-side still brittle against column name variations.

---

## F-CR-12: Server-side `detectFormat` only reports bank for CSV format
**Severity: Low | Confidence: High**
**File**: `packages/parser/src/detect.ts` lines 206-214

Returns `{ bank: null }` for XLSX and PDF formats. Bank detection for those formats happens inside individual parsers.
