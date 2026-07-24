# Review-plan-fix Cycle 18 — QA tester

## Review identity

- Date: 2026-07-24
- Revision: `c182c8144a4284bae1f28f009a5b0930d7762d5c`
- Role: source-level QA, contract/reachability adjudication, regression
  coverage, user-visible failure analysis, and strict historical novelty
- Disposition: **one novel Low-severity root retained**
- Other adjudications: one confirmed historical regression under `C3-008`;
  one confirmed but dormant preventive completion gap under Plan 147
- Scope: read-only QA review plus this report; no implementation, source,
  test, plan, generated-artifact, git, browser, E2E, build, install, or deploy
  action

## Coverage and method

The existing repository inventory covers 2,394 tracked paths, including 181
test/E2E paths and 1,222 tracked `.context` plans/reviews. QA traced:

- all supported statement date parsers into shared analysis context,
  previous-spending selection, browser/CLI disclosures, coherence validation,
  and persistence;
- authored card data into split and legacy publication projections, embedded
  metadata, generated contracts, build-time and runtime consumers, and
  publication tests;
- workspace file discovery through extension admission, source-kind
  classification, TypeScript import parsing, manifest ownership checks, and
  dependency fixtures; and
- current and archived ownership for calendar semantics, publication
  identity, legacy reward grouping, and test/config dependency enforcement.

The six protected untracked Cycle 42 artifacts were not opened, searched,
hashed, or modified.

## QA adjudication summary

| Candidate | Evidence status | Current reachability | Novelty disposition |
|---|---|---|---|
| Low-year `YearMonth` width | Confirmed | Direct shared-core contract; supported statement parsers block the affected years | **Retain as one novel Low / High root** |
| Legacy catalog identity reuse | Confirmed | Legacy/external only; active split browser generation remains pinned | Reopen completed `C3-008`; not a new root |
| `.mts` / `.cts` discovery | Confirmed statically | Dormant: no tracked file uses either suffix | Preventive Plan 147 completion; not a current root |

## C18-QA-001 — `previousCalendarMonth()` can leave its admitted `YearMonth` domain

- Severity: **Low**
- Confidence: **High**
- Status: **Confirmed by source and contract tracing**
- Validation boundary:
  `packages/core/src/analysis/context.ts:51-78`
- Defective predecessor construction:
  `packages/core/src/analysis/context.ts:80-91`
- Context effect:
  `packages/core/src/analysis/context.ts:101-164`
- Reward-basis effect:
  `packages/core/src/analysis/performance.ts:68-114`
- Fresh-result/persistence consumers:
  `apps/web/src/lib/analysis-result.ts:895-970,1073-1094` and
  `apps/web/src/lib/persistence.ts:677-709`
- Existing tests:
  `packages/core/__tests__/analysis.test.ts:8-126` and
  `apps/web/__tests__/analysis-context.test.ts:13-35`

`isYearMonth()` admits exactly four year digits and a valid two-digit month.
`yearMonthOfDate()` preserves the four-digit text of a date that passes the
shared core validator. `previousCalendarMonth()` converts that year text to a
number and interpolates it without restoring its width.

The January hypothesis is confirmed, but the affected domain is broader:

- every predecessor produced for input years `0100` through `0999` loses a
  leading zero, including non-January months; and
- January `1000` rolls back to a three-digit predecessor.

The result fails the same module's `isYearMonth()` predicate despite the
declared `YearMonth` return type. When a valid predecessor transaction is
present, its preserved four-digit month does not equal the malformed key.
`buildAnalysisContext()` therefore treats the exact prior month as absent and
passes assumed zero spending into card tier selection. A fresh result can
also carry a basis month that persistence later rejects as malformed.

### Reachability and realistic QA scenario

This is not a normal modern statement-upload defect. All supported parser
paths apply `packages/parser/src/date-utils.ts:238-245`, which admits only
years 1900 through 2100; JSON explicitly rejects a date outside that range at
`packages/parser/src/shared/json.ts:239-243`, and CSV/XLSX/OFX/PDF routes use
the same predicate. Ordinary browser and CLI statements therefore cannot
reach the low-year branch.

The current failure is at the exported shared-core boundary. A direct core
consumer supplies a valid four-digit transaction array with a latest January
1000 row and a December 0999 predecessor. The context reports the predecessor
month as missing, resolves previous spending to zero, and can select a lower
performance tier than the input warrants. The same contract failure appears
within one year for 0100–0999. This synthetic scenario is appropriate for
unit/contract QA; it is not presented as a plausible Korean cardholder
workflow.

The parser's narrower year policy materially bounds severity but does not
repair the exported helper's false return invariant or the core validator's
broader admitted domain.

### QA acceptance requirements

- Every accepted `YearMonth` predecessor is either another value accepted by
  `isYearMonth()` or a deliberately specified lower-bound failure.
- Representative same-year inputs in 0100–0999 retain four year digits.
- January 1000 selects a present December 0999 transaction and records
  statement-month provenance.
- Modern 1900–2100 behavior, missing-month behavior, monthly ordering, and
  the single-date-proof count remain unchanged.
