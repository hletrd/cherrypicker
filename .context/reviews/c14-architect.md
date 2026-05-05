# Cycle 14 Architect Review

## Findings

### C14-ARCH01: Parser duplication (web vs server) remains unaddressed (MEDIUM)
- **Description:** The D-01 architectural debt (web-side parsers duplicate server-side logic) persists. New parser formats (HTML, OFX, JSON) were added to both sides in cycle 13, increasing the duplication surface.
- **Impact:** Maintenance burden grows with each new format. Fixes must be applied in two places.
- **Recommendation:** Prioritize extracting shared parser logic into a pure-JS package that can run in both Bun and browser environments.
- **Confidence:** High

### C14-ARCH02: `isValidISODate` semantic mismatch (MEDIUM)
- **Files:** `packages/parser/src/date-utils.ts:228`, `apps/web/src/lib/parser/date-utils.ts:242`
- **Description:** The function name promises "valid ISO date" but only checks format. This is a semantic contract violation.
- **Impact:** Callers assume ISO validity implies usable date.
- **Recommendation:** Either rename to `isISODateFormatted` and add a true `isValidISODate`, or enhance the existing function with range validation.
- **Confidence:** High

### C14-ARCH03: No new structural issues (GOOD)
- The adapter-factory pattern continues to work well. The shared `parseAmountString` and `parseDateStringToISO` utilities reduce duplication.
