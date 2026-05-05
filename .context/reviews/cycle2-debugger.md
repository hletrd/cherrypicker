# Cycle 2 Debugger Review — Latent Bugs and Failure Modes

---

## F-DBG-01: FileDropzone.svelte runtime ReferenceError on all error paths [CRITICAL]
**Severity: Critical | Confidence: High**
**File**: `apps/web/src/components/upload/FileDropzone.svelte`

Variable declared as `errorMessages` (plural) but assigned/read as `errorMessage` (singular) in `clearAllFiles()`, `handleUpload()`, and `handleRetry()`. Any validation error, network error, or parsing error triggers `ReferenceError: errorMessage is not defined`, crashing the component.

**Repro**: Upload a file > 50MB, or upload a corrupted CSV, or trigger a network error during upload.

**Fix**: Unify naming — either rename declaration to `errorMessage` or update all references to `errorMessages`.

---

## F-DBG-02: fetcher.ts second fetch() loses AbortController timeout protection
**Severity: Medium | Confidence: High**
**File**: `tools/scraper/src/fetcher.ts` lines 50-55

When EUC-KR charset is detected via meta tag, a second `fetch()` is issued without passing `controller.signal`. The 30-second timeout is lost, meaning the fetch can hang indefinitely if the server is unresponsive.

```typescript
// Bug: missing signal: controller.signal
const buffer = await fetch(url, {
  signal: controller.signal,  // <-- MISSING
  headers: { 'User-Agent': USER_AGENT },
}).then((r) => r.arrayBuffer());
```

**Fix**: Pass `signal: controller.signal` to the second fetch call.

---

## F-DBG-03: Server-side XLSX parser header detection lacks category requirement
**Severity: High | Confidence: High**
**File**: `packages/parser/src/xlsx/index.ts` lines 161-169

Header detection checks `matchCount >= 2` but does NOT require keywords from 2+ distinct categories. Can match summary rows with two amount-related keywords.

---

## F-DBG-04: Server-side XLSX `parseDateToISO` silently returns raw string for unparseable dates
**Severity: Medium | Confidence: High**
**File**: `packages/parser/src/xlsx/index.ts` lines 29-53

Returns `String(raw)` without pushing to error array. Web-side pushes error messages.

---

## F-DBG-05: PDF fallback line scanner validates short dates loosely
**Severity: Medium | Confidence: High**
**File**: `packages/parser/src/pdf/index.ts` line 188, `apps/web/src/lib/parser/pdf.ts` line 350

Pattern `\d{1,2}[.\-\/]\d{1,2}(?![.\-\/\d])` matches invalid dates like "99.99".

---

## F-DBG-06: Generic CSV merchant inference can pick wrong column
**Severity: Medium | Confidence: High**
**File**: `packages/parser/src/csv/generic.ts` lines 124-131

When inferring merchant from data, picks "first column that is not date and not amount" which could be installments, category, or memo.

---

## F-DBG-07: Server-side CSV may use wrong adapter for bank override
**Severity: Low | Confidence: High**
**File**: `packages/parser/src/csv/index.ts` lines 46-49

Only 10 adapters exist for 24 BankId values. No warning when falling through to generic parser.

---

## F-DBG-08: PDF extractor doesn't distinguish encrypted PDFs
**Severity: Low | Confidence: Medium**
**File**: `packages/parser/src/pdf/extractor.ts` lines 4-8

Encrypted PDFs produce generic error without guidance that the PDF might be password-protected.
