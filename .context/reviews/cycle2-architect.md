# Cycle 2 Architectural Review

## Review Scope
Repository-wide architecture with focus on server/web parity and parser design.

---

## F-ARCH-01: Server/web parser parity gaps cause data loss [HIGH]
**Severity: High | Confidence: High**
**Files**: `apps/web/src/lib/parser/csv.ts`, `html.ts`, `xlsx.ts`, `pdf.ts`

Four web parsers (CSV, HTML, XLSX, PDF) use `amount <= 0` to filter transactions while the JSON parser correctly uses `amount === 0` + `Math.abs()`. The server-side generic CSV parser also handles negatives. This creates a parity gap where the same statement produces different transaction sets on web vs server.

**Root cause**: No shared amount validation utility between the 5 web parsers. Each implemented its own check.

**Fix**: Extract a shared `validateAmount()` utility to `apps/web/src/lib/parser/shared.ts` and use it across all parsers.

---

## F-ARCH-02: UI file type restrictions don't match parser capabilities [HIGH]
**Severity: High | Confidence: High**
**Files**: `apps/web/src/components/upload/FileDropzone.svelte`, `apps/web/src/lib/parser/index.ts`

FileDropzone only accepts CSV/XLSX/PDF but `parseFile()` supports JSON, OFX, HTML. The UI and parser capability matrix are misaligned.

**Fix**: Derive ACCEPTED_EXTENSIONS from the parser's format detection map rather than hardcoding.

---

## F-ARCH-03: Three independent parser implementations with no shared code
**Severity: Medium | Confidence: High**
**Files**: `packages/parser/src/`, `apps/web/src/lib/parser/`

Server-side adapter-factory, server-side legacy generic, and web-side hand-coded adapters each have independent column matching, amount parsing, and date parsing. Cycle 1 introduced ColumnMatcher for server-side CSV but web-side was deferred.

---

## F-ARCH-04: XLSX bank column config exists in 3 places
**Severity: Medium | Confidence: High**
**Files**: `packages/parser/src/xlsx/adapters/index.ts`, `apps/web/src/lib/parser/xlsx.ts`, `packages/parser/src/csv/adapter-factory.ts`

No single source of truth for bank column configurations.

---

## F-ARCH-05: Web-side csv.ts is 1030 lines of mostly duplicated adapter code
**Severity: Medium | Confidence: High**
**File**: `apps/web/src/lib/parser/csv.ts`

10 bank adapters following identical template. Server-side reduced each to 5-line config via adapter-factory.

---

## F-ARCH-06: Date parsing centralized but pattern matching is not
**Severity: Low | Confidence: High**
**Files**: `packages/parser/src/date-utils.ts`, `apps/web/src/lib/parser/date-utils.ts`

Regex patterns for column detection scattered across 6+ files.

---

## F-ARCH-07: BankId type includes 24 banks but only 10 have CSV adapters
**Severity: Low | Confidence: High**
**Files**: `packages/parser/src/types.ts`, `packages/parser/src/csv/adapter-factory.ts`

XLSX has configs for all 24, CSV only 10. No unified registry.
