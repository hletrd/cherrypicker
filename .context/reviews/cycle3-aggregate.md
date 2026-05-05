# Cycle 3 Aggregate Review

**Date:** 2026-05-05
**Scope:** Web-side parsers (apps/web/src/lib/parser/*) and FileDropzone component

---

## Cross-Agent Agreement

| Finding | Agents Flagging | Severity |
|---------|----------------|----------|
| Unused imports in pdf.ts/xlsx.ts | code-reviewer, architect | Medium |
| normalizeHTML duplication | code-reviewer, architect | Medium |
| FileDropzone accept mismatch | code-reviewer, designer | High |
| fileIconName incomplete | code-reviewer, designer | Low |
| Missing web-side tests for JSON/HTML/OFX | test-engineer | Medium |

---

## Consolidated Findings (by Severity)

### High Severity

**H1: FileDropzone input accept attribute restricts supported file types**
- File: `apps/web/src/components/upload/FileDropzone.svelte:487,506`
- The `<input accept>` attribute only lists `.csv,.xlsx,.xls,.pdf` but the app supports `.json`, `.ofx`, `.qfx`, `.html`, `.htm`
- Users cannot select these files through the OS file picker
- Fix: Update accept attributes to match `ACCEPTED_EXTENSIONS`

### Medium Severity

**M1: Four unused imports/types in web parser files**
- Files: `apps/web/src/lib/parser/pdf.ts:4,13,22`, `apps/web/src/lib/parser/xlsx.ts:5`
- `normalizeHeader` (pdf.ts, xlsx.ts), `HEADER_KEYWORDS` (pdf.ts), `PdfTextItem` (pdf.ts)
- These produce TS6133/TS6196 warnings during build
- Fix: Remove unused imports and type

**M2: normalizeHTML function duplicated**
- Files: `apps/web/src/lib/parser/html.ts:26-28`, `apps/web/src/lib/parser/xlsx.ts:377-379`
- Identical implementation in two modules
- Fix: Export from html.ts, import in xlsx.ts

**M3: Missing web-side tests for new parsers**
- Files: `apps/web/src/lib/parser/json.ts`, `apps/web/src/lib/parser/html.ts`, `apps/web/src/lib/parser/ofx.ts`
- Web-side implementations of JSON, HTML, and OFX parsers lack test coverage
- Fix: Add tests in `apps/web/__tests__/` or document intentional deferral

### Low Severity

**L1: fileIconName incomplete for new file types**
- File: `apps/web/src/components/upload/FileDropzone.svelte:139-144`
- JSON, OFX, QFX, HTML files fall through to generic icon
- Fix: Add explicit mappings or accept fallback behavior

**L2: Import organization in pdf.ts**
- File: `apps/web/src/lib/parser/pdf.ts:241`
- Mid-file import block breaks convention
- Fix: Move import to top of file

---

## AGENT FAILURES

None — all review agents completed successfully.
