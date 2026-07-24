# Review-plan-fix Cycle 18 — tracer

## Review identity and disposition

- Date: 2026-07-24
- Reviewed revision: `c182c8144a4284bae1f28f009a5b0930d7762d5c`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Lens: execution paths, boundary transitions, generated-data provenance,
  error/state propagation, and strict historical ownership
- Disposition: **one genuinely new Low finding, High confidence**
- Scope: read-only tracing plus this report; no implementation, source, test,
  generated-data, manifest, lockfile, configuration, plan, process, gate,
  deployment, or external-system change

The trace covered the current parser → analysis context → performance basis →
optimizer → result coherence → persistence/UI path, the catalog authoring →
projection → identity → publication → browser/CLI consumer path, and the
dependency manifest → source discovery → import classification path. Novelty
searches covered all 1,222 tracked `.context` records (904 reviews and 318
plans), including archived plans and deferred items.

## C18-TR-001 — the validated `YearMonth` domain is not closed under predecessor derivation

- Severity: **Low**
- Confidence: **High**
- Status: **Confirmed**
- Novelty: **Genuinely new exact root**
- Primary boundary:
  `packages/core/src/analysis/context.ts:51-90`
- Downstream context:
  `packages/core/src/analysis/context.ts:101-183`
- Public surfaces:
  `packages/core/src/index.ts:27-42`;
  `packages/core/package.json:7-12`;
  `apps/web/src/lib/analysis-context.ts:1-15`

`isYearMonth()` accepts exactly four decimal year digits and a valid two-digit
month. `previousCalendarMonth()` validates that input, converts its year text
to a number, and interpolates the number without restoring four-digit width.
It can therefore return a value that its own input predicate rejects. The
year-boundary witness is:

- `1000-01` is a valid `YearMonth`;
- its exact predecessor should be `0999-12`; but
- the helper derives `999-12`, which is not a valid `YearMonth`.

The same loss occurs for every leading-zero year because both return branches
interpolate the numeric year. This is a postcondition failure in an exported
pure helper, not only a display-format difference.

### Causal and state trace

1. The core date predicate accepts calendar-valid four-digit dates outside the
   product parser's narrower range
   (`packages/core/src/analysis/context.ts:51-77`). Thus direct core callers can
   supply valid adjacent dates in December 0999 and January 1000.
2. `buildAnalysisContext()` projects those months, derives `999-12`, and
   compares it with the correctly projected `0999-12` key
   (`packages/core/src/analysis/context.ts:114-164`). The prior transaction is
   not selected, and the result records a missing-calendar-month zero basis.
3. `resolveCardPreviousSpending()` turns that basis into zero for every card
   (`packages/core/src/analysis/performance.ts:68-114`). Web optimization
   forwards the map into constraints and reward scoring
   (`apps/web/src/lib/analyzer.ts:218-258`;
   `packages/core/src/optimizer/constraints.ts:9-25`;
   `packages/core/src/optimizer/greedy.ts:228-266`).
4. Fresh-result coherence reconstructs the same malformed predecessor and asks
   whether the month map contains that malformed key. It therefore agrees with
   the false “missing month” basis and accepts the internally consistent but
   incorrect result
   (`apps/web/src/lib/analysis-result.ts:893-920,1041-1095`).
5. Serialization writes the accepted basis as-is
   (`apps/web/src/lib/persistence.ts:127-155`). Restoration rejects the state:
   transaction decoding uses the parser-range validator, while the basis
   decoder independently requires `isYearMonth()`
   (`apps/web/src/lib/persistence.ts:677-708,802-819,860-865`). The store then
   removes the saved result and surfaces its corrupted-restore state
   (`apps/web/src/lib/store.svelte.ts:112-134`).

Impact is deliberately rated Low. Ordinary first-party web and CLI statement
parsers accept only years 1900–2100
(`packages/parser/src/date-utils.ts:231-245`), so their normal upload path
cannot reach the low-year edge. The current defect remains reachable through
the exported core/helper surface and direct typed analysis callers; it also
breaks the helper's stated runtime refinement invariant. Existing rollover
coverage uses contemporary years only
(`apps/web/__tests__/analysis-context.test.ts:25-35`;
`packages/core/__tests__/analysis.test.ts:8-95`).

### Historical adjudication

Archived Plan 68 required strict year-months, exact predecessor selection, and
an ordinary December/January rollover
(`.context/plans/_archive/68-cycle1-domain-state-contract.md:423-468`).
Plan 144 subsequently required the Cycle 17 projection optimization to preserve
that behavior
(`.context/plans/144-cycle17-analysis-context-date-projection.md:19-47`).
Neither record identifies leading-zero year loss, requires closure under the
validator, or exercises the width boundary. Searches for the helper, type,
low-year values, year padding, underflow, and January rollover across the full
tracked history found no earlier finding, plan, deferred item, or explicit
rejection for this exact root. It is retained as novel rather than relabeled as
the already completed ordinary-rollover work.

