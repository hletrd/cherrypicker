# Review-plan-fix Cycle 14 — verifier

- Date: 2026-07-24
- Reviewed revision: `5260bbd9b6f44ff35cf1bb9a11819354003e5161`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Disposition: **1 genuinely new finding — 1 Medium**
- Scope: independent verification and this report only; no source, test, plan,
  generated-artifact, commit, push, deployment, preview-server, or E2E change

## Repository inventory and verification basis

I pinned every behavioral and historical check to the exact revision above.
The repository has **2,337 tracked paths**: **1,169** tracked `.context` paths
and **1,168** active product, data, test, documentation, workflow,
configuration, and vendor-integrity paths. The Cycle 13 review baseline
`3e2d663` differs by 55 paths: 28 active paths and 27 review/plan paths.

The active-tree sweep traced the changed calculator and optimizer contracts
through their worker, analysis, persistence, browser, terminal, standalone
report, dependency, catalog, and test consumers. It also revisited the
unchanged parser, CLI, scraper, visualization, workflow, migration, and build
boundaries. The full tracked worktree matched `HEAD` before this report; its
sorted working-file SHA-256 manifest digest was
`abc844d5b431b372be02130c9dee0329e8e0b6410ad7c2c1f7bf5fb5fe6cb899`.

## Finding

### C14-VER-001 / RPF14-PERF-001 — append scoring repeats the cap-free history of already reconciled stateless rows

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed at the reviewed revision
- **Kind:** Performance; current production results remain correct
- **Primary files and lines:**
  - `packages/core/src/optimizer/greedy.ts:244-264`
  - `packages/core/src/optimizer/greedy.ts:630-675`
  - `packages/core/src/calculator/reward.ts:137-189`
  - `packages/core/src/calculator/reward.ts:677-935`
  - `packages/core/src/calculator/reward.ts:1127-1179`
  - `packages/core/src/calculator/reward.ts:1227-1277`
  - `packages/core/src/calculator/reward.ts:1528-1627`

#### Reproduction scenario

For every card candidate and transaction, `scoreCardsForTransaction()` first
replays the card's assigned history without telemetry, then replays that
history plus the candidate transaction. When portfolio telemetry remains
known and the prepared rule has a cap, the second replay sets
`capSuppressionStartIndex` to the old history length
(`greedy.ts:244-264`).

The calculator uses that index only to decide whether to **emit** a suppression
row (`reward.ts:1227-1230`). It still passes the unchanged
`collectCapSuppressions` flag into `findRules()` for every older transaction
(`reward.ts:1258-1277`). Those old rows therefore still:

1. construct cap-free rule candidates and group maps;
2. copy counterfactual occurrence/day state;
3. sort and project cap-free candidates; and
4. allocate reservations and reconcile completeness
   (`reward.ts:677-935,1528-1627`).

That work is required for `maxUses` and fixed-per-day rules because their
ordered counterfactual histories affect later eligibility. It is not required
for an already reconciled prefix when `PreparedCardRule.hasStatefulReward` is
false. Every assigned prefix row was evaluated as the appended row when it was
first encountered, and `portfolioCapLossesComplete` latches any unknown result
monotonically (`greedy.ts:630-675`). A stateless cap-free selection carries no
eligibility reservation from an old row into the appended row.

The real optimizer input used by the independent probe contained 682 rule
objects: 551 optimizer-executable cards, 383 capped cards, and only two
stateful capped cards (`shinhan-b-big` and `shinhan-bom`). Thus this redundant
body applies to 381 capped stateless cards in that input. The repository data
gate separately confirms 683 authored cards and 551 optimizer-executable
cards.

#### Deterministic operation counts

I made two temporary copies from `git archive` of the exact reviewed revision.
Both copies had identical counters added around the counterfactual body. In the
comparison copy only, old counterfactual rows were bypassed for a stateless
prepared rule; actual reward replay, every appended row, and every stateful
history remained intact. No repository file was changed by this experiment.

The workload used the full real optimizer input, previous spending of
1,000,000 Won, and a deterministic repeating mix of 12 canonical spending
categories.

