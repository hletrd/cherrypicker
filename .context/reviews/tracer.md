# Tracer — Cycle 3

**Reviewer:** tracer
**Date:** 2026-07-23
**Baseline:** `614ce5c`
**Result:** 2 confirmed Medium findings.

## Inventory and causal map

I traced every production path across the web app, core, parsers, rules,
visualization package, CLI, scraper, scripts, generated artifacts, workspace
configuration, and deployment workflow. The source inventory was 171 relevant
production/script files (41,770 lines excluding tests and generated data), plus
683 canonical card YAML records, 24 issuer indexes/detail shards, 80 unit/script
test files, and 8 regression E2E specs.

The highest-risk cross-file chains were followed end to end:

- upload/drop -> `FileDropzone` run owner -> store operation epoch -> analyzer
  -> bounded parse queue -> lazy parser/worker/PDF lifecycle -> categorizer ->
  calendar context -> catalog loaders -> optimizer -> persistence/routes;
- CLI statement -> local-first parser/consent -> calendar context -> catalog ->
  optimizer -> disclosure/terminal/report;
- issuer configuration/URL -> network policy/DNS pin -> bounded fetch ->
  HTML cleaning -> LLM request/response -> canonical validation -> contained
  YAML write -> publication artifacts -> browser readers; and
- YAML/taxonomy -> exhaustive semantic validators -> deterministic JSON/docs ->
  common `sourceHash` -> web caches/consumers.

## Findings

### C3-TR-001 — Scraper input truncation is model-visible but not caller-visible

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed
- **Locations:** `tools/scraper/src/fetcher.ts:321-365`;
  `tools/scraper/src/extractor.ts:8-14,19-55`;
  `tools/scraper/src/cli.ts:108-132`;
  `tools/scraper/__tests__/extractor.test.ts:36-100`

**Trace:** The fetcher accepts and bounds the remote HTML, `cleanHTML` selects
main/body text, and the CLI logs the resulting text size. `extractCardRules`
then keeps only the first 40,000 UTF-16 code units and appends a Korean marker
inside the model prompt. A schema-valid tool response proceeds through
`validateExtractedRules`, then `writeCardRule` saves a normal canonical YAML.
No return type, warning, CLI status, or generated header records that source
content was omitted.

A safe local request-construction probe supplied a marker after character
40,000. The request contained the truncation notice but not the trailing
marker; the caller still received an ordinary request object. Existing tests
cover **output** truncation (`stop_reason === "max_tokens"`) but never
**input** truncation.

**Failure scenario:** A long issuer product page places fee details, exclusions,
caps, or late benefit sections after the first 40,000 characters. The model can
produce internally schema-valid rules from the prefix, the scraper reports
success, and a developer can publish a materially incomplete catalog record
without any machine-readable completeness signal.

**Competing hypothesis:** The in-prompt notice tells the model that text was
cut. That can influence its answer, but it cannot restore missing facts and is
not propagated to the human caller, validator, YAML header, or publication
gate. It therefore does not close the data-integrity break.

**Suggested fix:** Prefer structured section/chunk extraction with deterministic
coverage and merge/conflict validation. At minimum, make truncation an explicit
result state that the CLI treats as incomplete (non-zero exit or required
acknowledgment), include original/sent sizes, and prevent direct publication
until reviewed. Add boundary tests at 39,999/40,000/40,001 characters and a
late-section fixture whose omitted restriction must fail completeness.

### C3-TR-002 — The analysis cancel signal terminates parser work but not catalog or optimizer work

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed
- **Locations:** `apps/web/src/components/upload/FileDropzone.svelte:162-169,
  278-351`; `apps/web/src/lib/analyzer.ts:165-220,245-305,375-411`;
  `apps/web/src/lib/cards.ts:241-275,449-469`;
  `apps/web/src/lib/store.svelte.ts:335-384`;
  `apps/web/__tests__/file-parse-queue.test.ts:112-226`

**Trace:** `LatestFileParseRun` supplies an `AbortSignal`; the parse queue passes
it to active workers, and PDF cleanup rejects promptly. However,
`analyzeMultipleFiles` awaits `loadCategories()` before its first run check,
and `optimizeFromTransactions` awaits `loadOptimizerCatalog()` without a
signal. After parsing, the analyzer invokes optimization without another run
check or signal. The catalog loaders already support caller-scoped abort races,
but these calls omit the available signal. Greedy optimization is synchronous
and also has no cooperative stale/cancel check.

The store operation epoch correctly prevents the late result, error, or
persistence commit. This is not a stale-state corruption finding. The defect is
that a canceled run can retain an analyzer continuation, wait for a request
timeout, parse a large catalog, and execute the full 683-card optimization even
after the UI has returned to idle or started a newer run.

**Failure scenario:** The user cancels/removes a file or starts another upload
while the categories/optimizer artifact is slow, or just after parsing
finishes. Active parser resources stop, but downstream fetch/validation/CPU
work continues invisibly and competes with the current interaction.

**Competing hypothesis:** Artifact fetches are shared and should not be globally
aborted for one caller. `cards.ts` already solves that concern with
`waitForCaller`: a caller's wait can reject without canceling the shared
request. Passing the run signal would therefore improve prompt cancellation
without poisoning shared caches.

**Suggested fix:** Thread the execution signal into every caller-scoped
`loadCategories`/`loadOptimizerCatalog` wait, check the run after every await
and before/after optimization, and add a cooperative cancellation boundary for
large synchronous optimization (chunk/yield or worker). Test cancellation
during initial categories, optimizer load, catalog validation, and optimizer
execution; assert prompt caller settlement, no stale commit, and cache reuse by
an unrelated live caller.

## Traces closed without findings

- Parser detection now receives complete bytes where required, imports only the
  selected format, and normal CSV parsing performs one full read.
- Multi-file outcomes preserve input order, file identity, warning counts, and
  exact latest/previous calendar-month semantics.
- Typed payment/channel/fuel/exclusion facts and provenance survive parser,
  web/CLI adapters, optimization, disclosure, persistence, and restoration.
- Catalog publication rejects partial/invalid cards and all artifacts are tied
  to one deterministic `sourceHash`; browser consumers fail closed on a mixed
  generation.
- Scraper redirects and connected addresses are revalidated under the same
  allowlist/public-IP policy, and output paths remain issuer-bound and
  no-follow.
- Store epochs prevent analyze/reoptimize/reset/cancel continuations from
  committing stale state. C3-DBG-001 is a separate same-operation error-policy
  split, not an epoch race.

## Final missed-issue sweep

I repeated the trace in reverse from every persistent or externally visible
sink (YAML/JSON, `sessionStorage`, terminal, HTML report, route navigation, and
Pages artifact) back to its producer and validator. Searches for unguarded
awaits, catch-and-continue behavior, truncation, shared caches, writes, and raw
rendering found no additional cross-file Critical/High causal break beyond the
two findings above and the role-specific debugger/security findings.
