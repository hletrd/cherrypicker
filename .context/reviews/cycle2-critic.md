# Cycle 2 Critic Review — Multi-Perspective Critique

## Overall Assessment
Cycle 1 made solid improvements to the server-side CSV parser (ColumnMatcher, adapter-factory, generic parser enhancements). However, the improvements were not propagated to three critical areas: (1) the server-side XLSX parser, (2) the web-side CSV adapters, and (3) the web-side XLSX parser. The result is an inconsistent codebase where CSV parsing is robust in the CLI but fragile in the browser, and XLSX parsing is partially robust.

---

## Critical Gap: User-facing web app has weaker parsing than CLI tool
**Severity: High | Confidence: High**

The web app is the primary user-facing interface. Users upload credit card statements through the browser. The web-side CSV parser still uses exact `indexOf()` column matching while the CLI uses regex-based ColumnMatcher. This means:
- A CSV with '이용 금액' (with a space) works in CLI but fails in the browser
- A CSV with '이용금액(원)' (with parenthetical suffix) works in CLI but fails in the browser
- A CSV with '승인일자' as the date column works in CLI (via regex) but may fail in browser (only checks '이용일')

This is the inverse of the desired outcome — the user-facing interface should be MORE robust, not less.

---

## Incomplete Propagation of Fixes
**Severity: Medium | Confidence: High**

The category-based header detection fix (C86-05) was applied to:
- Web-side XLSX parser (xlsx.ts lines 378-386)
- Server-side generic CSV parser (generic.ts lines 73-79)
- Web-side generic CSV parser (csv.ts lines 176-179)

But NOT applied to:
- Server-side XLSX parser (xlsx/index.ts lines 161-169)
- Server-side adapter-factory (adapter-factory.ts line 79)

This creates an inconsistency where some parsers correctly reject summary rows and others don't.

---

## Test Coverage Gap is Severe
**Severity: High | Confidence: High**

The parser package has tests for:
- CSV parsing (2 test files, ~40 tests)
- Bank detection (1 test file)
- Delimiter detection (within detect.test.ts)
- XLSX config parity (1 test)

Not tested at all:
- XLSX parsing behavior (HTML-as-XLS, serial dates, multi-sheet, column matching)
- PDF parsing (structured, fallback, LLM)
- Encoding detection (EUC-KR, CP949)
- Date parsing edge cases
- The web-side parser entirely

For a parser-focused project, the lack of XLSX and PDF test coverage is a significant risk.