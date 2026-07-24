# Cycle 14 QA Tester Review

**Role:** QA tester

**Reviewed branch:** `codex/review-plan-fix-no-deploy-20260723`

**Reviewed HEAD:** `5260bbd9b6f44ff35cf1bb9a11819354003e5161`

**Scope:** independently validate the user-visible and integration implications
of `RPF14-PERF-001`, exact-result and knownness parity, unsafe proof failure
modes, required regression coverage, duplicate history, and whether a second
new current-HEAD issue survives reconciliation.

No browser, development server, or E2E server was launched. Browser and CLI
paths were inspected read-only and exercised through unit/build gates.

## QA verdict

| Field | Assessment |
|---|---|
| Finding | `RPF14-PERF-001` |
| Severity | **Medium** |
| Confidence | **High** |
| Status | **Confirmed** |
| Newness | **Genuinely new constant-factor body; related to, but not owned by, the older quadratic replay family** |
| User-visible correctness defect on current HEAD | **None** |
| Second new current-HEAD issue | **None found** |

The candidate is a performance defect in a correctness-sensitive diagnostic
path. Current HEAD produces truthful results, but a telemetry-enabled optimizer
append replay rebuilds counterfactual candidates, group maps, state copies,
projections, and completeness reconciliation for every historical row even
when:

- only the newly appended row can be emitted;
- the prepared card has no ordered counterfactual state; and
- the optimizer already reconciled each prefix row when it was current.

The affected result is public and user-facing:
`OptimizationResult.portfolioCapLosses`. A safe fix must be observationally
invisible. It may reduce worker or CLI latency, but it must not change reward
totals, assignments, disclosures, error behavior, or the distinction between
unknown and exact telemetry.

## User-visible and integration contract

### The result has three semantically distinct states

`packages/core/src/models/result.ts:53-75,87-114` defines:

| Core value | Meaning | Permitted presentation |
|---|---|---|
| `portfolioCapLosses === undefined` | Loss cannot be reconciled or represented exactly | Do not claim zero; remain silent |
| `portfolioCapLosses === []` | Exact, known zero loss | Remain silent; do not manufacture a “no loss” claim |
| non-empty array | Exact, known positive net loss | Render the authoritative loss rows |

`greedyOptimize()` starts complete, latches incomplete results false, and
publishes the array only while completeness remains true
(`packages/core/src/optimizer/greedy.ts:630-675,687-744,829-844,959-972`).
This tri-state contract is the primary QA oracle. Deep equality alone is
insufficient if a comparison normalizes `undefined` and `[]`.

### Worker transport preserves the distinction

- Browser analysis reaches `runCancellableOptimizer()`
  (`apps/web/src/lib/analyzer.ts:253-259`).
- Browser execution uses an owned terminating worker; SSR and unit runtimes
  call the same `greedyOptimize()` directly
  (`apps/web/src/lib/optimizer/worker-runner.ts:48-135`).
- The worker installs exactly `greedyOptimize()`
  (`apps/web/src/lib/optimizer/worker.ts:1-4`;
  `worker-protocol.ts:352-371`).
- The response decoder accepts either `undefined` or a validated array and
  rejects malformed loss entries and duplicate transaction identities
  (`worker-protocol.ts:281-336`).

The non-enumerable stateful observation and reservation symbols are consumed
inside `greedyOptimize()` before the result crosses the structured-clone
boundary. A safe internal optimization therefore needs no worker schema
change.

### Browser coherence and persistence preserve knownness

- Analysis coherence explicitly accepts `undefined`, exact empty arrays, and
  coherent positive arrays (`apps/web/src/lib/analysis-result.ts:393-430,
  869-890,990-1028`).
- Persistence documents absence as unknown, accepts it separately from an
  array, and round-trips `undefined` and `[]` independently
  (`apps/web/src/lib/persistence.ts:177-188,347-390,743-759`;
  `apps/web/__tests__/store-persistence.test.ts:1809-1835`).
- If a large persisted loss array exceeds the storage budget, persistence
  omits the whole optional field rather than retaining a misleading partial
  array (`persistence.ts:177-195`).

