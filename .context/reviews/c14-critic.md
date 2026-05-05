# Cycle 14 Critic Review

## Findings

### C14-CRIT01: `isValidISODate` naming is misleading (HIGH)
- **Files:** `packages/parser/src/date-utils.ts:228`, `apps/web/src/lib/parser/date-utils.ts:242`
- **Description:** A function named `isValidISODate` that accepts "2024-99-99" is fundamentally misleading. The name sets an expectation that is not met by the implementation.
- **Why it matters:** Developers trust the name. The bug in C14-01 exists precisely because callers assumed "valid ISO" meant "usable date".
- **Recommendation:** Rename to `isISODateFormat` and introduce `isValidISODate` with real validation. Or keep the name and fix the validation.
- **Confidence:** High

### C14-CRIT02: C11 cleanup was incomplete (MEDIUM)
- **Files:** `apps/web/src/lib/analyzer.ts`, `apps/web/src/lib/store.svelte.ts`
- **Description:** Commit `8fbe12a` claimed to remove stale console.warn, but multiple instances remain. This suggests the cleanup was scoped to specific files and missed others.
- **Recommendation:** Use a linter rule or grep-based CI check to prevent console.* in production code.
- **Confidence:** High

### C14-CRIT03: PDF text extraction width heuristic is a hack (MEDIUM)
- **Files:** `packages/parser/src/pdf/extractor.ts:26`, `apps/web/src/lib/parser/pdf.ts:522`
- **Description:** `item.str.length * 6` is a crude heuristic. It may work for common cases but is not principled.
- **Recommendation:** Document the heuristic's limitations or switch to actual font metrics.
- **Confidence:** Medium
