# Cycle 21 — Code Review

## C21-01: Web-side XLSX parser duplicates parseAmountString logic (MEDIUM)

**File:** `apps/web/src/lib/parser/xlsx.ts:308-342`
**Confidence:** High

The web-side XLSX parser defines its own `parseAmount()` function (lines 308-342) that reimplements the full-width digit normalization, Won sign stripping, `마이너스` prefix handling, trailing minus handling, and parenthesized negative handling — all logic that already exists in `parseAmountString` exported from `./csv.ts` (line 157).

The server-side XLSX parser correctly imports `parseAmountString` from `../csv/shared.js` (line 7 of `packages/parser/src/xlsx/index.ts`). The web-side should do the same.

**Impact:** Maintenance burden — any format fix (e.g., C21-03 below) must be applied in two places. Risk of drift.

**Fix:** Remove the local `parseAmount` and import `parseAmountString` from `./csv.ts`.

---

## C21-02: Web-side format detection lacks content sniffing (MEDIUM)

**File:** `apps/web/src/lib/parser/detect.ts:107-118`
**Confidence:** High

`detectFormatFromFile()` only checks file extensions. Files with mismatched extensions (e.g., a CSV renamed to `.txt`, an HTML export saved as `.xls`) will always default to CSV.

The server-side `detectFormat()` (`packages/parser/src/detect.ts:234-318`) has sophisticated content sniffing: PDF magic bytes (`%PDF`), ZIP/XLSX magic (`PK`), legacy XLS magic (`D0 CF`), OFX headers (`<?OFX`), HTML content (`<!doctype`, `<table`), and JSON structure (`[`/`{`).

**Impact:** Users uploading files with unusual extensions get misidentified format and parse failures.

**Fix:** Add basic content sniffing via `file.arrayBuffer()` / `file.text()` for the first 1-2 KB. At minimum: check for PDF magic, OFX headers, HTML tags, and JSON brackets before falling back to extension-based detection.

---

## C21-03: Web-side amount parsing lacks full-width plus sign (＋) handling (LOW)

**File:** `apps/web/src/lib/parser/csv.ts:126-131` and `apps/web/src/lib/parser/xlsx.ts:315-321`
**Confidence:** High

The server-side `parseAmountString` (`packages/parser/src/csv/shared.ts:145`) includes `.replace(/＋/g, '+')` to normalize full-width plus signs. The web-side CSV parser's `parseAmount` (line 128) and the web-side XLSX parser's `parseAmount` (line 318) both omit this replacement.

The web-side PDF parser (`apps/web/src/lib/parser/pdf.ts:250`) DOES include it, as does the server-side. So this is a parity gap affecting CSV and XLSX web parsers.

**Impact:** Inputs like `＋1,234` or `＋10000` will fail to parse (parseFloat sees `＋` which is not ASCII, producing NaN). These are rare but used by some Korean bank exports.

**Fix:** Add `.replace(/＋/g, '+')` to both web `parseAmount` implementations. Better yet, fix C21-01 first (unify XLSX with `parseAmountString` from csv.ts), then add the replacement to csv.ts only.

---

## C21-04: Web-side XLSX parser uses duplicated normalizeHTML import (LOW)

**File:** `apps/web/src/lib/parser/xlsx.ts:5`
**Confidence:** Medium

The web XLSX parser imports `normalizeHTML` from `./html.js`. The HTML parser's `normalizeHTML` includes script/style/iframe sanitization (C20-SEC02). When the XLSX parser processes HTML-as-XLS files, it gets the full sanitization pipeline. This is defense-in-depth and not harmful, but it means the XLSX parser's `normalizeHTML` dependency on the HTML module creates a cross-module coupling that isn't obvious.

**Fix:** This is already correct behavior after C100-04 (shared normalizeHTML extracted to shared.ts on server-side). The web-side should follow the same pattern: extract `normalizeHTML` to a shared utilities module or import from a neutral location. Currently acceptable — no action needed unless the coupling causes issues.

---

## C21-05: No tests for web-side parsers (XLSX, PDF, detect) (LOW)

**File:** `apps/web/src/lib/parser/xlsx.ts`, `apps/web/src/lib/parser/pdf.ts`, `apps/web/src/lib/parser/detect.ts`
**Confidence:** High

The web-side parsers have zero dedicated test coverage. All parser tests exist only for the server-side (`packages/parser/__tests__/`). This means parity bugs (like C21-01 and C21-03) have no automated detection.

**Fix:** Add tests for web-side XLSX parser (HTML-as-XLS detection, forward-fill, date parsing), PDF parser (structured parse, fallback scanner), and format detection (extension + content sniffing after C21-02).
