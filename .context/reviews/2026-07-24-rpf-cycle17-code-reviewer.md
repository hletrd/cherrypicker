# Review-plan-fix Cycle 17 — code reviewer

## Review identity

- Date: 2026-07-24
- Revision: `857e12a794e585560a0c447b0a1619def02cbcf3`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Role: code quality, logic, SOLID, and maintainability
- Disposition: one genuinely new finding
- Finding count: one Low, High confidence
- Scope: review and this report only; no production, test, generated, or
  configuration file was changed

## Inventory and coverage

The exact Git tree contains 2,374 tracked paths. I classified every path before
reviewing the executable and authored-data surfaces: 1,204 tracked review/plan
records and 1,170 active source, test, data, documentation, configuration,
workflow, and vendor-integrity paths.

| Surface | Tracked paths | Review coverage |
| --- | ---: | --- |
| `apps/web` | 172, including 80 `src` code/style/template files and 57 test files | Upload admission, all browser parsers and workers, analysis/optimization cancellation, catalog loading, persistence/reoptimization, card navigation, and dashboard/report consumers. |
| `packages/core` | 47, including 26 source and 19 test files | Analysis context/performance, categorization and keyword overrides, numeric helpers, rule selection, reward/cap state, and greedy/counterfactual optimization. |
| `packages/parser` | 86, including 35 source and 49 test files | Server/browser-safe detection and decoding plus CSV, XLSX/HTML, PDF, JSON, and OFX adapters and their shared amount/date/diagnostic/archive/sheet kernels. |
| `packages/rules` | 734, including 14 source files, 683 authored YAML card records, and 7 test files | Schema, loaders, category registry, semantic/catalog validation, optimizer publication, and the authored-data corpus through schema/generator contracts and aggregate checks. |
| `packages/viz` | 14, including 9 source and 3 test files | Spending aggregation, terminal sanitization/disclosures, standalone report escaping, CSP template replacement, and output presentation. |
| `tools/cli` | 28, including 16 source and 10 test files | Argument and path validation, calendar scoping, catalog mode selection, consent, report generation, and atomic output. |
| `tools/scraper` | 35, including 12 source and 11 test files | Argument/runtime configuration, network pinning and redirect policy, bounded fetch, untrusted LLM input/output quarantine, semantic validation, and safe output. |
| Scripts, E2E, and root policy | 19 scripts, 16 E2E paths, root manifests/config, and one workflow | Catalog/docs publication, dependency/toolchain/bundle checks, E2E process ownership, migration scripts, package contracts, and CI routing. |

The 180 tracked test files contain 3,502 `describe`/`test`/`it` declarations.
Their names and contracts were checked against the reviewed production paths.
Generated JSON/public assets were traced to their generators and readers rather
than treated as handwritten code. The three vendored archives were treated as
integrity-controlled dependencies rather than reviewed source.

The current Cycle 16 change was reviewed end to end: Plan 143, the Cycle 16
review set, the shared worksheet metadata validator, server and browser
XLSX/HTML call sites, exports, and the focused regression file. Its validation
order, checked totals, bounded merge index, and error mapping are internally
consistent; no new Cycle 16 regression was retained.

## Retained finding

### C17-CR-001 — legacy catalog rankings compare heterogeneous reward units as one scalar

- Severity: Low
- Confidence: High
- Status: confirmed by source tracing and a bounded read-only artifact probe
- Tier selection helper: `scripts/build-json.ts:79-86`
- Category index construction and ordering: `scripts/build-json.ts:248-271`
- Compact `topRewards` selection and truncation:
  `scripts/build-json.ts:373-404`
- Available canonical discriminant:
  `scripts/catalog-publication.ts:179-187`

`publicationRewardIndexValue()` correctly preserves whether a canonical tier
is a percentage or a fixed reward, and the generated rows also carry a unit.
`build-json.ts` then discards that distinction for ordering: `pickBestTier()`
compares only `value.amount`, each category list sorts only by
`rewardValue`, and each card's `topRewards` sorts only by `bestValue` before
truncating to five entries.

Those raw numbers are not comparable. A percentage point, won per transaction,
won per day, miles per spending block, and won per liter have different units
and require transaction amount, facts, performance tier, conditions, usage,
and caps before they can be ranked.

The current checked-in artifact demonstrates that this is active rather than
theoretical. Fourteen category indexes contain mixed `rewardValueKind` values.
For example, the `dining` list starts with fixed values 5,000, 4,000, and 2,000,
then percentage values of 60 because the generator compares `5000 > 60`.
For a 10,000-won purchase, 60% is 6,000 won and would exceed the first fixed
value; at a smaller purchase the relationship reverses. There is no
context-free correct ordering. The same scalar comparison can cause a compact
card's five-entry truncation to omit a percentage or unit reward merely because
its authored number is smaller than a won amount.

The active browser optimizer does not consume these legacy rankings; it loads
the validated optimizer artifact and evaluates rewards through the calculator.
That limits current in-application impact. The invalid ordering nevertheless
remains in the generated `packages/rules/data/cards.json`,
`packages/rules/data/cards-compact.json`, and public legacy catalog, where the
field names and ordering imply a ranking to downstream readers.

Recommended fix:

1. Decide whether the legacy category and compact top-reward indexes still have
   supported consumers. If not, remove the ranking fields rather than
   publishing misleading derived data.
2. If retained, group entries by the canonical value kind and unit, sort only
   within homogeneous groups, and do not truncate across incomparable groups.
   Any cross-kind ranking must call the normal calculator with an explicit
   transaction/performance scenario and disclose that scenario.
3. Extract the index projection into a side-effect-free helper and add a
   generator regression with percentage, fixed-per-transaction,
   fixed-per-day, mileage, and fuel values.

## Novelty and rejected duplicates

All 1,204 tracked current and archived `.context` records were indexed: 890
review records and 314 plans, including 10,075 headings and 7,349
finding/issue/status fields. Candidate-specific searches covered the exact
functions and fields above plus broader combinations of reward ranking,
percentage/fixed values, comparison, compact catalogs, and category indexes.

Two broad history hits discuss the older `rate: 0` plus `fixedAmount` canonical
discriminant defect and calculator precedence. Plan 84 completed that work.
This finding is different: the current code now derives the canonical
discriminant correctly and then compares already-distinct units as one raw
scalar. No tracked review, plan, deferred item, or rejection owns the current
sort/truncation root. D-03's old `cards-compact.json` freshness concern is also
different from the semantic ordering defect.

Other candidates were rejected as historical or non-defects, including:

- the owned D-01 browser/server parser duplication and prior parity findings;
- bare subcategory-label collisions and dot-notation label work;
- the documented session-storage plaintext threat model and persistence
  recovery items;
- the acknowledged CSP nonce migration;
- PDF fallback behavior and prior format-specific parser edge cases; and
- Cycle 16 worksheet/archive/merge metadata limits, now implemented.

No second new finding survived exact-source tracing, a concrete scenario, and
the full history comparison.

## Verification and closing sweep

- Read-only artifact probe: 14 current category indexes contain both
  `rate` and `fixedAmount` rows; the `dining` ordering reproduced the raw
  numeric comparison described above.
- Candidate-specific tracked-history search: no owner for
  `pickBestTier`, `byCategoryIndex`, `rewardValueKind`, `bestValueKind`, or
  heterogeneous reward-unit ranking.
- `git diff 4b1f368..857e12a --check`: passed for the Cycle 16 implementation.
- No full repository gates were run during this read-only review.
- The six protected untracked Cycle 42 artifacts were not edited, staged, or
  removed.

Final count: one new Low finding, High confidence.
