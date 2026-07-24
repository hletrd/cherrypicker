# Review-plan-fix Cycle 17 — QA tester

## Review identity

- Date: 2026-07-24
- Revision: `857e12a794e585560a0c447b0a1619def02cbcf3`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Role: non-browser workflow, user-visible behavior, edge/failure state,
  generated-data integrity, and candidate reproducibility
- Disposition: no genuinely new QA-only finding; all four retained Cycle 17
  roots independently confirmed
- Scope: read-only repository inspection, bounded in-memory/artifact probes,
  focused tests, and this report only. No source, test, generated artifact,
  dependency, configuration, plan, commit, browser, deployment, or external
  state was changed.

## Workflow coverage

The QA pass followed these ordinary flows rather than relying only on the
specialist reports:

- uploaded statements through parser completion, strict calendar context,
  latest/previous-month selection, optimizer dispatch, result construction,
  reoptimization, persistence, and UI consumption;
- authored categories and card rules through schemas, catalog publication,
  legacy/compact generation, web summary/optimizer/detail shards, generated
  fallback labels, and browser/CLI consumers;
- web parity tests through package resolution, workspace manifests, the Bun
  lock, and repository dependency policy;
- current Cycle 16 XLSX/legacy-XLS/HTML worksheet bounds through shared
  metadata validation, all server/browser adapters, direct merge-index calls,
  and focused regressions; and
- failure states for malformed dates, generated-source punctuation,
  unavailable transitive dependencies, discontinued cards, source-hash
  mismatch, and boundary/one-over worksheet metadata.

All 2,374 tracked paths were present in the closing manifest. The QA evidence
was reconciled with all 1,204 tracked `.context` records and every current
Cycle 17 report available at the closing cutoff.

## Independent results

### Generated catalog baseline

Every current generated JSON file parsed successfully. The web publication is
internally coherent:

| Artifact contract | Observed result |
| --- | --- |
| Summary | 683 cards; metadata also says 683 cards and 24 issuers |
| Issuer detail shards | 24 files containing 683 cards total |
| Optimizer catalog | 682 cards |
| Availability explanation | Summary has exactly one discontinued card, so 682 active cards is expected |
| Publication identity | Summary, optimizer, categories, and every detail shard use `ad1edfe624495c7380b86255de27a29091eacc09e325d82a9533034ad2279b58` |
| Current generated fallback | 3,505 bytes and successfully transpiles as TypeScript |

This rules out stale or cross-generation checked-in data as a competing
explanation for the Cycle 17 findings.

### Focused regression baseline

The six-file matrix covering catalog publication, dependency policy, calendar
context, CP949 parity, current worksheet bounds, and rules schemas passed:

- 163 tests passed;
- 0 failed; and
- 3,241 expectations executed.

The standalone dependency policy also reported:
`Dependency manifests, imports, peer contracts, and vendored archives are valid.`

The green baseline does not contradict the findings. Each reproduction below
uses an input or ownership condition missing from those suites.

## Candidate adjudication

### `C17-CR-001` — heterogeneous legacy reward ranking

- Severity: Low
- Confidence: High
- Status: Confirmed
- Production evidence:
  `scripts/build-json.ts:79-86,248-271,373-404` compares canonical reward
  amounts without using the kind/unit retained by
  `scripts/catalog-publication.ts:179-187`.
- Independent reproduction:
  14 of 43 current category indexes contain mixed reward kinds. The generated
  `dining` order begins with fixed Won values 5,000, 4,000, and 2,000, then
  percentage values of 60 because the raw numbers are sorted descending.
  In the compact catalog, 45 cards have mixed-kind `topRewards`; seven such
  lists are already at the five-entry truncation boundary.
- Ordinary scenario:
  a downstream legacy/public-catalog reader treats the list as a recommendation
  order. On a 10,000-won dining purchase, 60% is 6,000 won and outranks the
  5,000-won fixed value; at another purchase size the relation can reverse.
  There is no context-free correct cross-unit order.
- Impact bound:
  the active browser optimizer loads `cards-optimizer.json` and evaluates
  rewards with transaction context. It does not consume the affected legacy
  ranking, so Low severity is appropriate.
- QA acceptance:
  remove the unsupported rank/truncation, or group by canonical kind and unit.
  If cross-kind ordering remains, expose the scenario and verify order changes
  correctly across purchase amounts, performance tiers, caps, mileage blocks,
  and fuel volume.

### `RPF17-PERF-001` — repeated strict calendar validation

- Severity: Medium
- Confidence: High
- Status: Confirmed
- Production evidence:
  `packages/core/src/analysis/context.ts:51-77,101-179` proves every date once,
  then `yearMonthOfDate()` repeats the regular expression, numeric conversion,
  `Date.UTC`, `Date` construction, and round-trip in the latest, previous, and
  monthly passes. Ordinary callers are
  `apps/web/src/lib/analyzer.ts:407-425`,
  `apps/web/src/lib/store.svelte.ts:355-394`, and
  `tools/cli/src/analysis.ts:58-82`.
- Independent reproduction:
  on 100,000 valid rows over three months, five bounded samples produced a
  100.0 ms current median versus 41.7 ms for a one-validation implementation.
  Latest month, valid/invalid counts, latest/previous counts, and every monthly
  spending/count bucket were equal.
