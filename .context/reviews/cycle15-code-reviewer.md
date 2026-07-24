# Cycle 15 — Code Reviewer

## Review identity and disposition

- **Reviewed revision:** `4b1f368d6b8b92cf009ba18d93639f841a8b5d06`
- **Branch:** `codex/review-plan-fix-no-deploy-20260723`
- **Date:** 2026-07-24
- **Lens:** logic, correctness, SOLID boundaries, maintainability, edge cases,
  invariants, error handling, data flow, state ownership, and races
- **Disposition:** **0 genuinely new current-HEAD findings**
- **Finding count:** 0 Critical, 0 High, 0 Medium, 0 Low
- **Confidence:** High
- **Manual validation required:** None

This was a review-only pass. I did not change product source, tests, generated
artifacts, dependencies, workflows, plans, documentation, commits, branches,
deployment state, or external systems. The only file written by this lane is
this provenance report.

## Complete inventory

I built the inventory from the exact Git tree before reviewing code. HEAD
contains **2,354 tracked files**:

| Family | Files | Review treatment |
| --- | ---: | --- |
| `.context` reviews and plans | 1,185 | All 872 review paths and 313 plan paths, including 215 archived plans, were path/topic inventoried and searched for ownership, duplication, rejection, and deferral |
| `packages` | 881 | Core calculation/optimization, parser kernels, rule schemas and publication, visualization, tests, configs, generated catalog data, and package boundaries |
| `apps` | 171 | Web parsing, workers, analysis, validation, persistence, stores, UI consumers, tests, Astro pages/config, public scripts, and generated browser artifacts |
| `tools` | 63 | CLI parse/analyze/optimize/report flow and scraper fetch/extract/validate/write flow, with tests and configs |
| `scripts` | 19 | Toolchain, migration, dependency/peer, catalog publication, documentation, bundle, and E2E-process gates |
| `e2e` | 16 | Browser contract, security, accessibility, report, worker, and visual-regression specifications |
| Root/workflow/instructions/vendor/other | 19 | Root configuration, lockfile, README/license, workflow, agent rules, vendored integrity, and fixtures |

The tree has **359 TypeScript/JavaScript/Svelte/Astro paths**, **204 executable
implementation paths**, and **179 test/E2E paths** across all tracked formats.
It also has 685 YAML files, including the complete 683-card authored catalog.
Declarative catalog entries were checked as a whole through schema, semantic,
publication, freshness, optimizer-artifact, generated-shard, and README gates
rather than sampled.

The sorted exact-HEAD manifest SHA-256 is
`9e060303ffa4a07a2c264d3c8462417b2861ea6362a491dbcf975f7777748166`.
Excluding `.context`, it is
`8d03ca399a2ddd9f1a237a1e7665f4e1a6b0e55a290c64858aaceef76acd7c91`.

Repository policy and product contracts were read from `.claude/AGENTS.md`,
`.claude/CLAUDE.md`, `.context/reviews/instructions.md`, `README.md`, root and
workspace manifests/configs, and the deployment workflow. The review kept the
six protected untracked Cycle 42 artifacts outside the exact-HEAD inventory
and byte-identical; their final hashes are recorded below.

## Review coverage and cross-file traces

The immediately preceding complete code-review baseline was
`5260bbd9b6f44ff35cf1bb9a11819354003e5161`. The current source delta is
bounded and auditable:

| Current-HEAD source path | Delta | Review focus |
| --- | ---: | --- |
| `packages/core/src/calculator/reward.ts` | +41 / -6 | Prepared-card facts, proof validation, stateless gate, row-local counterfactual selection, exact actual-state preservation |
| `packages/core/src/calculator/types.ts` | +5 / -1 | Public completeness semantics |
| `packages/core/src/optimizer/greedy.ts` | +7 / -0 | Sole production proof authority and monotonic completeness ownership |
| `packages/core/__tests__/cycle14-reconciled-stateless-cap-prefix.test.ts` | +358 / -0 | Operation counts, invalid claims, stateful controls, unsafe direct-call controls, optimizer knownness |

No product source changed after signed implementation commit `5edff67`; the
remaining commits through reviewed HEAD close plans and review records.
Unchanged implementation was still included in the full manifest, policy,
static-pattern, public-export, package-direction, test-name, generated-data,
and gate sweeps. The prior baseline review was also reconciled instead of
assuming its comments or tests were correct.

