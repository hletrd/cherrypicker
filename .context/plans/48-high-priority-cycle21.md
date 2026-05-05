# Plan 48 — High-Priority Fixes (Cycle 21)

**Priority:** HIGH (implementation-bound)
**Findings addressed:** C21-01, C21-02, C21-03
**Status:** TODO

---

## Task 1: Unify web-side XLSX parseAmount with parseAmountString (C21-01)

**Finding:** C21-01 (MEDIUM) — Web-side XLSX parser defines its own `parseAmount()` (lines 308-342) that duplicates `parseAmountString` logic. Server-side imports from shared module.

**File:** `apps/web/src/lib/parser/xlsx.ts`

**Implementation:**

1. Import `parseAmountString` from `./csv.js` at the top of the file (where other imports are):
   ```ts
   import { parseAmountString } from './csv.js';
   ```

2. Remove the local `parseAmount` function (lines 308-342).

3. Replace all calls to `parseAmount(...)` with `parseAmountString(...)` (line 590).

**Verification:** Existing tests pass. The behavior is identical since `parseAmountString` has the same logic (plus the `＋` fix from Task 3).

**Commit:** `fix(parser): 🐛 unify web-side XLSX amount parsing with parseAmountString (C21-01)`

---

## Task 2: Add content sniffing to web-side format detection (C21-02)

**Finding:** C21-02 (MEDIUM) — `detectFormatFromFile()` only checks file extensions. Files with mismatched extensions default to CSV.

**File:** `apps/web/src/lib/parser/detect.ts:107-118`

**Implementation:**

1. Update `detectFormatFromFile` to accept content sniffing. Since this is a browser environment, we can use `file.text()` or `file.arrayBuffer()` for the first 1-2 KB when the extension is unknown or ambiguous.

2. Add a new async version or update the signature. However, since `parseFile` in `index.ts` already reads the file content, the format detection should ideally happen before or during parsing. A simpler approach: make `detectFormatFromFile` async and add content sniffing for `.txt`/unknown extensions.

3. Implementation sketch:
   ```ts
   export async function detectFormatFromFile(file: File): Promise<'csv' | 'xlsx' | 'pdf' | 'json' | 'ofx' | 'html'> {
     const ext = file.name.split('.').pop()?.toLowerCase();
     if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
     if (ext === 'pdf') return 'pdf';
     if (ext === 'json') return 'json';
     if (ext === 'ofx' || ext === 'qfx') return 'ofx';
     if (ext === 'html' || ext === 'htm') return 'html';

     // Content sniffing for unknown/mismatched extensions
     try {
       const buffer = await file.slice(0, 2048).arrayBuffer();
       const head = new TextDecoder('utf-8').decode(buffer).replace(/^﻿/, '').trimStart();

       // PDF magic: %PDF
       if (head.startsWith('%PDF')) return 'pdf';
       // OFX header
       if (/^<\?OFX/i.test(head) || /<OFX/i.test(head)) return 'ofx';
       // HTML
       if (/^<!doctype\s+html/i.test(head) || /^<html/i.test(head) || /<table[\s>]/i.test(head)) return 'html';
       // JSON
       if (head.startsWith('[') || head.startsWith('{')) {
         try {
           JSON.parse(head.slice(0, 1024));
           return 'json';
         } catch { /* not JSON */ }
       }
       // XML with OFX content
       if (/^<\?xml/i.test(head) && /<OFX|<BANKTRANLIST|<STMTTRN/i.test(head)) return 'ofx';
     } catch { /* fall through */ }

     return 'csv';
   }
   ```

4. Update `parseFile` in `index.ts` to `await detectFormatFromFile(file)` (line 22).

**Note:** This changes `detectFormatFromFile` from sync to async. Verify all callers.

**Verification:** Add tests for content sniffing (see Task 6 in Plan 49).

**Commit:** `fix(parser): 🐛 add content sniffing to web format detection (C21-02)`

---

## Task 3: Add full-width plus sign (＋) handling to web CSV parser (C21-03)

**Finding:** C21-03 (LOW) — Web-side CSV `parseAmount` lacks `.replace(/＋/g, '+')` which is present in server-side and PDF parsers.

**File:** `apps/web/src/lib/parser/csv.ts:128`

**Implementation:**

1. Add `＋` replacement to the chain:
   ```ts
   .replace(/，/g, ',').replace(/．/g, '.').replace(/－/g, '-').replace(/＋/g, '+')
   ```

2. After Task 1 (unifying XLSX with `parseAmountString`), the XLSX parser will automatically inherit this fix since it uses `parseAmountString` from csv.ts.

**Verification:** Add test case to `packages/parser/__tests__/csv-shared.test.ts` (see Task 5 in Plan 49).

**Commit:** `fix(parser): 🐛 add full-width plus sign handling to web CSV amount parsing (C21-03)`

---

## Deferred to Plan 49 or 00-deferred-items.md

| Finding | Severity | Reason |
|---------|----------|--------|
| C21-ARCH01 | LOW | Same as D-01. Requires dedicated refactoring sprint. |
| C21-ARCH02 | LOW | Minor coupling issue. Can be addressed when D-01 refactoring happens. |
| C21-TEST02-04 | LOW | Test coverage gaps require test infrastructure setup. |

---

## Progress

- [ ] Task 1: Unify web-side XLSX parseAmount with parseAmountString
- [ ] Task 2: Add content sniffing to web format detection
- [ ] Task 3: Add full-width plus sign handling to web CSV parser
