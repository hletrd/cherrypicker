# Cycle 4 — Code Reviewer / Critic / Architect

Review target: `555c56a633f988254854f4110ddf3e3a612c4eb9`

## Inventory and coverage

I built the review inventory from `git ls-files` before reading the implementation. The repository has 2,112 tracked files. I excluded 1,009 historical `.context/**` work products, the three vendored archive files, and `bun.lock`, leaving 1,099 non-historical, non-vendor, non-lock artifacts in the review universe:

| Area | Files |
| --- | ---: |
| `apps/web` | 139 |
| `packages/core` | 33 |
| `packages/parser` | 80 |
| `packages/rules` | 732 |
| `packages/viz` | 10 |
| `tools/cli` | 26 |
| `tools/scraper` | 32 |
| `scripts` | 18 |
| `e2e` | 14 |
| root/config/workflow/agent guidance | 15 |

This includes 181 production TypeScript/Svelte/Astro/JavaScript implementation files, 105 executable TypeScript/JavaScript test/spec files, 683 card YAML files, the taxonomy and issuer YAML files, 30 generated JSON catalog artifacts, fixtures, documentation, package manifests, TypeScript/Astro/Turbo configuration, and the deployment workflow. I manually traced the production modules and their cross-package call paths. The large declarative catalog and generated projections were covered through schema loading, catalog validation, publication byte checks, source/projection parity tests, and targeted queries rather than treating 150,000-line generated JSON as handwritten logic.

Cross-file flows examined included:

- upload admission → browser format detection → worker/direct parser → categorization → calendar scoping → optimizer → persistence → dashboard/report;
- CLI option parsing → local-first parsing → catalog loading → optimization → terminal/HTML output;
- YAML authoring → Zod normalization → catalog validation → publication identity/projections → browser and CLI readers;
- scraper argument/network policy → DNS pinning/redirect handling → LLM extraction validation → exclusive YAML output;
- operation epochs, file-run ownership, cancellation, navigation, worker protocols, and reload behavior.

## Findings

### C4-CCA-001 — A stale caller can invalidate newer work and synchronously delete the current analysis

- Severity: **Medium**
- Confidence: **High**
- Validation: **Confirmed**
- Lens: correctness, concurrency/state ownership, destructive-transition architecture
- Location: `apps/web/src/lib/analysis-replacement-runtime.ts:105-134`

`analyze()` calls `operationEpoch.begin()` at line 110 before it checks whether `execution.run` is already stale or aborted. It then sets loading/error state and clears storage and memory at lines 117-128. The first ownership check is only after `loadAnalyzerModule()` at line 134.

Confirmed scenario:

1. A caller obtains run A.
2. A newer run makes A stale (or A is canceled).
3. The stale caller invokes `runtime.analyze(..., { run: A })` after a current result has been committed.
4. `begin()` first aborts any newer store operation. `composeOwnedRun()` correctly produces an aborted owned run, but the method still deletes persisted state, nulls the current result, and increments the generation before observing that fact.

An executable probe with a current in-memory/persisted result and a pre-staled `LatestFileParseRun` ended with `result: null`, persisted storage deleted, generation incremented, and the analyzer module loaded. The existing tests at `apps/web/__tests__/analysis-replacement-runtime.test.ts:58-168` cover a current replacement and cancellation after replacement starts, but not a stale or pre-aborted caller.

Root fix: reject `execution.run` before acquiring/invalidation of the store epoch, then check the composed owned run immediately before any externally visible state or storage mutation. Add tests where the supplied run is pre-staled and pre-aborted, including a newer operation that must neither be aborted nor have its state cleared.

### C4-CCA-002 — Failed persisted-state deletion is treated as success, so a failed replacement can resurrect the old result on reload

- Severity: **Medium**
- Confidence: **High**
- Validation: **Confirmed**
- Lens: correctness, failure atomicity, persistence invariant
- Location: `apps/web/src/lib/analysis-replacement-runtime.ts:120-128,164-173`; `apps/web/src/lib/store.svelte.ts:131-139,152-164`