The primary current-delta trace was:

1. `prepareCardRuleForCalculation()` derives `hasRewardCap` and
   `hasStatefulReward` from executable rules at
   `packages/core/src/calculator/reward.ts:128-190`.
2. Only `scoreCardsForTransaction()` supplies the new proof, and only when the
   live monotonic portfolio-completeness latch still enables cap collection,
   at `packages/core/src/optimizer/greedy.ts:228-270,640-682`.
3. `calculateRewardsWithPreparedCard()` defaults the proof off, rejects a
   collection-disabled claim, requires the exact appended-row boundary, and
   independently gates the optimization on the branded prepared card being
   stateless at `packages/core/src/calculator/reward.ts:1126-1200`.
4. The kernel suppresses counterfactual work only for rows strictly before the
   append boundary at
   `packages/core/src/calculator/reward.ts:1256-1265,1293-1312,1517-1528,1563-1608`.
   Actual rule matching, cap consumption, reward totals, diagnostics, and the
   appended row continue through their ordinary paths.
5. Stateful `maxUses` and fixed-per-day histories retain full ordered
   counterfactual replay. Once any card makes portfolio telemetry unknown,
   `portfolioCapLossesComplete` never returns to true during that optimization.
6. The prepared calculator and proof option remain absent from both public
   package barrels and the package export map. Only the public validated
   calculator and typed outputs cross the consumer boundary.
7. The resulting optimizer output was traced through the browser worker
   decoder, analysis coherence validator, persistence projection/migration,
   dashboard/results/report disclosures, CLI output, and standalone report
   generators. The optimization changes no serialized or public shape.

The whole-repository interaction sweep also covered:

- statement bytes → bounded format/encoding detection → selected parser →
  normalized transaction facts → categorization → calendar/performance basis;
- card YAML → Zod and semantic validation → optimizer publication artifact →
  web/CLI loaders → prepared calculator → greedy allocation;
- per-transaction, rule/shared monthly, and card-global caps → rollback →
  suppression causes → portfolio-loss reconciliation and knownness;
- optimizer result → worker settlement → analysis replacement/reset epochs →
  persistence → every presentation sink;
- upload/parser/optimizer cancellation, listener cleanup, stale-operation
  rejection, and module cache/abort-controller ownership;
- scraper target/host policy → bounded fetch → untrusted model extraction →
  quarantine → schema/semantic checks → no-clobber or atomic writer;
- dependency declarations and lock peers → audit → builds/bundle budgets →
  generated catalog/docs → read-only PR verification and Pages publication.

## Findings

**None.** No candidate survived exact-HEAD reproduction, invariant tracing,
cross-file validation, and complete historical deduplication. There is
therefore no retained file/line, severity, confidence, validation status,
failure scenario, or suggested-fix entry for this lane.

## Executable evidence

- Focused current-delta matrix:
  `cycle14-reconciled-stateless-cap-prefix`,
  `cycle13-cap-loss-telemetry`, `cycle13-prepared-cap-validation`, and
  `optimizer` — **80 passed, 0 failed, 267 expectations**.
- Deterministic randomized stateless append differential — **20,000 generated
  cards**, **100,013 proof-eligible ordinary-versus-claimed replay
  comparisons**, zero JSON or knownness mismatches. An additional 209 replay
  points correctly stayed outside the proof after prior completeness became
  false.
- `bun run verify` — **PASS**:
  - exact Bun 1.3.12 toolchain and domain migration;
  - dependency/import/locked-peer policy and `bun audit` with no
    vulnerabilities;
  - all 683 authored cards, 24 issuers, 551 optimizer-executable cards,
    generated JSON/shards/fallback labels, and README catalog;
  - every workspace lint and typecheck; Astro reported 0 errors, 0 warnings,
    and 0 hints across 125 files;
  - all 12 workspace test tasks and all 83 script tests with 997 assertions;
  - five-page Astro production build and browser bundle/artifact budgets.
- `git diff --check HEAD` and the complete baseline-to-HEAD delta — **PASS**.

## Historical duplicates and rejected candidates — excluded

The following items are explicitly **excluded from the new-finding count**:

1. **EXCLUDED — fixed historical C14-001 / Plan 141.** The old stateless
   prefix counterfactual replay is the behavior fixed by the current delta.
   The optimizer-owned proof, exact append boundary, default-safe internal
   API, callee-owned stateless gate, stateful controls, operation-count
   regression, and 100,013 new differential comparisons all pass. Re-reporting
   the former cost would duplicate a completed plan.
