# Cycle 99 Architect Review

## Architecture Findings

### A1. Server/Web Duplication Is the #1 Architecture Debt
The web-side `apps/web/src/lib/parser/` contains near-identical copies of:
- `column-matcher.ts` (100% match with `packages/parser/src/csv/column-matcher.ts`)
- `detect.ts` (100% match for `BANK_SIGNATURES`, `detectBank`, `detectCSVDelimiter`)
- `date-utils.ts` (~95% match, missing `isValidShortDate`)
- `pdf.ts` (~80% match, duplicates table-parser.ts + pdf/index.ts logic)
- `csv.ts`, `xlsx.ts` (similar patterns, not reviewed this cycle)

Total estimated duplication: **~1200 lines** across 6 files.

**Root cause**: The web app (Astro + Svelte) uses a different build system from the Bun-based packages/parser. The comment in `column-matcher.ts` says: "the web app cannot import from packages/parser (different build systems)."

**Resolution options**:
1. **Publish packages/parser as an npm package** that both Bun and Node/Astro can consume
2. **Copy shared modules at build time** using a pre-build script
3. **Move shared modules to a new `packages/shared/` package** with no runtime-specific dependencies

Option 3 is cleanest: extract `column-matcher.ts`, `date-utils.ts`, and `table-parser.ts` into a `packages/shared/` package that's pure TypeScript with zero dependencies.

### A2. HTML Parser Should Share XLSX Row-Processing Logic
The HTML parser uses SheetJS to parse HTML tables (same as XLSX), but the row-processing logic (forward-fill, column detection, amount parsing) is a simplified version of the XLSX parser's logic. The XLSX parser has 150+ lines of forward-fill logic that the HTML parser completely lacks.

### A3. Parser Architecture Is Otherwise Clean
The format-detection → bank-detection → adapter-selection → generic-fallback pipeline is well-designed. Each format parser (CSV, XLSX, PDF, JSON, OFX, HTML) follows a consistent pattern:
1. Read/detect format
2. Detect bank from content
3. Find header row (where applicable)
4. Match columns to roles
5. Parse rows with validation
6. Return `ParseResult` with errors

## Recommendations (Priority Order)
1. **Export isValidShortDate from web-side date-utils.ts** — minimal change, eliminates PDF parser duplication
2. **Fix HTML parser forward-fill** — reliability improvement
3. **Fix OFX CREDITCARDMSGSRSV1** — format coverage improvement
4. **Defer full dedup** to a future cycle — requires build system changes