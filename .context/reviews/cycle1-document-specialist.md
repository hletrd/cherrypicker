# Document Specialist Review — Cycle 1 (document-specialist)

## Scope
Documentation/code mismatches and missing documentation.

---

## C1-DS-01: CLAUDE.md says "Bun — Data pipelines (packages/parser/)" but parser also runs on Node
**Severity: Low | Confidence: High**

The web app (`apps/web/`) runs on Node and imports parser logic from its own `src/lib/parser/` directory, which is a full reimplementation. The CLAUDE.md description implies the parser only runs on Bun, which is misleading.

---

## C1-DS-02: No documentation for bank adapter extension process
**Severity: Medium | Confidence: High**

AGENTS.md documents card rule YAML schema and keyword file structure but says nothing about how to add a new bank CSV adapter. Developers adding support for a new bank would need to reverse-engineer the pattern from existing adapters.

**Fix**: Add a "Adding a new bank adapter" section to AGENTS.md or a README in `packages/parser/`.

---

## C1-DS-03: The web-side csv.ts acknowledges duplication but the referenced refactor (D-01) doesn't exist
**Severity: Medium | Confidence: High**

`apps/web/src/lib/parser/csv.ts` line 31: "Full dedup requires the D-01 architectural refactor (shared module between Bun and browser environments)."

This D-01 refactor is referenced but doesn't appear to be tracked anywhere. The comment has been there since at least the cycle 2 reviews.

---

## C1-DS-04: Test fixture references may be stale
**Severity: Low | Confidence: Medium**

`packages/parser/__tests__/detect.test.ts` references `fixtures/sample-kb.csv` and `fixtures/sample-samsung.csv`. These may exist but there are no references to fixtures for the other 8 banks.