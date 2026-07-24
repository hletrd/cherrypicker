# Cycle 19 code review

## Review identity

- Date: 2026-07-24
- Revision: `fcc89801451d1c1a31bb9881d213e117fc4ca923`
- Comparison baseline: Cycle 17 closure
  `c182c8144a4284bae1f28f009a5b0930d7762d5c`
- Role: code quality, logic, SOLID boundaries, and maintainability
- Disposition: one genuinely new finding
- Severity: one Low
- Scope: review-only; no source, test, plan, generated artifact, Git state,
  browser, preview server, or deployment state was changed

## Inventory and coverage

The inventory preceded inspection. The reviewed revision contains 2,409
tracked paths: 918 historical/current reviews, 319 plans, and 1,172
implementation, data, test, configuration, documentation, and policy paths.

| Surface | Tracked paths | Review coverage |
| --- | ---: | --- |
| Root, `.claude`, `.github`, `.omc`, vendor | 19 | Policies, manifests, workflow, toolchain/test/build configuration, license, and vendored-integrity contract |
| `apps/web` | 172 | Analysis/calendar consumers, persistence/coherence, parsing/workers, catalog readers, store lifecycle, pages, components, static scripts, generated browser artifacts, and tests |
| `e2e` | 16 | Runtime ownership, catalog boundaries, parser responsiveness, accessibility, security, report, and visual regression contracts |
| `packages/core` | 47 | Calendar context, performance basis, categorization, numeric boundaries, reward calculation, cap state, optimizer, public exports, and tests |
| `packages/parser` | 86 | Detection, decoding, all statement formats, browser/server boundaries, adapters, fixtures, and conformance tests |
| `packages/rules` | 734 | Schema/semantic validation, loaders, category/card contracts, 683 authored card YAML files, two generated legacy catalogs, and tests |
| `packages/viz` | 14 | Shared aggregation, disclosures, terminal output, standalone HTML report, and tests |
| `scripts` | 21 | Publication, data/docs generation, dependency/toolchain/bundle policy, E2E ownership, migrations, and tests |
| `tools/cli` | 28 | Command parsing, calendar context, catalog selection, consent, reporting, durable output, and tests |
| `tools/scraper` | 35 | Arguments/configuration, bounded network path, extraction quarantine, validation, durable output, targets, and tests |

The Cycle 18 delta contains 66 paths. All 15 authored source/test paths were
inspected directly as one interaction surface; all 30 generated catalog paths
were reconciled through their generator, common identity, schema version, and
drift checks. The 683 card YAML files, generated projections, and README
catalog were exercised exhaustively through the canonical build/check path
rather than sampled. Unchanged production code received a final cross-package
sweep for calendar, persistence, parser, optimizer, publication, dependency,
state, output, and error-boundary interactions.

The six protected untracked Cycle 42 paths were identified only from the
pre-existing status listing. They were not opened, searched, hashed, staged,
or modified.

## Finding

### C19-CR-001 — the new lower-bound `YearMonth` error escapes fail-closed coherence and persistence validation

- Severity: Low
- Confidence: High
- Status: confirmed by source tracing and two direct runtime probes; no
  manual validation is required
- Throwing domain helper:
  `packages/core/src/analysis/context.ts:96-109`
- Boolean validator call path:
  `apps/web/src/lib/analysis-result.ts:893-919,922-981`
- Persistence admission and uncaught validation:
  `apps/web/src/lib/persistence.ts:522-546,677-708,720-742,822-845,860-915`
- Production recovery wrapper:
  `apps/web/src/lib/store.svelte.ts:117-148`

Cycle 18 deliberately made `previousCalendarMonth("0000-01")` throw a
`RangeError`, because there is no representable four-digit predecessor. That
is the correct contract for the public predecessor helper. Its existing
callers in the coherence boundary, however, still assume predecessor
construction is total.