`clearPersistedAnalysis()` converts a failed `sessionStorage.removeItem()` into `{ kind: 'error' }`. `AnalysisReplacementRuntime.analyze()` records that warning but proceeds to null the in-memory result and run the replacement. If the replacement subsequently fails, the catch path leaves memory empty while the previous serialized record remains untouched. `loadFromStorage()` has no tombstone or replacement generation to distinguish that record, so a later reload accepts the old analysis as current.

This contradicts the method's stated invariant that storage and memory are replaced as one synchronous transition and that a failed replacement leaves both locations empty.

An executable dependency-injected probe used a clear operation that returned `kind: 'error'` without deleting the old serialized result, followed by an analyzer failure. The final memory state was null with the new error, while reloading the retained bytes restored the previous merchant/result.

The tests at `apps/web/__tests__/analysis-replacement-runtime.test.ts:58-108` prove the desired no-resurrection behavior only when `storage.delete()` succeeds; there is no failed-clear branch.

Root fix: make deletion a required precondition for destructive replacement. If it fails, do not clear memory and do not start/commit the new replacement; expose the storage error and preserve the last coherent result. Alternatively, introduce a durable generation/tombstone protocol, but a warning-only return value is not sufficient for a state-critical mutation. Test clear failure followed by analysis failure and an actual deserialize/reload.

### C4-CCA-003 — Prefix-only JSON sniffing misroutes valid CSV and disagrees with the server parser

- Severity: **Medium**
- Confidence: **High**
- Validation: **Confirmed**
- Lens: parser correctness, browser/server contract, duplicated control flow
- Location: `apps/web/src/lib/parser/detect.ts:107-138`; `packages/parser/src/detect.ts:208-300`; `packages/parser/src/statement.ts:47-88`

The browser detector treats any CSV/unknown-extension file whose trimmed first byte is `{` or `[` as JSON, without validating the complete document. The server detector either honors `.csv` directly or, for an unknown extension, validates the complete JSON bytes and falls back to CSV when parsing fails.

Confirmed supported-file scenario:

```text
{statement export}
date,merchant,amount
2026-07-23,Starbucks,5000
```

With the name `statement.csv`, the browser path selected JSON and returned zero transactions plus `json_syntax`; the server path selected CSV and returned the one valid transaction with no error. A brace-prefixed metadata line is accepted by the generic CSV header scan, so this is not merely malformed input.

The detection tests at `packages/parser/__tests__/web-detect-parity.test.ts:97-117` explicitly lock in classification of malformed leading-container text as JSON, but do not exercise a valid CSV body after such a preamble or assert end-to-end browser/server parity.

Root fix: use one isomorphic format-hint/finalization kernel. Preserve the intended ability to recognize valid JSON under a mismatched extension, but require complete JSON validation before committing to JSON and fall back to CSV when validation fails. Add end-to-end parity cases for brace/bracket-prefixed CSV preambles as well as long valid JSON.

### C4-CCA-004 — The new canonical reward value can describe 0% while the calculator executes a fixed reward

- Severity: **Medium**
- Confidence: **High**
- Validation: **Confirmed**
- Lens: domain invariant, single source of truth, publication architecture
- Location: `packages/rules/src/schema.ts:49-77,80-163`; `packages/core/src/calculator/reward.ts:545-590`; `scripts/build-json.ts:78-85,244-267`; `packages/rules/data/cards/lotte/loca-365.yaml:173-180`; `apps/web/public/data/cards.json:72347-72357`

The schema intentionally permits `rate: 0` with a positive `fixedAmount` because mutual exclusion only rejects a *positive* rate. The calculator follows that convention: it skips the zero-rate branch and pays the fixed amount. However, `deriveRewardValue()` prioritizes every non-null rate, including zero, and serializes the same tier as `{ kind: 'percentage', amount: 0 }`. The publication index likewise uses `tier.rate ?? tier.fixedAmount`, so zero masks the fixed value and is labeled as a rate.

The checked-in LOCA 365 tier currently demonstrates the contradictory artifact: `rate: 0`, `fixedAmount: 1500`, but canonical `value` is `percentage: 0`. That particular rule is marked unsupported, so it does not currently enter the ranking index. The contract still accepts the same shape for supported rules. A probe that changed only that rule's support status produced a schema value of 0% while `calculateRewards()` paid 1,500 won.