These consumers validate shape, arithmetic, identity, and cross-result
coherence. They cannot detect that a structurally valid array omitted a loss
because an internal prefix was skipped. Correct completeness must therefore be
preserved at the calculator/optimizer producer.

### Browser, terminal, and report presentation

The browser collector maps `undefined` to no disclosure rows
(`apps/web/src/lib/cap-disclosures.ts:62-69`). The shared
`CapDisclosures.svelte` component renders a portfolio-loss section only for a
non-empty array and is mounted on dashboard, results, and in-app report
surfaces (`apps/web/src/components/ui/CapDisclosures.svelte:19-49`;
`apps/web/__tests__/cap-disclosures.test.ts:140-169`).

Terminal and standalone HTML likewise render positive rows only
(`packages/viz/src/terminal/comparison.ts:80-92`;
`packages/viz/src/report/generator.ts:419-431`). Existing tests require both
legacy unknown and current exact-empty results to stay silent and never print
“혜택 손실 없음”
(`packages/viz/__tests__/cycle7-cap-disclosure.test.ts:242-260`).

Consequences of unsafe proof use are therefore:

- `undefined -> []`: no immediate visual wording change, but public API and
  persistence semantics become falsely exact;
- `undefined -> partial non-empty array`: browser, terminal, and reports can
  show a false or understated authoritative loss; and
- omitted current suppression: a real loss panel can disappear.

Downstream validation cannot reconstruct the omitted counterfactual history.

### User-perceived performance

The browser performs optimization inside an owned worker, so the redundant
body does not block the main thread, but it delays completion and keeps that
worker alive longer. Abort behavior remains terminating and isolated. CLI
optimize/report and SSR fallback execute synchronously, so the cost directly
extends command or request latency.

Exact-head comparisons at 1,000 rows measured approximately 216-291 ms of
avoidable time (5.6-8.2 percent in the exercised all-catalog lanes). The live
catalog contains 683 authored cards, 551 optimizer-executable cards, 383
capped executable cards, and 381 capped/stateless cards. The intended fast
lane is therefore broad.

## Exact-result and knownness parity evidence

### Deterministic randomized differential

An optimizer-path comparison ran 2,000 deterministic cases with:

- one to three cards;
- one to eight transactions;
- additive and exclusive stacking;
- percentage and fixed-per-day rewards;
- per-transaction, monthly, and global caps; and
- optional day/month `maxUses`.

Current HEAD was compared with an experimental stateless-prefix skip while
also comparing the `undefined` classification separately from serialized
JSON:

```json
{
  "cases": 2000,
  "mismatches": 0,
  "knownEmpty": 430,
  "knownPositive": 1227,
  "unknown": 343
}
```

This establishes broad optimizer output parity, including every knownness
class. It does not make a generic start-index skip safe; the direct prepared
boundary below proves that additional optimizer-owned proof is required.

### Explicit monotonic-latch fixture

The stateless unsafe-prefix fixture described below was also sent through the
full optimizer. Current HEAD and the experimental optimizer result were exact
JSON matches, both retained `portfolioCapLosses: undefined`, and both kept the
actual reward total at zero:

```json
{
  "currentKnownness": "unknown",
  "experimentalKnownness": "unknown",
  "exactJSON": true,
  "currentTotal": 0,
  "experimentalTotal": 0
}
```

This is why the optimization is sound only inside the optimizer while its
global completeness flag is still true. The first incomplete row latches the
portfolio unknown before it can become a later assigned prefix.

## Unsafe proof failure modes

### Reproduced direct-boundary failure

A prepared, non-stateful card used:

- two additive first-row fixed rewards whose cap-free sum exceeds
  `Number.MAX_SAFE_INTEGER`; and
- a separate, safely representable capped reward on the second row.

Current HEAD processes the old row even when it is outside the emission range,
so completeness remains false:

| Call | Current `capSuppressionsComplete` | Current emitted-row count |
|---|---:|---:|
| start index `0` | `false` | 1 |
| start index `1` | `false` | 1 |
| start index `2` | `false` | 0 |

An experimental implementation that inferred proof only from
`transactionIndex >= capSuppressionStartIndex` returned:

