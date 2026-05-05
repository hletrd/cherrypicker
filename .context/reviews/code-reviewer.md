# Cycle 98 Deep Code Review -- code-reviewer

## Review Scope
Full review of packages/parser/src/ focusing on deferred items and remaining edge cases after 97 cycles.

## Baseline: 1356 bun + 306 vitest tests passing

---

## Finding F-01: No OFX/QFX Format Support [MODALITY]
**Severity: HIGH**
**Files:** `types.ts`, `detect.ts`, `index.ts`

OFX (Open Financial Exchange) is the de facto standard for bank statement exports. Korean banks (Shinhan, KB, Woori, etc.) offer OFX downloads alongside CSV/XLSX. The `FileFormat` type has no `'ofx'` variant, `detectFormat` doesn't recognize `.ofx`/`.qfx` extensions, and there's no parser module.

OFX format: SGML-like tagged format with `<?OFX` header, `<BANKTRANLIST>` containing `<STMTTRN>` elements with `<DTPOSTED>`, `<NAME>`, `<TRNAMT>`, `<TRNTYPE>`. Dates are YYYYMMDD. Amounts are decimal with `.` separator.

**Impact:** Users with OFX exports (a very common format) cannot use the tool.

---

## Finding F-02: No HTML Table Standalone Format [MODALITY]
**Severity: HIGH**
**Files:** `types.ts`, `detect.ts`, `index.ts`

Korean bank websites often export statements as HTML tables (.html/.htm). While the XLSX parser handles HTML-as-XLS (HTML content with .xls extension via `isHTMLContent`), standalone `.html` files are not supported. They fall through to the "unknown extension" path in `detectFormat` and default to CSV, which fails because HTML tables are not CSV.

**Impact:** Users downloading from bank websites get HTML files that fail to parse.

---

## Finding F-03: No XML Content Sniffing for Unknown Extensions [HARDER]
**Severity: MEDIUM**
**Files:** `detect.ts`

The unknown-extension sniff path checks for PDF magic, ZIP/XLSX magic, XLS magic, and JSON, but doesn't check for XML/OFX signatures (`<?OFX`, `<?xml`). If a user renames an OFX file or receives one without an extension, it falls through to CSV default.

---

## Finding F-04: No Confidence Score on ParseResult [RELIABILITY]
**Severity: LOW**
**Files:** `types.ts`

`DetectionResult` has confidence but `ParseResult` does not. A partial parse (e.g., 3 of 50 rows parsed) looks identical to a complete parse. Adding confidence to ParseResult would help the UI show warnings.

**Deferred:** Significant feature, defer to future cycle.

---

## Finding F-05: BOM-Aware Content Sniffing Missing in detectFormat [HARDER]
**Severity: LOW**
**Files:** `detect.ts`

When `detectFormat` reads an unknown-extension file, it decodes with `toString('utf-8')` without stripping BOM. The JSON check `head.startsWith('[') || head.startsWith('{')` fails if there's a UTF-8 BOM prefix. OFX/XML checks would similarly fail.

---

## Deferred Items
- D-01: Confidence scoring on ParseResult (significant feature, requires UI changes)
- D-02: Clipboard paste format (depends on UI layer)
- D-03: Recursive JSON wrapper search beyond 2 levels