The explicit acceptance test at `packages/rules/__tests__/schema.test.ts:291-298` asserts only that `fixedAmount` survives; it does not assert the derived discriminant or parity with calculator behavior.

Root fix: canonicalize a zero `rate` to null when a positive fixed reward is present, or have every projection branch on the same precedence rule as the calculator. Then make the discriminated `value` the sole downstream representation used by the calculator and publication index, rather than maintaining three independently interpreted fields. Migrate LOCA 365 and add a schema → artifact → calculator contract test for this legacy shape.

### C4-CCA-005 — The web OFX parser retains invalid-date transactions that the server parser rejects

- Severity: **Low**
- Confidence: **High**
- Validation: **Confirmed**
- Lens: parser parity, maintainability
- Location: `apps/web/src/lib/parser/ofx.ts:127-163`; `packages/parser/src/ofx/index.ts:168-210`

Both parsers report an invalid `DTPOSTED`, but only the server path executes `continue`. The browser path goes on to construct and return a spending transaction with the invalid date.

For an OFX debit with `DTPOSTED=INVALID` and `TRNAMT=-10000`, the browser returned one transaction (`date: "INVALID"`) plus an error; the server returned zero transactions plus the same error. The later web analysis context quarantines that row from optimization, which limits reward impact, but the row remains in the persisted/review transaction list, produces mismatched displayed versus valid transaction counts, and cannot have its date repaired in the current review table.

The server regression exists at `packages/parser/__tests__/ofx.test.ts:225-235`; the web edge-case suite at `apps/web/__tests__/parser-ofx.test.ts:113-224` omits the equivalent case.

Root fix: move OFX parsing to a shared browser-safe kernel. As an immediate correction, mirror the server's `continue` and add one parity test that executes both adapters over the same invalid-date fixture.

## Whole-change critique

Three design seams account for all five findings:

1. `AnalysisReplacementRuntime` models a state-critical deletion as a warning-producing best-effort side effect. Its comments promise an atomic memory/storage transition, but neither caller ownership nor deletion success is a precondition for mutation.
2. Browser and server parsing still duplicate format routing and OFX row control flow. The repository already shares lower-level parsing helpers, yet the remaining orchestration duplication allowed both a classification regression and a missing `continue` to survive a green test suite.
3. The reward migration added a discriminated canonical `value` without retiring the nullable `rate`/`fixedAmount` interpretation paths. Schema, calculator, index builder, and presentation therefore retain independent precedence rules.

The durable fixes are boundary changes—transactional replacement ownership, one parser kernel, and one reward representation—not more comments around parallel implementations.

## Verification performed

- `bun run test` — passed: all 11 Turbo package tasks and all script tests.
- Targeted 179-test run across replacement runtime, browser detection, browser/server OFX, rules schema, and core calculator — passed; the missing cases were then reproduced separately.
- `bun run typecheck` — passed for all seven workspaces; Astro reported 0 errors, warnings, or hints.
- `bun run data:check` — passed for 683 cards across 24 issuers, all generated projections, and README indexes.
- `bun run dependencies:check` — passed.
- Targeted executable probes confirmed every finding above.

## Commonly missed issues sweep

I separately checked stale commits and cancellation after every await, worker failure settlement, file-count/byte limits, safe-integer and non-finite numeric boundaries, calendar-month isolation, reward/cap/occurrence ordering, catalog hash/projection agreement, malformed persisted graphs, filesystem symlink and overwrite races, terminal and HTML escaping, scraper SSRF/redirect/DNS rebinding controls, dependency declarations/integrity, action pinning, accessibility-sensitive focus/navigation state, and documentation/format aliases. No additional reportable defect remained after excluding already-fixed Cycle 1–3 findings and speculative issues without a reproducible failure.

## Explicit coverage statement

Every review-relevant tracked source, configuration, documentation, and test file was inventoried. Handwritten implementation and boundary tests were inspected directly; the complete declarative card catalog and generated artifacts were exercised through their canonical loaders, validators, builders, parity checks, and focused data queries. Generated/vendor/dependency and historical review artifacts were excluded as described above. No source, plan, or pre-existing dirty artifact was modified by this review.