| Call | Unsafe implementation completeness | Emitted-row count |
|---|---:|---:|
| start index `0` | `false` | 1 |
| start index `1` | `true` | 1 |
| start index `2` | `true` | 0 |

At start index 1, even the emitted arrays remain indistinguishable while the
knownness bit becomes false. At start index 2, it falsely reports a complete
empty window. `capSuppressionStartIndex` is therefore an output boundary, not
a proof that the prefix was checked.

A `maxUses` control remained exact under the experimental stateful guard,
confirming that `PreparedCardRule.hasStatefulReward` is a necessary exception.
It is not sufficient by itself: stateless direct callers still require the
old completeness calculation unless the optimizer supplies a proof.

### Failure-mode matrix

| Unsafe change | Failure | Observable consequence |
|---|---|---|
| Infer proof from start index alone | An arbitrary direct prefix may never have been reconciled | `undefined` becomes `[]` or a partial array |
| Permit the proof on an invalid or too-large boundary | The appended/current row can be skipped | Real loss disappears |
| Reuse a proof after transaction reorder or prefix replacement | “Previously checked” no longer describes the same ordered state | Wrong cap-free winner or knownness |
| Persist proof across optimizer invocations or mutable card rules | Validation/reconciliation facts become stale | Wrong result after mutation |
| Skip a `maxUses` prefix | Counterfactual occurrence reservations are lost or reused | Overstated later loss or hidden negative offset |
| Skip a fixed-per-day prefix | Day reservation is lost | Same-day reward can be counted twice |
| Apply the skip in final `buildCardResults()` | Same-card ordered stateful reconciliation is bypassed | Partial positive telemetry can be published |
| Skip actual prefix work | Monthly/global cap state and reward totals are absent | Wrong assignment, reward, cap hits, and rate |
| Disable collection for the whole `after` replay | Current suppression and completeness are absent | Positive loss becomes exact-empty |
| Reset the global completeness flag from a later local `true` | A prior unknown result is forgotten | Unknown portfolio becomes falsely exact |
| Expose a public caller-set trusted flag | External/deep callers can forge the proof | Producer contract can be bypassed |

### Safe proof contract required by QA

The fix should expose no public behavior toggle. Internally it must:

1. default to full counterfactual replay;
2. create the proof only for `scoreCardsForTransaction()`'s exact append call;
3. require the monotonic global completeness flag to still be true;
4. bind the proof to the exact card, ordered prefix, and appended index for the
   current optimizer invocation;
5. skip only counterfactual candidate/group/projection/reconciliation work for
   rows inside that proven prefix when `hasStatefulReward === false`;
6. always replay actual rows and checked arithmetic;
7. fully process the appended row and its stateful observation index;
8. preserve all rows for `maxUses` and fixed-per-day cards; and
9. leave public calculation, ordinary prepared calls, alternatives,
   card-result replay, and best-single replay on their current contracts.

A dedicated internal optimizer-append wrapper or branded invocation-local
proof is preferable to a broadly reusable boolean. If implementation uses a
source-internal boolean, tests must lock its default to false and prove the
sole production enabling site.

## Current coverage and the missing oracle

Current coverage is strong for value correctness and integration transport:

- core tests cover positive loss, exact zero, unknown arithmetic, monthly,
  per-transaction and global caps, additive/exclusive fallbacks, repeated
  transaction identities, `maxUses`, fixed-per-day, cross-card ambiguity, and
  live BC/Samsung witnesses;
- worker tests preserve positive arrays and explicit unknown;
- analysis/persistence tests distinguish unknown from exact empty and reject
  malformed/incoherent arrays;
- browser, terminal, and HTML tests share positive loss wording and make no
  no-loss claim for `undefined` or `[]`; and
- prepared-boundary tests keep unchecked helpers out of the public barrel.

The test named “append-only telemetry replays historical state without
rebuilding old rows”
(`packages/core/__tests__/cycle13-prepared-cap-validation.test.ts:232-270`)
checks emitted rows and output parity only. It does not count candidate
construction, map/set copying, projections, or reconciliation. Current HEAD
therefore passes the test while rebuilding all old rows.