- Ordinary scenario:
  a compact large statement reaches context construction after parser work
  returns but before the browser optimizer worker starts. The synchronous
  repeated proof therefore extends the main-thread wait; reoptimization and
  CLI analysis repeat it.
- QA acceptance:
  preserve invalid-date quarantine and every returned field while performing
  no more than one strict proof per row. Validate unsorted multi-month data,
  leap day, January rollover, missing predecessor month, explicit previous
  spending, periods, safe-integer failures, and row identity/order. Treat
  operation count as the stable gate and timing as supporting evidence.

### `C17-SEC-001` — raw category strings become TypeScript source

- Severity: Medium
- Confidence: High
- Status: Confirmed
- Production evidence:
  `packages/rules/src/schema.ts:303-335` accepts unrestricted category strings;
  `scripts/build-json.ts:448-463` places them between handwritten single
  quotes. The result is statically imported through
  `apps/web/src/lib/category-labels.ts` and the card-detail component.
- Independent reproduction:
  `categoryNodeSchema` accepted the ordinary Korean label `식당'할인`. The
  generator's current interpolation produces
  `['dining', '식당'할인'],`, and Bun's TypeScript transpiler rejects that
  source with a parse error. The current benign generated file still
  transpiles, which explains the green build baseline.
- Ordinary scenario:
  a catalog author adds a label containing an apostrophe and passes schema
  validation, but regeneration leaves an invalid first-party module and the
  subsequent web build fails. More carefully shaped source-valid strings can
  alter generated code before Svelte text escaping is relevant.
- QA acceptance:
  serialize a structured tuple array rather than assembling literals. Prove
  exact `Map` equality after parsing/executing generated output for quotes,
  slashes, line breaks, Unicode, template-marker text, and closing-tag-like
  text. Check this at generation time, not only during a later web build.

### `C17-DEP-001` — undeclared web test dependency

- Severity: Low
- Confidence: High
- Status: Confirmed
- Production/workflow evidence:
  `apps/web/__tests__/parser-cycle5-integrity.test.ts:3,48-50` directly imports
  `iconv-lite`; `apps/web/package.json:12-30` declares neither a dependency
  nor a development dependency. Parser owns the currently reachable copy at
  `packages/parser/package.json:20-29`, while
  `scripts/check-dependencies.ts:553-595,695-720` scans only production `src`
  imports and production dependencies.
- Independent reproduction:
  the CP949 parity test passed inside the focused matrix and
  `import.meta.resolve('iconv-lite')` from `apps/web` resolved to the root
  `node_modules/iconv-lite/lib/index.js`. `bun pm why iconv-lite` showed
  parser as a provider. The dependency policy still passed because it did not
  inspect that test import.
- Ordinary scenario:
  an isolated web install, a stricter linker, or removal of parser's runtime
  need for `iconv-lite` makes the unchanged web test unresolvable. End users
  are not affected at runtime; the defect is in CI/developer workflow
  portability, which supports Low severity.
- QA acceptance:
  declare the web development dependency or move fixture encoding behind an
  owning helper. Exercise the parity test under an ownership-isolated fixture
  and require the dependency policy to fail an undeclared test/config import
  while accepting an explicitly declared development dependency.

## Rejected fifth hypothesis

The root `zod` development declaration was checked as a fifth candidate.
There is no root script/config/E2E direct import, but rules and scraper own
compatible direct declarations and the repository uses one locked identity.
Removing the root declaration was not shown to change install resolution,
runtime, build output, command behavior, or a user workflow. The absence of an
unused-dependency policy is generic hygiene rather than a distinct reproduced
failure. No fifth finding is retained.

## Current Cycle 16 regression check

The 17 focused worksheet-metadata tests passed inside the matrix. They cover:

- exact and one-over workbook, row, column, cell, merge-count, and
  merge-coverage boundaries;
- per-sheet and cumulative totals;
- malformed A1 and merge endpoints;
- validation of later sheets/tables before accepting an earlier candidate;
- direct merge-index callers and ordered interval storage;
- server/browser XLSX and direct/HTML-as-spreadsheet paths; and
- ordinary legacy-spreadsheet and merged-table parity.

No bypass, inconsistent error state, or regression was reproduced. The
remaining README wording noted by the document role retains its Cycle 16 owner
and is not a new QA root.

## History and closing sweep

Candidate-specific searches covered all tracked review and plan history plus
the current Cycle 17 reports. Prior owners for `rate: 0` fixed rewards,
date-array sorting, monthly rebuilds, result-coherence validation, generic
generator extraction, scraper's former Zod ownership, removed heavy
dependencies, and Cycle 16 worksheet limits are distinct. No tracked owner
invalidates the four retained roots, and no separate QA-only failure survived.

The closing pass rechecked generated JSON readability and identity, card
counts and availability, current fallback compilation, candidate consumers,
manifest/import ownership, dependency-policy reach, calendar outputs,
worksheet failure edges, and focused-test results.

No full verify, data build/check, web build, browser, Playwright, deployment,
or external-system command was run. Protected untracked Cycle 42 artifacts
were not opened, edited, staged, removed, or adopted.

Final result: **0 new QA-only findings; four existing Cycle 17 roots confirmed
with reproducible workflows and acceptance criteria**.
