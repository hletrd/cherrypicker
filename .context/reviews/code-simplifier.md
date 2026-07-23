# Cycle 3 — Code Simplifier

**Review target:** `614ce5c`
**Lens:** deletion-first simplification that preserves intended behavior while removing defect-prone duplicate or unnecessary logic.

## Coverage

All 318 code/config/test artifacts in the Cycle 3 inventory were inspected for duplicated algorithms, mirrored domain types, unnecessary adapters/casts, dead branches, and comments that defend complexity no longer required. The findings below are limited to simplifications with a concrete current failure or a demonstrated single-ownership problem.

## Findings

### C3-CS-001 — Delete the numeric-entity pre-decoder that can crash report generation

- **Severity:** Medium
- **Confidence:** High
- **Status:** confirmed
- **Location:** `packages/viz/src/report/generator.ts:46-62`; custom input path `tools/cli/src/commands/report.ts:31-79,104-150`; tests `packages/viz/__tests__/report.test.ts:56-86`
- **Concrete failure scenario:** A valid custom card/category catalog contains a display name such as `&#x110000;` (or an oversized decimal numeric reference). Generating the requested HTML report throws a `RangeError` instead of writing the report.
- **Evidence:** `esc()` calls `String.fromCodePoint(parseInt(...))` for unbounded numeric references. Executable reproduction with `bestSingleCard.cardName = "&#x110000;"` returned `RangeError: Arguments contain a value that is out of range of code points`. The pre-decoder is also unnecessary: ordinary one-pass escaping of `&` produces `&amp;#x...;`, and an HTML parser decodes it once to literal text, not recursively into markup. The current comment's claimed double-decoding premise adds code and a failure mode without providing the intended protection.
- **Suggested fix:** Delete both numeric-entity replacement passes and retain the simple one-pass control-character cleanup plus `&`, `<`, `>`, quote escaping. Add invalid/oversized decimal and hex references, surrogate values, literal entity text, and script-shaped references to the report tests. If canonical entity decoding is a product requirement, use a bounded decoder that substitutes invalid code points rather than throwing.

### C3-CS-002 — Server and browser still own separate full JSON parser implementations

- **Severity:** Low
- **Confidence:** High
- **Status:** likely
- **Location:** `packages/parser/src/json/index.ts:1-256`; `apps/web/src/lib/parser/json.ts:1-235`; parity tests `packages/parser/__tests__/json.test.ts` and `apps/web/__tests__/parser-json.test.ts`
- **Concrete failure scenario:** A future fix changes wrapper discovery, required-field warnings, alias priority, or installment handling in one parser only. Each package's own tests remain green while CLI and browser users receive different transaction sets or warnings for the same JSON file.
- **Evidence:** The web file says the implementations are identical, but the entire alias tables, field lookup, amount/date validation, object parser, wrapper discovery, and item loop are separately maintained. A line diff shows only import/comment/formatting differences around the same algorithm. The test matrices already differ: server tests non-object arrays and more wrapper/date cases, while browser tests separately lock null behavior. Cycle 2 successfully shared transaction-fact extraction, but did not give this outer JSON grammar one owner; this is not a re-report of the fixed shared-kernel work.
- **Suggested fix:** Export one environment-neutral JSON parser kernel from `@cherrypicker/parser/browser`, parameterized only by the local `ParseError` constructor if necessary, and reduce both entrypoints to type/error adapters. Delete the duplicate aliases and parsing loop. Run one shared conformance table against both public entrypoints.

### C3-CS-003 — The Svelte store mirrors core result types instead of importing them

- **Severity:** Low
- **Confidence:** High
- **Status:** likely
- **Location:** `apps/web/src/lib/store.svelte.ts:34-101`; canonical definitions `packages/core/src/models/result.ts:1-60`; public exports `packages/core/src/index.ts:2-11`
- **Concrete failure scenario:** Core adds or narrows a cap, assignment, or calculation-issue field. The local web interfaces continue compiling because they are a separate structurally similar contract; persistence/components can omit the new field until a runtime discrepancy is noticed.
- **Evidence:** `CategoryReward`, `CapInfo`, `CardRewardResult`, `CalculationIssue`, `CardAssignment`, and `OptimizationResult` are copied nearly field-for-field even though all six are publicly exported by core and the store already depends on core-derived analysis helpers. There is no Svelte runtime reason to duplicate type-only imports. Current shapes happen to match, so the classification is “likely” maintenance failure rather than a present output mismatch.
- **Suggested fix:** Replace the six declarations with `import type` aliases/re-exports from `@cherrypicker/core`; keep only web-owned `AnalysisResult`, execution, and option types locally. Let compile errors expose future core contract changes, and remove any persistence casts that become unnecessary.

## Simplification sweep conclusion

No additional deletion candidate met the regression-safety threshold. In particular, report CSP hashing, per-artifact request controllers, performance-exclusion provenance, and calendar context may look verbose but each has current tests and distinct correctness responsibilities.