## Required regression matrix for a fix

### Deterministic core performance oracle

- Instrument counterfactual candidate creation, group creation, state copies,
  projections, reservation commits, and completeness reconciliation through
  an invocation-local test seam.
- With at least two stateless capped cards and multiple assigned rows, require
  zero counterfactual operations for the proven prefix and unchanged actual
  operations.
- Require full counterfactual operation counts for the appended row and every
  row of a stateful card.
- Do not use a wall-clock threshold as the sole gate.

### Direct and proof-boundary safety

- Preserve the unsafe-prefix fixture's `false` completeness for default/direct
  prepared calls at start indexes 1 and 2.
- Exercise negative, fractional, unsafe, exact-last-index, and beyond-length
  boundaries. Invalid proof boundaries should reject or conservatively fall
  back to full replay.
- Prove the optimizer proof cannot be barrel-imported or forged through the
  public `calculateRewards()` API.
- Reuse and mutate the same rule objects in a second invocation and require
  fresh validation/proof state.

### Stateful and fail-closed behavior

- Cover `maxUses` for day and month periods.
- Cover fixed-per-day on the same and different dates.
- Retain ordered exclusive fallback, equal fallback reservation, negative
  later offset, selected-card state release, and cross-card ambiguity cases.
- Add a two-row regression showing a first-row unknown remains globally
  unknown even though later telemetry-disabled calculations return local
  completeness true.

### Exact output parity

Compare both deep objects and serialized output for:

- assignments, alternatives, totals, rates, card results, cap-hit rows, and
  unsupported diagnostics;
- ordered `PortfolioCapLoss` identities, causes, gross/replacement/net
  arithmetic, and duplicate transaction occurrences;
- `undefined`, `[]`, and positive arrays as separate states;
- non-enumerable stateful observation effects; and
- thrown error types/messages for invalid numeric and malformed rule input.

Retain deterministic randomized and real-catalog differentials. Include enough
cases from all three knownness classes rather than accepting a JSON comparison
that silently omits `undefined`.

### Integration gates

- Worker decode must still accept and preserve unknown, exact empty, and
  positive telemetry.
- Persistence must round-trip `undefined` and `[]` separately.
- Browser, terminal, and HTML must render the same positive records and remain
  silent without making a no-loss claim for unknown or exact empty.
- CLI optimize/report and browser worker/synchronous fallback must receive
  exact core output.
- Run the full repository verification gate. A browser E2E change is not
  inherently required if the output schema and rendering remain byte-exact,
  but existing E2E coverage should remain green in the implementation cycle.

## Gate evidence at exact HEAD

Focused cross-package QA command:

```text
bun test \
  packages/core/__tests__/cycle13-prepared-cap-validation.test.ts \
  packages/core/__tests__/cycle13-cap-loss-telemetry.test.ts \
  packages/core/__tests__/optimizer.test.ts \
  apps/web/__tests__/optimizer-worker.test.ts \
  apps/web/__tests__/analysis-result.test.ts \
  apps/web/__tests__/store-persistence.test.ts \
  apps/web/__tests__/cap-disclosures.test.ts \
  packages/viz/__tests__/cycle7-cap-disclosure.test.ts \
  tools/cli/__tests__/analysis.test.ts
```

Result:

```text
332 pass
0 fail
1,079 expectations
9 files
```

`bun run verify` also passed at the reviewed HEAD, including:

- pinned toolchain and migration checks;
- dependency/peer checks and `bun audit` with no vulnerabilities;
- generated data and documentation checks for 683 cards / 551 executable;
- lint and typecheck with zero Astro errors, warnings, or hints;
- all workspace and script unit tests;
- Astro production build; and
- bundle budgets.

`git diff --check` passed. No browser or server was started.

## Newness and duplicate reconciliation

- `git log -S` and `git blame` place `capSuppressionStartIndex`,
  invocation-wide counterfactual collection, score completeness propagation,
  and portfolio telemetry in
  `d7ffac339159187b57b827f9fe5d1b7518289786`
  (`fix(core): preserve post-cap portfolio loss`).