- Fresh-result coherence and persistence agree on the resulting basis month.

### Novelty

Archived Plan 68 owns exact previous-calendar-month semantics and ordinary
January/December rollover. Cycle 17 owns preserving one validated month
projection per row. Earlier parser findings own missing month/day padding in
short date formats. No tracked plan, review, deferral, or rejection owns
numeric year conversion causing this shared helper to violate its own
four-digit output domain. `C18-QA-001` is therefore retained as the sole novel
Cycle 18 QA root.

## Legacy publication identity — confirmed regression, not novel

- Severity: **Low**
- Confidence: **High**
- Status: **Confirmed invariant mismatch; downstream legacy impact requires
  an external/manual consumer**
- Hash boundary: `scripts/catalog-publication.ts:113-132`
- Metadata reuse and legacy projections:
  `scripts/build-json.ts:245-329,375-438`
- Affected generated contracts: `packages/rules/data/cards.json`,
  `packages/rules/data/cards-compact.json`, and
  `apps/web/public/data/cards.json`
- Existing identity tests:
  `scripts/__tests__/catalog-publication.test.ts:475-645`

The source observation survives QA. Cycle 17 changed legacy category-index
and compact reward projection bytes and changed compact list cardinality,
while the three legacy artifacts retained version `1.0.0` and the same
embedded browser-publication hash. Existing identity tests mutate only the
split summary, optimizer, detail, and category payload set; the data drift
gate proves generator/file agreement, not that legacy bytes are covered by
their metadata.

Neutral QA scenario: a downstream legacy consumer uses the advertised hash as
a cache generation key, retains the older projection, and cannot distinguish
it from the new comparison-group representation. This remains a manual or
external-consumer scenario. Tracked first-party browser code rejects requests
for legacy `data/cards.json` and pins the separate split artifacts; no tracked
reader uses the legacy ranking hash as a cache key.

Strict novelty rejects a new Cycle 18 ID. Completed Plan 80 / `C3-008`
explicitly promises a unique identity for every published catalog byte set
and requires a source-stable projection change to change the publication ID.
The current state is a residual or regression in that completed owner's
scope. Plan 146 correctly owns homogeneous comparison grouping and explicitly
records that active split source-identity artifacts stayed unchanged; it does
not supersede the older all-publication identity requirement.

QA disposition: reopen `C3-008` if legacy artifacts remain supported, with a
legacy-only projection-mutation regression and an explicit schema/version
expectation. If they are unsupported build byproducts, their identity/version
semantics should be retired rather than treated as a new product contract.
This item is not counted as novel.

## `.mts` / `.cts` dependency discovery — preventive Plan 147 completion gap

- Severity: **Low preventive-policy gap**
- Confidence: **High**
- Status: **Confirmed statically; dormant in the current tracked tree**
- Extension and grammar boundary:
  `scripts/check-dependencies.ts:8-21`
- Discovery and classification:
  `scripts/check-dependencies.ts:464-503,632-684`
- Current fixtures:
  `scripts/__tests__/check-dependencies.test.ts:21-88,144-226`

The config filename grammar recognizes standard module-TypeScript `.mts` and
`.cts` names. The shared extension set omits both, and source/test/config
discovery filters through that set before TypeScript import parsing. The
implementation inconsistency is real.

No current QA failure follows: the tracked tree contains no `.mts` or `.cts`
file, so no present production, test, or config import escapes ownership
checking. The failure scenario begins only after a future file migration: an
undeclared dependency in that module-TypeScript file is omitted while the
equivalent `.ts` file is reported.

Plan 147 already owns discovery and production-versus-test/config manifest
classification. Its fixture helper hard-codes `.ts` filenames, so module
extension coverage is a sensible preventive completion of that owner before
either suffix is adopted. It is not a current product, build, install, or
runtime failure and is not counted as a novel Cycle 18 root.

QA acceptance for that preventive completion is exact diagnostic parity for
`.ts`, `.mts`, and `.cts` production/test/config fixtures, plus acceptance
when test/config imports are directly declared as development dependencies.

## Additional-root and missed-issue sweep

The final sweep rechecked:

- the parser 1900–2100 date boundary against core ISO/YearMonth admission;
- all `previousCalendarMonth()` call sites in context construction,
  result-coherence validation, reoptimization, and persistence;
- legacy/full/compact generated fields, version/hash metadata, active versus
  build-time consumers, and split-artifact hash pinning;
- dependency extension admission, recursive source/test discovery,
  top-level config discovery, ScriptKind selection, and exact fixture
  diagnostics;
- recent Cycle 17 date-projection, comparison-group, category-label, and
  dependency-ownership repairs; and
- current assertion coverage and deterministic gate inclusion for each
  boundary.

The core/parser year-domain mismatch is part of `C18-QA-001`, not a second
root. Active split publication identity remains sound. Current tracked import
ownership remains complete. No additional distinct, current, reproducible,
history-novel QA root survived.

No tests, broad gates, builds, browser/E2E runs, installs, network operations,
or deploys were performed. Final novel QA finding count: **1**.
