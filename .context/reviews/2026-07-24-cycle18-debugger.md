# Cycle 18 debugger review

## Result

One distinct current-HEAD logic root was retained:

- **C18-DBG-001 — Low:** `previousCalendarMonth()` does not preserve the four-digit `YearMonth` format for January inputs from `0100` through `1000`.

The two named code-review candidates were independently confirmed at the implementation level but are not additional novel debugger roots:

- `C18-CR-001` is a current residual/regression of the completed `C3-008` publication-identity root.
- `C18-CR-002` is a dormant dependency-policy coverage gap with no affected tracked file; Plan 147 already owns test/config admission at the broader boundary.

Review target: `c182c8144a4284bae1f28f009a5b0930d7762d5c`. The review was read-only apart from this report. No browser, E2E, network, generator, build, Git-mutating, or process-owning operation was used.

## Retained finding

### C18-DBG-001 — January rollover can return a malformed `YearMonth` and miss an existing previous month

- Severity: **Low**
- Confidence: **High**
- Status: **confirmed** by source tracing and a focused current-HEAD runtime probe
- Input and format contracts: `packages/core/src/analysis/context.ts:51-77`
- Defective rollover: `packages/core/src/analysis/context.ts:80-90`
- Analysis impact: `packages/core/src/analysis/context.ts:101-163`
- Persistence/coherence consumers: `apps/web/src/lib/analysis-result.ts:893-920,922-980,1072-1095`
- Missing boundary coverage: `apps/web/__tests__/analysis-context.test.ts:30-35`

`isYearMonth()` admits exactly four-digit year text. On a January rollover,
`previousCalendarMonth()` converts the year to a number and interpolates
`year - 1` without restoring the four-character width. Consequently:

- `0100-01` produces `99-12`;
- `0999-01` produces `998-12`; and
- `1000-01` produces `999-12`.

Each result fails the module's own `isYearMonth()` predicate despite the
function's declared `YearMonth` return type. `1001-01` is the first January
for which the decremented year naturally remains four digits.

Concrete neutral failure scenario: an analysis context contains accepted rows
for December `0999` and January `1000`. Both rows remain in
`validTransactions` and in `monthlyBreakdown`, but the January rollover looks
for `999-12` rather than `0999-12`. The December row is omitted from
`previousTransactions`, and `previousSpendingBasis` reports a missing month
with an assumed zero amount. The focused probe reproduced exactly that state:
two valid rows, zero previous rows, and both real month buckets still present.

This has low practical severity because card-statement dates are ordinarily
modern. It remains a real exported-helper and analysis invariant failure for
inputs the current validator accepts, and downstream coherence checks repeat
the same malformed derivation rather than detecting it.

Root-cause fix: format the decremented year with four digits before returning,
and define the supported lower-year boundary explicitly so
`isValidIsoDate()`, `isYearMonth()`, and `previousCalendarMonth()` agree.
Add boundary tests for January `0100`, `1000`, and `1001`, plus an invariant
that every successful rollover result passes `isYearMonth()`. Add a
December/January analysis fixture proving the previous bucket is selected.

Novelty: the tracked history owns exact previous-calendar-month semantics and
ordinary January rollover in archived Plan 68, while Cycle 13 owns month/day
padding in parser short-year branches. No tracked plan or review owns loss of
year width in this shared helper or the resulting previous-bucket
misclassification.

## Independent disposition of named candidates

### C18-CR-001 — changed legacy catalog bytes retain their old identity

- Severity: **Low**
- Confidence: **High**
- Status: **confirmed invariant mismatch; downstream impact is manual/external**
- Hash boundary: `scripts/catalog-publication.ts:113-132`
- Metadata reuse: `scripts/build-json.ts:299-320,385-388`
- Changed legacy projections: `scripts/build-json.ts:245-281,400-425`
- Affected artifacts: `packages/rules/data/cards.json`,
  `packages/rules/data/cards-compact.json`,
  `apps/web/public/data/cards.json`