- The Cycle 13 review baseline is
  `3e2d66320d213c7c8d7e33ef9a91f899ab70c0f9`; this counterfactual body was
  added afterward.
- Plan 138 correctly owns ordered post-cap loss telemetry and its
  unknown-versus-known contract. Its required full replay remains necessary
  for `maxUses` and fixed-per-day cards.
- Cycle 13 `RPF13-PERF-001` / Plan 139 owned repeated structural card-rule
  validation. Commit
  `4fa1385a3ba5f1b2f5104d0d3e100ae2eb16264b` fixed that by preparing cards
  once; it did not own the subsequently added counterfactual prefix body.
- `D-C1-040`, `D-C10-02`, `C20-PERF01`, `C67-01`, and `PERF-02` own the
  older O(C*T²) actual-history replay and incremental-state redesign. The
  current candidate is a separable new multiplier inside that replay and can
  be removed without solving incremental scoring.

Disposition: retain one aggregate candidate, `RPF14-PERF-001`; do not mint a
second QA alias.

## Rejected second issues and alternatives

| Candidate or objection | QA disposition |
|---|---|
| Browser and CLI stay silent for both `undefined` and `[]` | Intentional Plan 138 presentation contract; persistence and API still distinguish them |
| Worker structured clone drops internal symbol metadata | Not an issue; optimizer consumes it before posting the public result |
| Stateful full-history counterfactual replay is slow | Required for correctness, not removable under this finding |
| `collectCapSuppressions: false` returns local completeness true | Safe because the optimizer's global flag is monotonic and never resets |
| Prepared helper is a hidden public bypass | No production deep caller and no package export; retain default-safe direct semantics |
| Repeated `before` and actual `after` prefix replay | Real but already deferred under incremental optimizer aliases |
| Timing variance alone weakens the candidate | Rejected; deterministic operation counts and exact static trace establish the work |
| UI should print “unknown loss” | Product behavior explicitly chose silence without a false no-loss claim; not this performance root |

No second new current-HEAD QA defect survived source, caller, consumer, test,
and history reconciliation.

## Explicit prefixed-XLSX rejection

The historical prefixed/leading-NUL XLSX ZIP-inflation hypothesis remains
rejected and is unrelated to this optimizer finding. Current archive preflight
enters ZIP inspection only for an offset-zero `PK` signature
(`packages/parser/src/shared/xlsx-archive.ts:118-132`). Corrected prior probes
sent prefixed bytes to the plaintext/PRN path, produced no preserved workbook
transactions, and did not inflate archive entries. This QA pass found no new
parser path or reproducible evidence and does not resurrect the hypothesis.

## Protected Cycle 42 artifact proof

The six protected artifacts were hash-checked before the QA pass and after the
only authorized report write. They remain untracked (`??`) and byte-exact:

| Artifact | SHA-256 | Status |
|---|---|---|
| `.context/plans/67-high-priority-cycle42.md` | `596dc91904a642bbfe5a5f5c338025023a1e5d0c2c92d9842353233c4fc0ac7a` | unchanged, untracked |
| `.context/reviews/cycle42-aggregate.md` | `272a70771bc14dbe131a8aef65907402c5f07f12fc0c798d535a5ef4a67ee4d1` | unchanged, untracked |
| `.context/reviews/cycle42-code-reviewer.md` | `1dbdd1bdf8e2d672075e73e34b5b2043b33f74a36b938085b8efeafd03f03266` | unchanged, untracked |
| `.context/reviews/cycle42-debugger.md` | `6c6aa0d14a9129109341ac285de900bff8af8c38425a03f09e012206266c3df0` | unchanged, untracked |
| `.context/reviews/cycle42-security-reviewer.md` | `c7909307ce1387d617e9d7f51180a6eb8d7b12e1bfffe30bf5fe5dafdbd9a6a5` | unchanged, untracked |
| `.context/reviews/cycle42-test-engineer.md` | `c3fbf7a4ec5628902bce36af73f9d7c6b223c82e6d1360bac44e80d7612a3e9f` | unchanged, untracked |

No source, test, plan, protected artifact, or other review report was edited by
this QA pass.
