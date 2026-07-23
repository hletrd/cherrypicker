# Cycle 2 — Critic

**Review target:** `a9d3c99d52dcacd6e48eede07bb7208af4acb7a2`
**Lens:** challenge whether the repository's advertised “supported/exact” contract survives parser, CLI, remote fallback, and product boundaries.

## Inventory and coverage

The same exhaustive **1,041-file** relevant inventory was used: root/policy/config/docs 15; web 115; E2E 9; core 29; parser 75; rules code/tests/registries 22; all 683 card YAML plus 24 issuer READMEs; viz 8; scripts 16; CLI 13; scraper 32. Historical review artifacts, build/cache outputs, and opaque root statement samples were outside source/config/test/doc scope. Bulk catalog data was checked through exhaustive schema/semantic tests and catalog-wide queries.

## Findings

### C2-CT-001 — “Supported” typed conditions and performance facts cannot enter either product

- **Severity:** High
- **Confidence:** High
- **Classification:** confirmed
- **Location:** `packages/core/src/models/transaction.ts:3-24`; `packages/parser/src/types.ts:12-19`; `apps/web/src/lib/parser/types.ts:11-18`; `packages/parser/src/json/index.ts:51-54`; `apps/web/src/lib/parser/json.ts:47-50`; `apps/web/src/lib/analyzer.ts:34-49,90-104,123-140`; `tools/cli/src/commands/optimize.ts:99-113`; `tools/cli/src/commands/report.ts:106-120`
- **Scenario:** Upload JSON that explicitly contains `paymentType: "overseas"`, or a statement that contains online/offline or fuel-volume facts. The JSON parser treats `paymentType` as a bank category alias, every `RawTransaction` type lacks the typed facts, and both web and CLI mappings drop them. Fuel provenance is absent from the web transaction type altogether.
- **Evidence:** Full generated-catalog audit found **124 supported payment-type rules across 91 cards, 10 supported channel rules across 7 cards, and 17 supported fuel-per-liter rules across 17 cards**. Separately, 577/683 cards contain a statement-tag performance exclusion; 517 of those still advertise at least one supported reward, but no parser emits `performanceExclusionTags`. Core correctly fails closed, so these benefits or automatic tiers become unavailable rather than falsely rewarded, but the product has no path to supply the required facts. The JSON reproduction returned `category: "overseas"` and no `paymentType`.
- **Suggested fix:** Define one shared parsed-transaction fact contract with validated values and provenance; implement aliases/adapters only where the source explicitly carries a fact; forward it through categorization, persistence, CLI, and reoptimization. Until an input path exists, publication should distinguish “runtime-supported but product-unreachable” from supported. Add end-to-end JSON fixtures for domestic/overseas, channel, fuel volume/provenance, and performance tags.

### C2-CT-002 — CLI optimization bypasses the strict calendar context and pools multiple months

- **Severity:** High
- **Confidence:** High
- **Classification:** confirmed
- **Location:** `packages/parser/src/json/index.ts:141-169`; `tools/cli/src/commands/optimize.ts:84-132`; `tools/cli/src/commands/report.ts:91-137`; `packages/core/src/calculator/reward.ts:372-378,455-560`; contrast `apps/web/src/lib/analysis-context.ts:98-154`
- **Scenario:** Optimize a JSON statement containing `2026-99-99`: the parser records an error but still appends the transaction, and CLI passes it into optimization. With a valid two-month statement, CLI passes both months in one calculation, while rule/global “monthly” cap trackers are shared for the entire invocation.
- **Evidence:** The executable JSON reproduction returned one transaction dated `2026-99-99` plus an error. CLI maps every parsed row without strict date filtering or month selection. It also lacks the web's exact predecessor/provenance context. Thus invalid rows can earn ordinary rewards, and valid multi-month rows share one monthly cap and are reported as one optimization.
- **Suggested fix:** Move strict valid-date filtering, latest-month selection, exact previous-calendar-month basis, and per-card exclusion calculation into a runtime-neutral shared analysis-context module used by web and CLI. Parser adapters should not append calendar-invalid rows. Add CLI integration tests for invalid JSON dates, January+February input, missing predecessor months, and monthly cap reset/selection.

### C2-CT-003 — Remote PDF fallback silently sends only the first 8,000 of an allowed 100,000 characters

- **Severity:** High
- **Confidence:** High
- **Classification:** confirmed
- **Location:** `packages/parser/src/pdf/llm-fallback.ts:57-72`; `packages/parser/src/pdf/index.ts:58-65`
- **Scenario:** Local parsing fails for a 20,000-character multi-page statement whose later pages contain transactions. Remote fallback succeeds from only the first 8,000 characters, and the caller treats the returned subset as the statement result.
- **Evidence:** `PDF_LLM_MAX_INPUT_CHARS` and the guard advertise 100,000 characters, but `buildPDFLLMRequest()` slices at 8,000 and adds an internal marker. No partial-input warning reaches `ParseResult`. A 9,000-character reproduction produced a request containing the truncation marker and only about 8,000 input characters.
- **Suggested fix:** Either reject anything over the actual supported ceiling with a typed, user-visible error, or chunk/page the complete text with deterministic aggregation and deduplication. Never return a successful complete-looking parse for truncated input. Test transactions located after character 8,000.

### C2-CT-004 — Remote PDF response validation silently discards malformed model rows

- **Severity:** High
- **Confidence:** High
- **Classification:** confirmed
- **Location:** `packages/parser/src/pdf/llm-fallback.ts:90-173`; `packages/parser/src/pdf/index.ts:58-65`
- **Scenario:** The model returns 100 transaction objects, but one amount is the string `"2,000"` or one date is invalid. The fallback returns the other 99 as success without telling the user a row was omitted.
- **Evidence:** `parsePDFLLMResponse()` validates the outer array, then `.filter()` drops any invalid row without count or error. The existing unit test locks in filtering but does not assert completeness disclosure. A two-row reproduction returned only the valid row, with no warning available to `parsePDF()`.
- **Suggested fix:** Return a structured `{ transactions, errors }` result with an error for every rejected row, or reject the entire remote response when any row violates the contract. Include input/output row counts in the disclosure and tests.

## Verification and final missed-issue sweep

- Full test run: **2,196 pass / 0 fail** on installed Bun 1.3.12 (repository pin: 1.2.6).
- Executable boundary probes covered invalid JSON dates, payment-type aliasing, PDF input truncation, partial PDF output, and catalog-wide condition reachability.
- The final challenge sweep examined fail-open/fail-closed behavior, claims of support, input provenance, partial-success semantics, multi-month invariants, and CLI/web parity. No additional critic finding cleared the evidence threshold.