| Transactions | Counter | Current HEAD | Comparison | Avoided |
| ---: | --- | ---: | ---: | ---: |
| 100 | counterfactual rows | 42,376 | 38,300 | 4,076 |
| 100 | group maps | 14,393 | 10,317 | 4,076 |
| 100 | copied counterfactual Map/Sets | 28,786 | 20,634 | 8,152 |
| 100 | rule projections | 14,429 | 10,353 | 4,076 |
| 100 | reconciliation rows | 42,376 | 38,300 | 4,076 |
| 500 | counterfactual rows | 289,967 | 191,500 | 98,467 |
| 500 | group maps | 149,512 | 51,045 | 98,467 |
| 500 | copied counterfactual Map/Sets | 299,024 | 102,090 | 196,934 |
| 500 | rule projections | 149,680 | 51,213 | 98,467 |
| 500 | reconciliation rows | 289,967 | 191,500 | 98,467 |
| 1,000 | counterfactual rows | 706,636 | 384,247 | 322,389 |
| 1,000 | group maps | 425,654 | 103,265 | 322,389 |
| 1,000 | copied counterfactual Map/Sets | 851,308 | 206,530 | 644,778 |
| 1,000 | rule projections | 425,990 | 103,601 | 322,389 |
| 1,000 | reconciliation rows | 706,636 | 384,247 | 322,389 |

At 1,000 transactions this removes at least 967,167 directly counted
Map/Set allocations before counting projection, reservation, sort, and
reconciliation objects.

#### Exact output, knownness, and timing parity

The complete optimizer JSON, including assignments, totals, cap losses, and
the distinction between a known array and `undefined`, was byte-for-byte
equivalent in each deterministic comparison.

| Transactions | Total reward | Loss rows | Known? | Output SHA-256 |
| ---: | ---: | ---: | --- | --- |
| 100 | 1,451,600 | 71 | yes | `c723851398a50f5dbe30778ef45943d5d0420c14ab7567d89417596fbef1475b` |
| 500 | 6,624,750 | 384 | yes | `3f77b5a6e2e85f13d8191ac34b67eb4fa04e76ec1e1247b5aa29954223e04da0` |
| 1,000 | 12,846,500 | 773 | yes | `d7fa72faf08d5f8021be1432579118922998defd84dbcca45a78d09b7cedc3a7` |

Alternating instrumented samples were deliberately treated as supporting
evidence rather than as a release benchmark. At 100 transactions the
222.34 ms current median versus 224.07 ms comparison median was noise. At 500
transactions, five alternating samples measured 1,510.840 ms versus
1,475.416 ms, a 35.425 ms or 2.345% median reduction. At 1,000 transactions,
three alternating samples measured 4,024.557 ms versus 3,890.073 ms, a
134.485 ms or 3.342% median reduction. The deterministic operation counts,
not these host-sensitive timings, establish the defect.

#### Stateful and stateless safety

Direct 30-row prepared-rule probes independently separated the three relevant
rule shapes. Counter columns below are, in order: counterfactual rows, group
maps, copied state, projections, and reconciliation rows.

| Rule shape | Current counters | Comparison counters | Complete output parity |
| --- | --- | --- | --- |
| Stateless capped | `30 / 30 / 60 / 30 / 30` | `1 / 1 / 2 / 1 / 1` | exact |
| `maxUses` | `30 / 1 / 2 / 1 / 30` | `30 / 1 / 2 / 1 / 30` | exact |
| fixed-per-day | `30 / 30 / 60 / 30 / 30` | `30 / 30 / 60 / 30 / 30` | exact |

A separate real-card probe kept only `shinhan-b-big` and `shinhan-bom` and
optimized 90 public-transit rows. Both copies executed exactly
`560 / 560 / 1,120 / 560 / 560` counter operations, returned a total reward
of 22,570, retained `portfolioCapLosses: undefined`, and produced identical
full optimizer JSON. This confirms that the proposed boundary must retain the
complete stateful history.

I also ran 10,000 deterministic randomized comparisons:

- all 10,000 full optimizer outputs were exact, including 1,896 known and
  8,104 unknown telemetry outcomes;
- all 10,000 direct `maxUses` and all 10,000 direct fixed-per-day prepared
  results were exact;
- a deliberately naive stateless gate changed only
  `capSuppressionsComplete` in 7 of 10,000 direct internal prepared calls.

