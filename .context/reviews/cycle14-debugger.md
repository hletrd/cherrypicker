# Review-plan-fix Cycle 14 — debugger

- Date: 2026-07-24
- Reviewed revision: `5260bbd9b6f44ff35cf1bb9a11819354003e5161`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Lens: executable reproduction, causal localization, competing-patch
  falsification, invariant ownership, smallest safe repair, and regression
  fixture design
- Disposition: **1 genuinely new finding confirmed — 1 Medium; no second
  debugger root**
- Scope: review and this report only; no repository source, test, plan,
  configuration, dependency, generated artifact, staging, commit, push,
  browser, E2E, deployment, or external-system change

## Locked baseline and investigation method

The review ran against exact HEAD
`5260bbd9b6f44ff35cf1bb9a11819354003e5161` on
`codex/review-plan-fix-no-deploy-20260723`. The tracked tree contains 2,337
paths: 1,169 tracked `.context` paths and 1,168 active product, data, test,
documentation, workflow, configuration, and vendor-integrity paths.

I traced the complete reward/cap-loss path and its consumers, then extracted
exact HEAD with `git archive` into an isolated directory outside the
repository. The isolated copy received only a candidate calculator/optimizer
change plus a debugger-only row counter. Repository files were never used as
the patch target.

Historical reconciliation covered the deferred optimizer entries, Cycle
10–13 reports and aggregates, Plans 72 and 138–140, all current Cycle 14 role
reports, and the protected Cycle 42 artifacts. The active-tree closing sweep
also revisited parser/worker, analysis/persistence, catalog publication,
CLI/reporting, scraper, dependency, and workflow failure boundaries before
concluding that there is no second new debugger root.

## Confirmed finding

### RPF14-PERF-001 — an emission boundary is mistaken for a computation boundary during append-only cap telemetry

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed by exact-HEAD reproduction, isolated patch
  differential, row-operation instrumentation, stateful controls, complete
  optimizer-output identity, focused tests, and typecheck
- **Manual validation:** Not required
- **Primary locations:**
  - `packages/core/src/optimizer/greedy.ts:244-264`
  - `packages/core/src/optimizer/greedy.ts:633-675`
  - `packages/core/src/calculator/reward.ts:137-189`
  - `packages/core/src/calculator/reward.ts:677-935`
  - `packages/core/src/calculator/reward.ts:1127-1179`
  - `packages/core/src/calculator/reward.ts:1227-1277`
  - `packages/core/src/calculator/reward.ts:1487-1493`
  - `packages/core/src/calculator/reward.ts:1528-1627`
  - `packages/core/__tests__/cycle13-prepared-cap-validation.test.ts:232-270`

### Causal localization

The failure is a five-step flag-scope mismatch:

1. `scoreCardsForTransaction()` appends one transaction to a candidate card's
   assigned history. For a capped candidate while portfolio telemetry remains
   complete, it passes `collectCapSuppressions: true` and the old history
   length as `capSuppressionStartIndex`
   (`packages/core/src/optimizer/greedy.ts:244-264`).
2. `calculateRewardsWithPreparedCard()` validates that start index but forwards
   it only as a number beside the statement-wide
   `collectCapSuppressions` flag
   (`packages/core/src/calculator/reward.ts:1127-1171`).
3. The kernel derives `emitCapSuppression` from the index at lines 1227-1230,
   but still passes statement-wide `collectCapSuppressions` into
   `findRules()` at lines 1261-1277.
4. `findRules()` therefore builds the cap-free candidate list, copied state,
   stacking-group map, sorts, projections, causes, and reservations for every
   older row (`packages/core/src/calculator/reward.ts:677-935`), even though
   that invocation cannot emit those rows.
5. The kernel also accumulates a transaction counterfactual total and runs
   reservation/completeness reconciliation for those non-emitting rows
   (`packages/core/src/calculator/reward.ts:1487-1493,1528-1627`).

