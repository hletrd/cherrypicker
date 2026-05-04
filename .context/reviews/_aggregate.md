# Aggregate Review -- Cycle 16

## Findings (4 total)

### HIGH Priority
1. **Web CSV Bank Adapters Don't Normalize Header Detection** -- All 10 web-side bank adapters use exact `cells.includes()` for header detection instead of `normalizeHeader()` (architect, code-reviewer). Headers with extra whitespace, parenthetical suffixes, or zero-width spaces fail on web but succeed on server. Format diversity bug. Affects: `apps/web/src/lib/parser/csv.ts`.

### MEDIUM Priority
2. **PDF detectHeaderRow Lacks Multi-Category Validation** -- Uses single-keyword check instead of `isValidHeaderRow()` requiring 2+ categories (code-reviewer). Summary rows with only amount keywords could be misidentified as headers. Affects: `packages/parser/src/pdf/table-parser.ts`, `apps/web/src/lib/parser/pdf.ts`.

### LOW Priority
3. **Summary Row Skip Missing Spaced Variants** -- `합계|총계|소계` doesn't match `총 합계`, `소 계` (architect). Affects: all parsers.
4. **Server adapter-factory headerKeywords Not Normalized** -- Defensive: normalize both sides of comparison (code-reviewer). Affects: `packages/parser/src/csv/adapter-factory.ts`.

## Test Coverage Gaps
- Web CSV bank adapter normalized header detection: untested
- PDF detectHeaderRow with summary-only rows: untested
- Summary rows with spaces: untested

## Security
- No new security issues.

## Performance
- No performance regressions.