The last result is a required safety constraint, not a second production
finding. `capSuppressionStartIndex` alone proves only an emission boundary.
An arbitrary direct internal caller can supply a nonzero start without having
previously reconciled its prefix. An old stateless row can make completeness
false because its cap-free reward is below the actual fallback or because
counterfactual arithmetic is unsafe. Skipping such a prefix without a proof
would incorrectly turn `false` into `true`. Current HEAD does not perform that
unsafe skip and is correct.

#### Safe fix

1. Add a private, default-off optimizer replay policy or proof, preferably a
   discriminated option such as
   `{ kind: 'optimizer-reconciled-prefix', startIndex }`. Do not reinterpret
   the existing `capSuppressionStartIndex` as that proof.
2. Let only `scoreCardsForTransaction()` supply the proof while
   `portfolioCapLossesComplete` is still true. Its monotonic state establishes
   that every older assigned row was already checked.
3. Inside the prepared calculator, bypass counterfactual candidate
   construction and completeness reconciliation only when all three are true:
   the optimizer proof is present, the row is before its start index, and
   `preparedCardRule.hasStatefulReward === false`.
4. Leave actual selection and cap replay unchanged. Keep the appended row,
   every stateful row, public calculation, and ordinary direct prepared calls
   on the full path.
5. Add operation-count tests for zero stateless pre-start work and unchanged
   `maxUses`/fixed-per-day work; retain an unsafe direct-prefix fixture whose
   completeness must remain false; compare full optimizer output and knownness
   on the real catalog and deterministic randomized inputs.

## Producer-to-consumer contract verification

The performance change is local to producer computation and must preserve the
existing output exactly:

1. Preparation classifies capped and stateful executable reward structures at
   `reward.ts:137-189`.
2. Append scoring converts calculator completeness and the emitted current-row
   suppression into card scores at `greedy.ts:286-302`.
3. The optimizer monotonically reconciles, deduplicates, orders, and returns
   known losses or `undefined` at `greedy.ts:630-675,832-887,959-972`.
4. `OptimizationResult` documents `undefined` as unknown rather than no loss
   at `packages/core/src/models/result.ts:95-114`.
5. The browser worker validates the full result and nested loss telemetry at
   `apps/web/src/lib/optimizer/worker-protocol.ts:307-323`.
6. Analysis checks loss arithmetic, identity, assignment, and transaction
   coherence at `apps/web/src/lib/analysis-result.ts:393-430,869-890`.
7. Persistence validates the same optional telemetry boundary at
   `apps/web/src/lib/persistence.ts:743-760`.
8. Browser and terminal consumers render only present loss rows at
   `apps/web/src/components/ui/CapDisclosures.svelte:19-49` and
   `packages/viz/src/terminal/comparison.ts:80-92`.

The independent full-output comparisons establish that the safe optimization
does not alter any of these consumers. The focused eight-file contract suite
also passed **306 tests, 0 failures, and 1,013 expectations**, covering
calculator telemetry, prepared validation, worker decoding, analysis
coherence, persistence, browser disclosure wiring, terminal/report rendering,
and dependency policy.

## Historical novelty and ownership

I searched the 1,175 pre-Cycle-14 historical artifacts available at the start
of this verification: 1,169 tracked `.context` files plus the six protected
Cycle 42 artifacts.

- `git blame` assigns the prepared-card wrapper itself to Plan 139 commit
  `4fa1385`, but assigns `collectCapSuppressions`,
  `capSuppressionStartIndex`, the dual counterfactual replay, and the optimizer
  append telemetry call to the later telemetry commit `d7ffac3`.
- Plan 139 / `RPF13-PERF-001` removed repeated immutable rule-structure
  validation. Its baseline measured 125,075 calculator calls and 451,946
  validation maps, with a 267.6 ms versus 221.8 ms 100-row comparison and an
  18–20% completed-plan improvement against the Cycle 12 baseline. It does not
  measure or own the cap-free transaction body introduced afterward.
- Plan 138 owns correct ordered counterfactual semantics, including full
  `maxUses` and fixed-per-day history and fail-closed knownness. The retained
  finding preserves those histories.
- Deferred `D-C1-040`, `D-C10-02`, and `C20-PERF01` own the older greedy
  optimizer's full actual-history replay and eventual incremental redesign.
  This finding does not remove that replay or reduce the calculator-call
  multiplier. It removes only the later, independently avoidable stateless
  counterfactual body from prefixes already proven complete.