The actual path still needs the history to reconstruct monthly/global cap
usage. The defect is only that the cap-free path is statement-scoped when its
safe optimizer use is row-scoped.

### Why current completeness is the optimizer's proof

Every transaction in a card's assigned prefix was evaluated for that card as
the appended row during an earlier greedy iteration. While telemetry is
enabled, that earlier score ran the complete current-row counterfactual. If
that result was incomplete, `portfolioCapLossesComplete` latched false at
`packages/core/src/optimizer/greedy.ts:670-675`. The flag never returns to
true; subsequent calls receive `collectPortfolioTelemetry: false`.

Thus only a score running while the monotonic input is still true can assert
that its existing prefix was already reconciled.

The calculator separately owns whether cap-free row order carries state.
`PreparedCardRule.hasStatefulReward` is derived at
`packages/core/src/calculator/reward.ts:137-189`. A `maxUses` or fixed-per-day
choice on an old row can reserve an opportunity needed by the appended row, so
stateful cards must retain complete historical counterfactual replay.

## Reproductions and competing-patch falsification

### 1. Direct-call unsafe prefix

The direct fixture has:

- one stateless, higher-priority 1% exclusive rule with `monthlyCap: 0`;
- one lower-priority uncapped 5% exclusive fallback;
- a 10,000-won dining prefix row; and
- an unrelated later row with `capSuppressionStartIndex: 1`.

Current HEAD returned:

```json
{
  "totalReward": 500,
  "capSuppressions": [],
  "capSuppressionsComplete": false
}
```

The old row's cap-free 100-won choice is weaker than its actual 500-won
fallback, so the positive-only telemetry stream is incomplete even though the
row is before the emission boundary.

In the isolated candidate, the default call evaluated counterfactual rows
`[0,1]` and retained `false`. Deliberately lying with the optimizer-only claim
evaluated only `[1]` and changed completeness to `true`. This proves:

- `capSuppressionStartIndex` is not proof;
- statelessness is not proof;
- an internal caller can still misuse any policy/boolean that lets it claim
  prior reconciliation; and
- the safe default plus sole production authority are essential.

### 2. Proven stateless prefix

A three-row capped stateless fixture used start index 2:

```text
ordinary prepared replay: [0, 1, 2]
proven optimizer replay:  [2]
```

The two complete `CalculationOutput` values were exactly equal. The candidate
continued actual selection/execution for every row; only the already-proved
cap-free prefix disappeared.

### 3. `maxUses` and fixed-per-day controls

The same three-row/start-index-2 probe was repeated with:

- `conditions: { maxUses: 2, usePeriod: "monthly" }`; and
- a `fixed_per_day` / `won_per_day` reward.

Both prepared values had `hasStatefulReward: true`. With the optimizer claim
present, both variants still evaluated:

```text
[0, 1, 2]
```

Their outputs were exactly equal to ordinary full replay. The candidate did
not convert stateful history into a stateless fast path.

The compiled artifact independently contains 682 cards, 551 executable cards,
383 executable capped cards, and exactly two executable stateful cards:
`shinhan-b-big` and `shinhan-bom`.

### 4. Whole-optimizer identity

I ran current HEAD and the isolated candidate over all 682 artifact cards and
a deterministic 300-row mixed-category statement. The complete serialized
optimizer outputs had the same SHA-256:

```text
ee2ccd1f123bbf135667c9be2d588a2ef9bad280eeddcb15a010a4b8a2021ffc
```

The isolated focused cap-loss/prepared/optimizer suite passed **75 tests, 239
expectations, 0 failures**. Core `tsc --noEmit` also passed.

The performance and critic lanes provide the larger-scale confirmation: at
1,000 rows the exact artifact avoids 340,779 old-row counterfactual replays
and at least 1,022,337 map/set allocations, with exact output and a measured
216–291 ms reduction.

## Replay-policy challenge