## Adjudication — legacy publication bytes reuse an older identity

- Severity if considered in isolation: **Low**
- Confidence: **High**
- Technical status: **Confirmed historical regression**
- Novelty disposition: **Not new; owned by C3-008 / Plan 80**

The Cycle 17 comparison-group repair changed the checked-in bytes of
`packages/rules/data/cards.json`,
`packages/rules/data/cards-compact.json`, and
`apps/web/public/data/cards.json`, while all three retained publication version
`1.0.0` and source hash
`ad1edfe624495c7380b86255de27a29091eacc09e325d82a9533034ad2279b58`.
Relative to pre-repair revision `8044347`, the three legacy blobs changed while
the summary, optimizer, categories, and all 24 detail shards did not.

The cause is explicit:

- `computePublicationSourceHash()` hashes only the identity-free browser
  summary, optimizer, details, and categories projections
  (`scripts/catalog-publication.ts:113-132,274-409`);
- `build-json.ts` copies that hash into the separately constructed legacy full
  and compact metadata
  (`scripts/build-json.ts:299-329,375-438`); and
- the changed legacy category/compact indexes are assembled outside the hashed
  projection set
  (`scripts/build-json.ts:245-281,385-432`).

The current first-party impact is bounded. The browser loader pins identity
across the active split artifacts (`apps/web/src/lib/cards.ts:308-425`), and
the bundle policy explicitly rejects a browser loader that requests legacy
`data/cards.json` (`scripts/check-web-bundles.ts:169-188`). The remaining
first-party build-time reader uses only catalog counts and does not combine the
legacy indexes with split runtime data (`apps/web/src/lib/build-stats.ts:13-32`).

This nevertheless reopens the exact historical contract that every changed
published byte set changes identity. Plan 80 states that outcome and requires
source-stable projection mutations to produce a different publication ID
(`.context/plans/_archive/80-cycle3-publication-runtime-dependencies.md:7-22,47-50`);
its owner is C3-008. Plan 146 also records that the active identity artifacts
remained unchanged during the legacy repair
(`.context/plans/146-cycle17-legacy-reward-comparison-groups.md:52-67`).
The condition should therefore be tracked as a regression of C3-008/Plan 80,
not counted as a distinct Cycle 18 finding.

## Adjudication — `.mts` / `.cts` dependency discovery

- Current severity: **None; preventive gap**
- Confidence: **High**
- Technical status: **Confirmed dormant mismatch**
- Novelty disposition: **Plan 147 completion scope, not a current root**

`CONFIG_SOURCE_PATTERN` recognizes `.mts` and `.cts` configuration names, but
`SOURCE_EXTENSIONS` contains neither extension
(`scripts/check-dependencies.ts:11-21`). Both recursive source discovery and
top-level workspace-config discovery apply the extension filter first
(`scripts/check-dependencies.ts:464-503`), so such a future file would not reach
import classification.

The tracked tree currently contains zero `.mts` or `.cts` files. Its current
workspace config and all present production/test sources are covered by the
admitted extensions, so no current import, manifest, install, build, test, or
runtime path is skipped. Plan 147 already owns classification of production
versus test/config sources and the corresponding fixtures
(`.context/plans/147-cycle17-test-dependency-ownership.md:20-38,40-67`).
This is a useful preventive fixture/format completion under that owner, but it
does not demonstrate a distinct current Cycle 18 failure and is not counted.

## Adjacent trace and closing result

The final adjacent pass found no fourth root:

- all 27 active browser catalog identity surfaces still carry one common hash
  and none changed in the Cycle 17 repair;
- category fallback publication now crosses the data-to-code boundary through
  structured JSON serialization
  (`scripts/category-label-publication.ts:5-44`);
- the optimized analysis-context projection preserves object identity, sorted
  order, invalid-row quarantine, and current ordinary calendar semantics
  (`packages/core/src/analysis/context.ts:114-183`); and
- the web test now owns `iconv-lite`, with the checker separating runtime from
  test/config ownership
  (`apps/web/package.json:25-31`;
  `scripts/check-dependencies.ts:598-685`).

No broad gate, build, browser, E2E run, install, audit, deployment, or process
ownership command was run. The protected untracked Cycle 42 artifacts were not
opened, modified, staged, or adopted.

Final count: **1 genuinely new Low finding, High confidence**.