Independent comparison between `23c7317` and current HEAD confirmed that all
three legacy artifacts changed substantially while retaining version `1.0.0`
and the same embedded `sourceHash`. The current compact artifact also has five
cards with more than five grouped `topRewards`, with a maximum of seven,
confirming that the advertised identity did not follow the repaired
projection.

Neutral scenario: a legacy consumer treats `sourceHash` as a generation/cache
key and reuses a prior ranking even though the ranking projection changed.
No tracked first-party browser reader currently consumes those legacy ranking
fields, so product impact remains bounded and an external-consumer failure
would require manual confirmation.

The root fix is still to include every supported legacy projection in an
identity-free keyed payload before hashing, or give each legacy artifact its
own content identity and version contract. A projection-only change should be
a regression fixture.

Novelty disposition: **do not count as a new Cycle 18 root.**
`.context/plans/_archive/80-cycle3-publication-runtime-dependencies.md:7-22,47-50`
already requires every published catalog byte set to have a unique identity
and a source-stable projection change to change that identity. The present
state is a residual/regression of `C3-008`, suitable for reopening that owner.

### C18-CR-002 — `.mts`/`.cts` names are recognized but excluded before dependency analysis

- Severity: **Low preventive-policy gap**
- Confidence: **High**
- Status: **confirmed statically, dormant in the current tracked tree**
- Extension inventory and config grammar:
  `scripts/check-dependencies.ts:11-21`
- Recursive and config admission:
  `scripts/check-dependencies.ts:464-503`
- Parser support and caller classification:
  `scripts/check-dependencies.ts:525-595,632-658`

`CONFIG_SOURCE_PATTERN` recognizes module TypeScript config suffixes, and the
TypeScript parser would handle them, but `SOURCE_EXTENSIONS` omits `.mts` and
`.cts`. Both recursive test discovery and top-level config discovery require
membership in that set first, making the apparent grammar support
unreachable. The tracked tree currently contains zero `.mts`/`.cts` files.

Neutral scenario: after a future config or test helper is renamed to a module
TypeScript suffix, an undeclared package import in that file is omitted from
the policy result. No current dependency is escaping the gate.

The root fix is to derive discovery and config grammar from one extension
contract, admit both suffixes, and add config/test fixtures for them.

Novelty/current-failure disposition: **do not count as a current debugger
finding.** Plan 147 already owns admission and classification of test/config
sources, and no current tracked path exercises the omitted suffixes. This is
appropriate hardening or a Plan 147 acceptance extension rather than a
present repository failure.

## Verification and missed-issue sweep

- The focused `analysis-context` unit file passed: 12 tests and 22
  expectations. Its rollover test covers `2026-01` only and therefore does not
  contradict C18-DBG-001.
- Direct probes covered `0100-01`, `0999-01`, `1000-01`, `1001-01`, and a
  two-row `0999-12`/`1000-01` context.
- Legacy artifacts were compared at both revisions without regenerating or
  modifying them. Their versions/hashes were identical while their tracked
  bytes differed.
- Dependency admission was followed from filename inventory through
  source-kind classification and import parsing; the tracked module
  TypeScript file count is zero.
- `git diff --check 8044347..HEAD` passed. All 15 non-context changed paths
  were included in the closing changed-line failure-boundary sweep.
- All 1,222 tracked `.context` paths (904 reviews and 318 plans) were included
  in the history inventory. Focused history reconciliation covered early-year
  formatting, calendar rollover, catalog identity/versioning, module
  extensions, and dependency admission.
- The adjacent sweep revisited generated-category serialization, grouped
  reward ordering/limits, month projection and invalid-date quarantine,
  dependency ownership, generated-artifact parity, exception paths, and
  browser result-coherence consumers. No fourth current, reproducible,
  history-novel root survived.
- The six protected untracked Cycle 42 artifacts were identified only as
  excluded paths and were not opened, searched, hashed, or modified.

Final debugger count: **one novel Low-severity finding**, High confidence.