The architect proposed an internal discriminated replay policy to bind the
start index and the optimizer assertion. I tested the safety property that
such a policy is meant to provide.

The discriminant does not authenticate the runtime claim. An internal direct
caller can choose an `optimizer-reconciled-prefix` variant just as it can set a
boolean, and the unsafe fixture then changes completeness. The type can prevent
an omitted start index, but an omitted index already defaults to zero, which
causes no rows to be skipped. It does not prevent the dangerous case: a false
claim paired with a positive index.

Therefore:

- a discriminated policy is acceptable naming/maintainability;
- it is not an additional correctness boundary;
- a branded token factory would also be false assurance unless it independently
  knew the optimizer's live monotonic state; and
- a persisted/per-card replay watermark would add invalidation and lifecycle
  state far beyond this repair.

The smallest safe code change is the explicit internal
`prefixCounterfactualAlreadyReconciled?: boolean`, defaulting to `false`.
Safety comes from the optimizer's sole production call site and independent
callee gates, not from the shape of the option.

The prepared function is absent from the public package barrel/export map, so
this does not create a public unchecked calculator. Add a source/export
contract to keep it that way.

## Smallest safe code change

The isolated candidate established the following narrow production diff:

1. At `packages/core/src/calculator/reward.ts:1127-1137`, add the optional
   internal `prefixCounterfactualAlreadyReconciled` field with a false default.
2. Before entering the kernel, derive:

   ```text
   skipReconciledStatelessPrefix =
     prefixCounterfactualAlreadyReconciled === true &&
     preparedCardRule.hasStatefulReward === false
   ```

   Do not let the caller supply or override statefulness.
3. At `packages/core/src/calculator/reward.ts:1227-1230`, derive one row-local
   flag:

   ```text
   collectTransactionCounterfactual =
     collectCapSuppressions &&
     !(skipReconciledStatelessPrefix &&
       transactionIndex < capSuppressionStartIndex)
   ```

4. Use that same row-local flag in exactly four places:
   - `emitCapSuppression`;
   - the `findRules()` collection argument at line 1275;
   - transaction applied-reward accumulation at line 1487; and
   - the reconciliation block at line 1528.
5. At `packages/core/src/optimizer/greedy.ts:257-264`, have only
   `scoreCardsForTransaction()` pass the claim, using its existing
   `collectPortfolioTelemetry` input. That input is the monotonic
   `portfolioCapLossesComplete` value passed at lines 662-675.
6. Leave public calculation, ordinary prepared calls, actual history,
   current-row counterfactuals, counterfactual map allocation, stateful
   history, final-card stateful replay, arithmetic checks, and every output
   contract unchanged.

A discriminated union may replace the boolean if maintainers prefer it, but it
is a larger refactor with no demonstrated safety gain. Do not broaden this
change into the deferred incremental optimizer.

## Precise regression hook and fixtures

Output parity alone cannot detect the redundant work, and the existing
append-only test demonstrates that gap. Add one invocation-local internal
observer to the prepared calculation input:

```text
observer.counterfactualTransactionIndices: number[]
```

The kernel should push an index exactly when
`collectTransactionCounterfactual` is true. Use a passive mutable object, not a
callback or module-global counter, so the hook cannot re-enter or mutate the
calculation mid-row. Keep the observer absent from the public barrel and from
production optimizer calls.

Required deterministic fixtures:

1. **Stateless proven prefix:** three capped rows, start 2, optimizer claim
   true -> indices `[2]`; ordinary replay -> `[0,1,2]`; exact complete output
   equality.
2. **Unsafe direct prefix:** capped-priority/uncapped-fallback fixture above,
   start 1, no claim -> `[0,1]` and
   `capSuppressionsComplete === false`.
3. **Monotonic optimizer control:** the same unsafe prefix through
   `greedyOptimize()` -> telemetry remains `undefined`; a later row must not
   re-enable collection after completeness latches false.