2. **EXCLUDED — fixed historical C14-002 / Plan 142.** The public comment at
   `packages/core/src/calculator/types.ts:76-81` now describes the stable
   consequence: a false completeness bit makes the diagnostic partial and
   non-authoritative even when rows remain. It no longer claims overflow is
   the sole cause.
3. **EXCLUDED — rejected unsafe proof variants.** Inferring proof from
   `capSuppressionStartIndex`, statelessness, or collection alone remains
   unsafe for arbitrary prepared calls. Current code uses a separate
   optimizer-only claim, validates the append boundary and collection, and
   defaults ordinary/direct callers to full replay. No production call site
   can enable the optimization independently.
4. **EXCLUDED — intentional fail-closed stateful knownness.** Returning
   `portfolioCapLosses: undefined` after ordered negative offsets or
   cross-card/unassigned stateful ambiguity is the completed Plan 138
   contract, not a missing result or regression. The new optimization does not
   skip stateful history.
5. **EXCLUDED — duplicate known optimizer architecture debt.** Replaying
   assigned history in the greedy scorer remains the previously documented
   incremental-optimizer work (`D-C1-040`, `D-09`, `D-C10-02`,
   `C20-PERF01`). Plan 141 removes only the later separable stateless
   counterfactual prefix. No new reproducible regression or distinct failure
   mode was found.
6. **EXCLUDED — explicitly rejected prefixed/leading-NUL XLSX hypothesis.**
   There is no new reproducible evidence. ZIP metadata admission still
   requires `PK` at byte zero in
   `packages/parser/src/shared/xlsx-archive.ts:113-130`; both server and browser
   parsers invoke that preflight before SheetJS archive parsing. This review
   does not resurrect the historically corrected and rejected inflation
   claim.
7. **EXCLUDED — protected Cycle 42 material.** The six untracked files are not
   part of exact current HEAD and were neither staged nor edited. Their
   presence does not establish a current-tree finding.

## Final missed-issues sweep

The closing pass revisited every changed line and then the complete executable
inventory for:

- empty and one-row inputs, start indexes at/beyond bounds, disabled
  collection, cards with no cap, zero caps, unsupported rules, and tier
  mismatch;
- safe-integer arithmetic, partial suppression arrays, monotonic unknown
  propagation, same-card fallback, duplicate transaction occurrences, and
  deterministic ordering;
- `maxUses`, fixed-per-day, global/rule/per-transaction cap histories,
  counterfactual reservations, final stateful replay, and public/direct-call
  defaults;
- mutation/race ownership, synchronous prepared-rule lifetime, worker abort
  and terminal settlement, stale analysis epochs, cache resets, and
  persistence coherence;
- parser byte/encoding/format bounds, required-field handling, diagnostic
  limits, XLSX preflight routing, PDF lifecycle, and server/browser parity;
- catalog schema/semantics, source provenance, card availability, generated
  artifact identity, scraper trust/write boundaries, CLI filesystem
  boundaries, report sinks, dependency peers, workflow permissions, and
  documentation claims.

No skipped file, cross-file interaction, error path, state transition, or
historical candidate produced a genuinely new current-HEAD defect.

## Protected artifact integrity

```text
596dc91904a642bbfe5a5f5c338025023a1e5d0c2c92d9842353233c4fc0ac7a  .context/plans/67-high-priority-cycle42.md
272a70771bc14dbe131a8aef65907402c5f07f12fc0c798d535a5ef4a67ee4d1  .context/reviews/cycle42-aggregate.md
1dbdd1bdf8e2d672075e73e34b5b2043b33f74a36b938085b8efeafd03f03266  .context/reviews/cycle42-code-reviewer.md
6c6aa0d14a9129109341ac285de900bff8af8c38425a03f09e012206266c3df0  .context/reviews/cycle42-debugger.md
c7909307ce1387d617e9d7f51180a6eb8d7b12e1bfffe30bf5fe5dafdbd9a6a5  .context/reviews/cycle42-security-reviewer.md
c3fbf7a4ec5628902bce36af73f9d7c6b223c82e6d1360bac44e80d7612a3e9f  .context/reviews/cycle42-test-engineer.md
```