`hasCoherentTruncatedFacts()` accepts every `monthlyBreakdown.month` that
passes `isYearMonth()`. The predicate intentionally accepts `0000-01`. It
then calls `previousCalendarMonth(latest.month)` before it can return `false`.
The persistence parser likewise accepts `0000-01` in a stored
`previousSpendingBasis` and calls `isAnalysisResultCoherent()` outside either
of its parsing/migration `try` blocks.

A structurally valid current-version truncated snapshot with:

- `transactions` omitted and `_truncatedTxCount: 1`;
- one coherent positive category/month/optimizer witness; and
- latest month and basis month `0000-01`

therefore produces:

```text
RangeError: YearMonth 0000-01 has no representable previous month
```

Both `isAnalysisResultCoherent()` and `deserializeAnalysis()` throw instead
of returning their documented fail-closed results. The production store has
an outer catch, so it removes the snapshot and avoids a page crash, but it
misclassifies the data-validation failure as a storage-access error. Direct
callers of the exported functions receive the exception. Genuine statement
parsers restrict dates to 1900–2100, so this is limited to constructed,
tampered, or stale persisted state and remains Low severity.

Suggested root-cause fix:

1. Keep the public `previousCalendarMonth(parseYearMonth("0000-01"))`
   `RangeError` contract.
2. At validation boundaries that require a predecessor, treat the
   non-representable lower bound as incoherent and return `false`.
3. Add a final defensive exception-to-`invalidResult()` conversion around
   persistence coherence validation so malformed stored state cannot escape
   `deserializeAnalysis()`.
4. Add regressions proving the boolean coherence predicate returns `false`
   and persistence returns `{ data: null, warningKind: "corrupted",
   shouldRemove: true }` for the lower-bound truncated witness, while the
   direct predecessor helper still throws.

Novelty: Cycle 18 owns the intentional direct-helper underflow policy and the
four-digit predecessor repair. Its review, plan, and tests do not cover the
new exception crossing the older truncated-coherence/persistence boundary.
Candidate-specific searches across all tracked review and plan history found
no completed, active, deferred, or rejected owner for this interaction.

## Rejected or historically owned candidates

- The primary Cycle 18 `YearMonth` repair is otherwise closed: the branded
  constructor rejects malformed raw strings, same-year and January
  predecessors preserve four digits, January 1000 selects December 0999, and
  the direct `0000-01` helper contract is explicit.
- Publication identity now hashes identity-free browser, legacy-full, and
  legacy-compact payloads under stable keys before injection. All advertised
  artifacts carry one hash; legacy outputs advertise `2.0.0`, while browser
  summary remains `1.0.0`. No circular/self-hash or reader-generation
  regression survived review.
- `.mts` and `.cts` now enter the same extension-derived production,
  test, and top-level config discovery path. TypeScript parsing and
  production-versus-development ownership remain coherent for both
  extensions.
- Parser duplication, optimizer complexity, category-color fallback,
  storage threat-model choices, CSP hosting limits, PDF fallback extraction,
  broad generator extraction, and other longstanding maintainability risks
  retain explicit historical owners. They were not re-reported as Cycle 19
  findings.

## Verification and final missed-issue sweep

- Direct `isAnalysisResultCoherent()` lower-bound truncated probe: reproduced
  the uncaught `RangeError`.
- Direct `deserializeAnalysis()` current-v4 lower-bound truncated probe:
  reproduced the same uncaught `RangeError`.
- Focused calendar, coherence, persistence, publication, and dependency
  matrix: 286 tests passed, 0 failed, 719 expectations. The absence of the
  lower-bound validator case explains why the existing suites stay green.
- `bun run data:check`: 683 card YAML files parsed; 24 issuers, all generated
  catalog projections, and README catalog matched canonical output.
- `bun run dependencies:check`: current manifests, source imports, peer
  contracts, and vendored archives passed.
- `git diff --check c182c81..fcc8980`: passed.
- No browser, Playwright, Chrome, preview server, network, or deployment
  command was started during this specialist pass.

Final count: **one new Low-severity, High-confidence finding**.