4. **`maxUses` history:** claim true, start 2 -> `[0,1,2]`.
5. **Fixed-per-day history:** claim true, start 2 -> `[0,1,2]`.
6. **Current-row capped control:** every capped stateless score still evaluates
   the appended index and emits the same loss.
7. **Surface contract:** the prepared constructor/function and new claim remain
   absent from `@cherrypicker/core` exports; repository search finds exactly
   one production opt-in site.
8. **Whole optimizer parity:** deterministic compiled-artifact fixture and the
   existing randomized cap/stateful oracle retain exact result equality.

The observer should be removed or compiled to a no-op if a stable
non-callback test seam can be achieved with existing proxy instrumentation;
timing must remain supporting evidence, not the regression oracle.

## Novelty and duplicate control

`RPF14-PERF-001` is new relative to the Cycle 13 baseline. The dual
counterfactual path and emission start index came from telemetry commit
`d7ffac3` after the Cycle 13 review revision.

It is not:

- `D-C1-040`, `D-09`, `D-C10-02`, or `C20-PERF01`, which own the older actual
  replay and eventual incremental optimizer;
- `RPF13-PERF-001` / Plan 139, which owned repeated structural validation and
  is fixed by the prepared capability; or
- Plan 138's required deterministic replay for `maxUses`/fixed-per-day state,
  which this repair preserves.

Full-history searches found no earlier owner for a previously reconciled
stateless counterfactual prefix. No second current-HEAD debugger candidate
survived reproduction and historical deduplication.

The prefixed/leading-NUL XLSX inflation hypothesis remains explicitly
rejected. `packages/parser/src/shared/xlsx-archive.ts:118-130` enters archive
inspection only for `PK` at byte zero; no new evidence changes the corrected
non-ZIP/plaintext reproduction.

## Final integrity and missed-file sweep

- Exact branch and HEAD were rechecked before investigation.
- `git diff --check 3e2d663..HEAD` passed.
- The isolated comparison directory was outside the repository and was removed
  after validation.
- No browser, preview server, E2E suite, deployment, production write, or
  external-system mutation occurred.
- The closing sweep revisited all calculator/optimizer branches, completeness
  latches, arithmetic/unsupported failures, stateful reservations,
  worker/abort/settlement paths, analysis/persistence decoders, presentation
  sinks, parser/archive boundaries, catalog publication, CLI/reporting,
  scraper I/O, manifests, dependency checks, workflow authority, and all 55
  paths changed since the Cycle 13 review baseline.

The six protected Cycle 42 artifacts remain untracked, unstaged, and
byte-identical:

| Artifact | SHA-256 |
| --- | --- |
| `.context/plans/67-high-priority-cycle42.md` | `596dc91904a642bbfe5a5f5c338025023a1e5d0c2c92d9842353233c4fc0ac7a` |
| `.context/reviews/cycle42-aggregate.md` | `272a70771bc14dbe131a8aef65907402c5f07f12fc0c798d535a5ef4a67ee4d1` |
| `.context/reviews/cycle42-code-reviewer.md` | `1dbdd1bdf8e2d672075e73e34b5b2043b33f74a36b938085b8efeafd03f03266` |
| `.context/reviews/cycle42-debugger.md` | `6c6aa0d14a9129109341ac285de900bff8af8c38425a03f09e012206266c3df0` |
| `.context/reviews/cycle42-security-reviewer.md` | `c7909307ce1387d617e9d7f51180a6eb8d7b12e1bfffe30bf5fe5dafdbd9a6a5` |
| `.context/reviews/cycle42-test-engineer.md` | `c3fbf7a4ec5628902bce36af73f9d7c6b223c82e6d1360bac44e80d7612a3e9f` |

Concurrent Cycle 14 sibling reports were not modified. The only repository
path written by this role is `.context/reviews/cycle14-debugger.md`.

**Final count: 1 new finding — 1 Medium (High confidence, Confirmed); no
second debugger root.**