No historical owner for this narrower `capSuppressionStartIndex`/stateless
prefix cost was found. The finding is therefore genuinely new rather than a
relabeling of Plan 139 or the deferred optimizer redesign.

## Rejected and non-finding candidates

| Candidate | Adjudication |
| --- | --- |
| Treat `capSuppressionStartIndex` alone as proof | **Rejected.** The 7 randomized direct-call knownness differences demonstrate why the fix needs a separate optimizer-owned prior-reconciliation proof. |
| Skip old stateful counterfactual history | **Rejected.** Synthetic and real-card counts show that ordered `maxUses` and fixed-per-day state must remain intact. |
| Report the full greedy replay multiplier again | **Rejected as duplicate.** It remains owned by `D-C1-040`, `D-C10-02`, and `C20-PERF01`; the retained finding is only the later stateless counterfactual body. |
| Merge this into Plan 139 | **Rejected.** Blame, chronology, operation types, and benchmark subjects are distinct. |
| Promote the historical prefixed/leading-NUL XLSX hypothesis | **Rejected absent new evidence.** An exact real-workbook probe prefixed with NUL began `[0, 80, 75]`; ZIP preflight classified it `not-zip`. Direct SheetJS produced a synthetic `Sheet1` containing raw ZIP/XML text rather than recovering the original worksheet, and the production parser returned zero transactions with `header row not found`. This is not evidence of silent archive inflation. |
| Current cap-loss correctness or consumer defect | **Rejected.** Exact deterministic and randomized output/knownness parity plus the 306 focused tests found no changed producer or consumer behavior. |
| Security, dependency, parser, persistence, UI, CLI, scraper, visualization, workflow, or build issue | **No new reproducible issue retained.** The repository-wide inspection and full verification gates were clean. |
| Protected Cycle 42 material | **Out of scope and untouched.** No Cycle 42 plan or report was used as a write target. |

## Verification and final missed-file sweep

- `bun test` over the eight focused producer/consumer/dependency files:
  **306 passed, 0 failed, 1,013 expectations**.
- `bun run verify`: toolchain pin, migration cleanliness, dependency policy,
  `bun audit`, generated data/docs, every workspace lint and typecheck, all
  workspace and root tests, Astro static build, and web bundle budgets passed.
- `bun audit`: **no vulnerabilities found**.
- Data/catalog gate: **683 authored cards**, 24 issuers, and **551
  optimizer-executable cards**; checked-in generated artifacts and README
  catalog matched.
- Web build budget: 16 initial files, 172.1 KiB decoded, 59.7 KiB gzip;
  optimizer catalog 41.7% of the legacy artifact; all configured budgets
  passed.
- `git diff --check 3e2d663..HEAD` and the local `git diff --check` passed.
- No active test was marked `.skip`, `.only`, `.todo`, or `.fixme`.
- The only non-test production caller of
  `calculateRewardsWithPreparedCard()` is the optimizer helper; the prepared
  function remains absent from the public package barrel.

The six protected Cycle 42 artifacts retained their original SHA-256 hashes:

| Artifact | SHA-256 |
| --- | --- |
| `.context/plans/67-high-priority-cycle42.md` | `596dc91904a642bbfe5a5f5c338025023a1e5d0c2c92d9842353233c4fc0ac7a` |
| `.context/reviews/cycle42-aggregate.md` | `272a70771bc14dbe131a8aef65907402c5f07f12fc0c798d535a5ef4a67ee4d1` |
| `.context/reviews/cycle42-code-reviewer.md` | `1dbdd1bdf8e2d672075e73e34b5b2043b33f74a36b938085b8efeafd03f03266` |
| `.context/reviews/cycle42-debugger.md` | `6c6aa0d14a9129109341ac285de900bff8af8c38425a03f09e012206266c3df0` |
| `.context/reviews/cycle42-security-reviewer.md` | `c7909307ce1387d617e9d7f51180a6eb8d7b12e1bfffe30bf5fe5dafdbd9a6a5` |
| `.context/reviews/cycle42-test-engineer.md` | `c3fbf7a4ec5628902bce36af73f9d7c6b223c82e6d1360bac44e80d7612a3e9f` |

**Final count: 1 genuinely new finding — 1 Medium, High confidence,
Confirmed.**
