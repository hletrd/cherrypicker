# Cycle 18 code review

## Review identity

- Date: 2026-07-24
- Revision: `c182c8144a4284bae1f28f009a5b0930d7762d5c`
- Baseline: the Cycle 17 review revision
  `857e12a794e585560a0c447b0a1619def02cbcf3`, with focused review of every
  product change after `8044347`
- Role: code quality, logic, SOLID, and maintainability
- Disposition: two novel findings retained
- Severity: two Low
- Scope: read-only review plus this report; no product source, test, generated
  artifact, plan, Git state, or process ownership was changed

## Inventory and coverage

The inventory preceded source inspection. The current Git tree contains 2,394
tracked paths. Of these, 1,222 are `.context` records (904 reviews and 318
plans). The active tree includes 1,114 tracked code, configuration, authored
data, or generated-data paths and 181 test/E2E paths.

| Surface | Tracked paths | Coverage |
| --- | ---: | --- |
| `apps/web` | 172 | Browser parsers/workers, upload admission and cancellation, analysis replacement/reset, catalog readers and source-hash pinning, persistence, card navigation, and dashboard/report consumers |
| `packages/core` | 47 | Analysis context/date projection, categorization, numeric boundaries, calculator cap state, and greedy/counterfactual optimization |
| `packages/parser` | 86 | Detection/decoding and CSV, XLSX/HTML, PDF, JSON, and OFX server/browser contracts |
| `packages/rules` | 734 | Schema and semantic validation, loaders, catalog publication contracts, 683 authored card YAML files, and generated catalogs |
| `packages/viz` | 14 | Spending aggregation, terminal disclosure/sanitization, and standalone report rendering |
| `tools/cli` | 28 | Command validation, analysis scoping, catalog selection, consent, report context, and checked output |
| `tools/scraper` | 35 | Runtime configuration, network policy, bounded fetch, extraction quarantine, validation, and output |
| Scripts/E2E/root policy | 21 scripts, 16 E2E paths, manifests, workflow, and root configs | Generation, publication, dependency/toolchain/bundle gates, process ownership, and cross-package tests |

All 15 non-context paths changed after the Cycle 17 review were inspected as a
unit: the analysis date projection and proof-count test; category-label
serialization and generated fallback; legacy reward comparison helpers,
generator, tests, and three generated artifacts; and test/config dependency
ownership, manifest, and lock changes. Generated JSON was checked through its
generator and current artifact invariants rather than treated as handwritten
source. Unchanged production areas received a closing cross-file sweep for
state, error, cancellation, cap, parsing, persistence, publication, and output
interactions.

The six protected untracked Cycle 42 paths were identified only by `git status`
and were not opened, searched, hashed, staged, or modified.

## Findings

### C18-CR-001 — legacy catalog bytes change without changing their embedded publication identity

- Severity: Low
- Confidence: High
- Status: confirmed at current HEAD by source tracing and tracked-artifact
  comparison; no manual runtime validation is required
- Identity scope: `scripts/catalog-publication.ts:119-132`
- Metadata reuse: `scripts/build-json.ts:299-320,385-388`
- Newly changed legacy projections:
  `scripts/build-json.ts:245-281,400-425`
- Affected artifacts: `packages/rules/data/cards.json`,
  `packages/rules/data/cards-compact.json`, and
  `apps/web/public/data/cards.json`

`computePublicationSourceHash()` hashes the split browser summary, optimizer,
detail, and category payloads. `build-json.ts` then reuses that hash in the
metadata of the separate legacy full and compact catalogs even though their
category indexes and `topRewards` projections are not inputs to the hash.

The Cycle 17 grouping repair made the mismatch observable. Between the
pre-grouping revision `23c7317` and current HEAD, the three legacy artifacts
changed by thousands of lines, including new comparison metadata, grouped
ordering, duplicate reward projections across groups, and independently
limited compact groups. Their embedded `sourceHash` nevertheless remains
`ad1edfe624495c7380b86255de27a29091eacc09e325d82a9533034ad2279b58`;
their version also remains `1.0.0`. Five current compact card rows now contain
six or seven `topRewards`, while the former contract globally limited the list
to five.

Concrete failure scenario: a downstream legacy-catalog reader uses the
advertised `sourceHash` as a cache or generation key. It can retain the old
global ranking or treat old and new compact catalogs as the same publication
even though the index shape and ordering changed. No active first-party
browser reader consumes these legacy ranking fields, which bounds the
severity.

