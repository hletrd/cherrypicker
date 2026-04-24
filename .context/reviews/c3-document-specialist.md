# Cycle 3 — Document Specialist

**Date:** 2026-04-24
**Reviewer:** document-specialist
**Scope:** Full repository

---

## C3-DS01: `buildCategoryNamesKo` JSDoc says "authoritative source" but function is unused

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `packages/rules/src/category-names.ts:1-8`
- **Description:** Same as C2-09/C2-DS01. The JSDoc says the function "CAN generate the authoritative category label mapping from the taxonomy" and notes it is "not yet integrated into consumers." The doc was updated in cycle 2 to clarify the unused status, but the term "authoritative" is misleading for an unused function. The TODO comment in greedy.ts (C64-03) also references this function as the intended replacement for the hardcoded CATEGORY_NAMES_KO.
- **Failure scenario:** A developer reads the JSDoc, assumes the function is active, and relies on it for categorization, not realizing the hardcoded maps are still in use.
- **Fix:** Change the JSDoc from "CAN generate" to "Generates" and add a prominent `@deprecated` or `@internal` tag until the function is actually wired into consumers. Alternatively, wire it in this cycle (see C3-A01).

## C3-DS02: `ANTHROPIC_MODEL` env var default is `claude-opus-4-5` — potentially outdated

- **Severity:** LOW
- **Confidence:** Medium
- **File+line:** `packages/parser/src/pdf/llm-fallback.ts:45`
- **Description:** The default model `claude-opus-4-5` is hardcoded. As Anthropic releases new models, this default becomes stale. The code comment doesn't explain why this specific model was chosen or when it should be updated.
- **Failure scenario:** A user runs the LLM fallback without setting ANTHROPIC_MODEL, and the default model is deprecated or unavailable, causing a runtime error.
- **Fix:** Add a comment explaining the model choice and update cadence. Consider using a more future-proof default (e.g., the latest available model alias if the SDK supports one).

---

## Final Sweep

Code documentation is generally thorough, with helpful inline comments explaining design decisions and referencing prior issue IDs (C1-01, C2-01, etc.). The CLAUDE.md files accurately describe the project architecture. The main doc-code mismatch is the "authoritative" claim for the unused `buildCategoryNamesKo` function (C3-DS01).
