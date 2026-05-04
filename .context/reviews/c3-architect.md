# Architect — Cycle 3

## F-ARCH-01: Web-side CSV adapters should use adapter-factory pattern
**Severity: High | Confidence: High**
**File**: apps/web/src/lib/parser/csv.ts

The server-side solved the 10-adapter duplication problem with createBankAdapter() factory. The web-side still has 10 hand-written adapters (~60 lines each). The factory pattern is browser-compatible (no Node APIs used). Porting it would:
1. Eliminate ~500 lines of duplicated code
2. Automatically use ColumnMatcher for all banks
3. Make adding new banks trivial (just config object)

## F-ARCH-02: XLSX bank column config exists in 3 places
**Severity: Medium | Confidence: High**
**Files**: packages/parser/src/xlsx/adapters/index.ts, apps/web/src/lib/parser/xlsx.ts, packages/parser/src/csv/adapter-factory.ts

Three independent copies of the same 24-bank column mapping. Should be a single shared source of truth.

## F-ARCH-03: No shared package between server and web parsers
**Severity: Medium | Confidence: High**

The web-side parser (apps/web/src/lib/parser/) and server-side parser (packages/parser/src/) share significant logic but cannot import from each other. A shared package for ColumnMatcher, header keywords, bank configs, and date-utils would eliminate all duplication. However, this requires a build system that supports both Bun and browser targets.

## F-ARCH-04: Server-side XLSX multi-sheet selection should match web-side
**Severity: Medium | Confidence: High**
**File**: packages/parser/src/xlsx/index.ts

The web-side selects the sheet with the most transactions. The server-side returns the first. This is a 3-line fix.