Suggested root-cause fix: construct the identity-free legacy full and compact
payloads before metadata injection and include each keyed projection in the
publication identity, or give these artifacts independent content hashes and
schema versions. Add a regression in which only a legacy index projection
changes and require its advertised identity or version to change. If the
legacy contract is externally supported, publish the grouped representation
under a new schema version rather than silently changing `1.0.0`.

Novelty: Cycle 3 publication-identity work owns the split browser
summary/detail/optimizer/category generation boundary, and Cycle 17 owns
homogeneous legacy comparison groups. The tracked history does not own their
new interaction: legacy-only generated bytes now change while the hash copied
into those same artifacts stays fixed. This is not a re-report of mixed active
browser generations, whose readers remain correctly pinned.

### C18-CR-002 — the dependency scanner's config grammar recognizes module TypeScript names that its file inventory excludes

- Severity: Low
- Confidence: High
- Status: confirmed policy gap by source tracing; dormant for current tracked
  filenames and therefore still needs a focused fixture rather than a product
  reproduction
- Extension inventory: `scripts/check-dependencies.ts:11-20`
- Config-name grammar: `scripts/check-dependencies.ts:21`
- File admission:
  `scripts/check-dependencies.ts:470-500,632-650`
- Import analysis: `scripts/check-dependencies.ts:525-595`

`CONFIG_SOURCE_PATTERN` accepts standard `.mts` and `.cts` config names, but
`SOURCE_EXTENSIONS` omits both extensions. Both recursive test discovery and
top-level config discovery require membership in `SOURCE_EXTENSIONS` before
the import parser runs. The apparent support in the filename grammar is
therefore unreachable.

Concrete failure scenario: a workspace adopts `tool.config.mts`, or moves a
test helper to `.mts`, and imports a package missing from that workspace's
manifest. `findUndeclaredWorkspaceImports()` silently omits the file, so the
blocking dependency check reports success even though the equivalent `.ts`
file would fail. The present tree contains no tracked `.mts` or `.cts` file,
which bounds current impact.

Suggested root-cause fix: add `.mts` and `.cts` to the shared extension set,
keep them parsed with `ts.ScriptKind.TS`, and add one config and one test
fixture for each module extension. Prefer deriving the config matcher and file
inventory from one extension contract so they cannot diverge again.

Novelty: exact tracked-history searches for `.mts`, `.cts`, module
extensions, source extensions, and dependency-config coverage found no
completed, deferred, rejected, or previously reported owner. Plan 147 owns
test/config dependency classification after a file is admitted; it does not
own this contradictory file-admission boundary.

## Rejected or historically owned candidates

- Repeated date validation is the completed Cycle 17 analysis-context root.
  Current projection preserves one strict proof per row, stable object
  identity/order, invalid-date quarantine, year rollover, and checked monthly
  totals. The remaining `dateRange()` copies/sorts are already owned by the
  older redundant-date-sort item.
- Category-label generation now crosses one structured `JSON.stringify`
  boundary, escapes JavaScript line separators, and retains existing alias,
  order, and duplicate-key `Map` semantics. No delimiter or consumer
  regression survived review.
- Comparing reward values across heterogeneous units is the completed Cycle 17
  root. Current selection and limiting stay inside exact kind-and-unit groups.
  Broader questions about conditions, cap-aware ranking, and legacy-field
  retirement are the existing ranking/design family rather than new roots.
- Parser duplication, optimizer complexity, shallow constraint copies,
  persistence threat model, CSP migration, PDF fallback catches, taxonomy
  duplication, card-detail cancellation, and broad generator extraction retain
  their existing deferred or completed owners.
- The new direct `iconv-lite` development ownership and production versus
  test/config manifest rules are coherent for every currently tracked
  workspace import. C18-CR-002 is limited to files excluded before that
  classification executes.

## Verification and final missed-issue sweep

- `git diff --check 8044347..HEAD`: passed.
- Current legacy artifact probe: five compact cards have more than five
  grouped reward entries; maximum is seven.
- Pre/post artifact identity comparison: all three changed legacy projections
  retained the exact same hash and `1.0.0` version.
- Current tracked module-extension inventory: no `.mts` or `.cts` files, so
  C18-CR-002 is a confirmed gate gap with dormant current-file impact.
- All 1,222 tracked review/plan paths were included in the history inventory;
  candidate-specific searches covered publication identity, legacy catalogs,
  versioning, dependency ownership, config/test admission, and module
  extensions.
- No full test, build, generator, browser, network, or process-owning command
  was run during this read-only specialist pass.
- Final status before report creation contained only the six protected
  untracked Cycle 42 paths.

Final count: two novel Low-severity findings, both High confidence.
