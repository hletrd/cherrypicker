# Cycle 14 Tracer Review

**Role:** tracer

**Reviewed branch:** `codex/review-plan-fix-no-deploy-20260723`

**Reviewed HEAD:** `5260bbd9b6f44ff35cf1bb9a11819354003e5161`

**Scope:** trace `RPF14-PERF-001` from optimizer entry through prepared-card
calculation, reward selection/reconciliation, completeness propagation, and
all production callers; look for aliases, semantic traps, and a second root.

## Verdict

`RPF14-PERF-001` is confirmed.

| Field | Assessment |
|---|---|
| Severity | **Medium** |
| Confidence | **High** |
| Status | **Confirmed** |
| Newness | **Genuinely new, with an older related complexity family** |
| Second root | **None found** |

The optimizer's append-scoring call emits suppression rows only for the newly
appended transaction, but the reward kernel still performs the complete
counterfactual selection and reconciliation path for every historical row.
For a capped card without `maxUses` or fixed-per-day rewards, that historical
counterfactual work has no state needed by the appended row. The optimizer has
already reconciled each such prefix row when that row was current, while its
global completeness flag was still true.

The safe optimization is narrower than “skip rows before
`capSuppressionStartIndex`.” That index is only an emission boundary. Direct
prepared-card callers are allowed to request an append-only view without
proving the omitted prefix was previously reconciled, and old rows can still
make `capSuppressionsComplete` false. A fix therefore needs an explicit,
optimizer-owned proof of prefix reconciliation and must default to the current
full replay everywhere else.

## End-to-end trace

### 1. Public optimizer and application entry points

- `packages/core/src/optimizer/index.ts:20-30` routes public `optimize()` to
  `greedyOptimize()`. The root package and `@cherrypicker/core/optimizer`
  exports expose the same greedy implementation
  (`packages/core/src/index.ts:71`;
  `packages/core/package.json:8-14`).
- The browser analyzer calls `runCancellableOptimizer()`
  (`apps/web/src/lib/analyzer.ts:253-259`). In a browser it posts the same
  constraints and rules to an owned worker
  (`apps/web/src/lib/optimizer/worker-runner.ts:37-41,57-116,123-135`);
  `worker.ts:1-4` installs `greedyOptimize()`, and
  `worker-protocol.ts:352-371` invokes it. SSR and unit runtimes call
  `greedyOptimize()` directly.
- CLI optimize and report use public `optimize()`
  (`tools/cli/src/commands/optimize.ts:91-97`;
  `tools/cli/src/commands/report.ts:95-101`).
- No application layer can repair or amplify this cost after the optimizer:
  worker decoding, persistence, and visualization consume the finished
  `OptimizationResult`.

Thus the finding reaches synchronous CLI/SSR calls directly and occupies the
browser worker until the worker completes or is aborted. There is no alternate
production optimizer implementation that avoids the path.

### 2. Prepared-card boundary

`greedyOptimize()` filters and sorts eligible cards, retains executable cards,
and prepares each retained entry once before processing transactions
(`packages/core/src/optimizer/greedy.ts:572-620`). Preparation:

- validates tier uniqueness and shared-cap coherence;
- records whether an executable rule has a monthly/per-transaction/global cap;
- records whether an executable rule carries ordered `maxUses` or
  fixed-per-day state; and
- returns a frozen, symbol-branded `PreparedCardRule`
  (`packages/core/src/calculator/reward.ts:128-190`).

An exact catalog inventory at reviewed HEAD found:

```json
{
  "authoredCards": 683,
  "optimizerExecutable": 551,
  "capped": 383,
  "cappedStateless": 381,
  "cappedStateful": 2,
  "statefulIds": ["shinhan-b-big", "shinhan-bom"]
}
```

The affected stateless lane is therefore the ordinary case among capped live
rules, while the stateful exception is small but semantically mandatory.

The public `calculateRewards()` wrapper still validates mutable card input on
every call (`reward.ts:1117-1124`). The prepared entry point validates the
brand and numeric options, then calls the shared kernel
(`reward.ts:1126-1179`). It is an internal source export, but it is absent from:

- `packages/core/src/index.ts`;
- `packages/core/src/calculator/index.ts`; and
- the `packages/core/package.json` subpath export map.

A repository-wide symbol and import search found only one production caller:
`packages/core/src/optimizer/greedy.ts`. The remaining direct callers are
focused core tests. There is no hidden application deep import.

### 3. Optimizer append scoring

For every current transaction and prepared card,
`scoreCardsForTransaction()`:

1. replays the card's assigned prefix with telemetry disabled to get the
   `before` total (`greedy.ts:244-253`);
2. appends the current transaction and replays the resulting list
   (`greedy.ts:254-264`);
3. enables cap telemetry only while the global telemetry flag is true and the
   card has a reward cap;
4. passes the old prefix length as `capSuppressionStartIndex`; and
5. keeps only the suppression whose `transactionIndex` equals the appended
   index (`greedy.ts:265-302`).

The assigned prefix is not arbitrary. The main loop processes a canonical
transaction order, and only after scoring appends a positive winning
transaction to its card-owned list (`greedy.ts:639-668,779-814`). Therefore
every row that later appears in a card prefix was previously evaluated as the
current appended row for that same card.

The redundant work exists only in the telemetry-enabled `after` calculation.
Other prepared-card replays have different contracts:

| Call site | Telemetry | Required behavior |
|---|---:|---|
| `scoreCardsForTransaction()` `before` (`greedy.ts:248-253`) | off | Full actual prefix replay |
| `scoreCardsForTransaction()` `after` (`greedy.ts:257-264`) | conditional | Candidate for proven stateless prefix skip |
| `buildAssignments()` totals (`greedy.ts:347-364`) | off | Full actual replay |
| alternative calculations (`greedy.ts:413-449`) | off | Full actual replay |
| `buildCardResults()` (`greedy.ts:464-565`) | stateful cards only | Full ordered counterfactual replay |
| best-single calculation (`greedy.ts:912-940`) | off | Full actual replay |

The older duplicate actual-prefix replay remains, but it is the already-known
incremental optimizer problem. This finding concerns the newly added
counterfactual body inside the telemetry-enabled `after` call.

### 4. Reward kernel and the wasted body

The kernel allocates counterfactual occurrence and fixed-per-day trackers once
whenever invocation-wide `collectCapSuppressions` is true
(`reward.ts:1197-1207`). Per row, it computes:

```ts
const emitCapSuppression =
  collectCapSuppressions &&
  transactionIndex >= capSuppressionStartIndex;
```

(`reward.ts:1227-1230`).

That boolean controls cause collection and final row emission, but not whether
the counterfactual path runs. `findRules()` receives the unchanged
invocation-wide flag (`reward.ts:1258-1277`). For every old row it still:

- builds actual and counterfactual candidate arrays
  (`reward.ts:677-755`);
- clones actual cap and day state, groups candidates, sorts each group, and
  projects actual selection (`reward.ts:770-832`);
- builds another counterfactual group map;
- clones cap state and the counterfactual day set;
- sorts additive and exclusive counterfactual candidates; and
- previews and applies their projections
  (`reward.ts:844-925`).

After actual execution, the kernel also accumulates transaction-local applied
reward under the invocation-wide flag (`reward.ts:1487-1493`) and enters the
full reservation/completeness block for every old row
(`reward.ts:1528-1627`). It allocates a reconciliation set, commits
counterfactual reservations, compares actual and cap-free rewards, and can
mark completeness false because of:

- an unrepresentable occurrence increment (`reward.ts:1541-1549`);
- an unrepresentable counterfactual sum (`reward.ts:1566-1567`);
- a negative stateful offset (`reward.ts:1568-1572`); or
- incoherent/unsafe gross suppression arithmetic
  (`reward.ts:1577-1600`).

Only the final positive row construction is gated by
`emitCapSuppression`. This proves the start index currently suppresses output,
not computation.

For a stateless card, no counterfactual eligibility state crosses transaction
boundaries. Actual cap state still crosses rows and must be rebuilt, but
historical cap-free grouping, projection, and completeness reconciliation do
not feed the appended row. For a stateful card, the occurrence/day
reservations created at `reward.ts:874-890,1528-1564` do feed later selection,
so its old rows must continue through the full counterfactual path.

### 5. Completeness propagation proves when reuse is valid

Each score carries `after.capSuppressionsComplete`
(`greedy.ts:290-302`). The main loop requires every card's current replay to
be complete and latches `portfolioCapLossesComplete` false on any failure
(`greedy.ts:670-675`). Cross-card stateful ambiguity can also latch it false
(`greedy.ts:687-703,730-744`). There is no assignment that restores it.

This monotonicity is the optimizer's proof:

- If the global flag is true when an appended row is scored, every earlier
  assigned prefix row was reconciled when it was current.
- If any such row was incomplete, the global flag was set false then, and no
  future call enables telemetry or claims the prefix proof.
- If cross-card analysis makes the current row incomplete after scoring, the
  row may still be assigned, but future calls see the false global flag and do
  not use the optimization.

At the end, `buildCardResults()` deliberately performs a full replay only for
capped stateful cards (`greedy.ts:486-495`) and may latch completeness false
again (`greedy.ts:496-515,829-844`). The public result includes
`portfolioCapLosses` only if the flag remains true
(`greedy.ts:959-972`). A fix must preserve that full final stateful pass.

### 6. Measured manifestation

The retained exact-head instrumentation counted the following operations in
the stateless historical prefix:

| Rows | Historical counterfactual row/group rebuilds | Copied Map/Set states | Counterfactual projections |
|---:|---:|---:|---:|
| 100 | 4,708 | 9,416 | recorded in the same redundant lane |
| 1,000 | 340,779 | 681,558 | 340,779 |

At 1,000 rows this is at least 1,022,337 avoidable Map/Set allocations before
counting candidate arrays, group arrays, sorts, and reconciliation sets.

Five alternating exact-output trials measured:

| Rows | Current median | Proven stateless-prefix comparison | Delta |
|---:|---:|---:|---:|
| 100 | 225.7 ms | 221.5 ms | 4.2 ms / 1.9% |
| 500 | 1,562.1 ms | 1,513.7 ms | 48.3 ms / 3.1% |
| 1,000 | 3,892.5 ms | 3,676.3 ms | 216.3 ms / 5.6% |

An independent all-catalog 1,000-row comparison in this review session
measured 3,820.7 ms versus 3,529.6 ms over three alternating medians
(291.1 ms / 8.2%), with exact optimizer JSON. Timings are supporting evidence;
deterministic operation counts should be the regression oracle.

## Semantic trap reproduced

`capSuppressionStartIndex` is not a proof that its prefix was previously
checked.

A direct prepared-card fixture used a stateless card with:

- two first-row additive fixed rewards whose cap-free sum exceeds
  `Number.MAX_SAFE_INTEGER`, making telemetry incomplete; and
- a separate safe capped reward on the second row.

Reviewed HEAD, both full and append-only views correctly retained unknown:

```json
{
  "stateful": false,
  "fullComplete": false,
  "appendComplete": false,
  "fullRows": [1],
  "appendRows": [1]
}
```

An experimental implementation that skipped every stateless row before the
start index returned:

```json
{
  "stateful": false,
  "fullComplete": false,
  "appendComplete": true,
  "fullRows": [1],
  "appendRows": [1]
}
```

The emitted rows look identical, but the completeness contract is false.
The production optimizer itself remains fail-closed in this fixture because
the first row was checked while current and latched the global flag false.
That difference is exactly why the optimization is valid only with the
optimizer's monotonic-prefix proof and invalid as a generic kernel inference.

## Safe proof requirements

An acceptable implementation must satisfy all of these conditions:

1. Add a private/internal proof such as
   `prefixCounterfactualAlreadyReconciled`; default it to false.
2. Create or assert that proof only in the `scoreCardsForTransaction()`
   append-scoring path, while `collectPortfolioTelemetry` is true.
3. Couple the proof to an exact append boundary: the start index identifies
   the one newly appended transaction and the proven prefix is every earlier
   row. Reject or fall back for an invalid/out-of-range boundary.
4. Skip counterfactual work only when all are true:
   - collection is enabled;
   - the proof is present;
   - the row is inside the proven prefix; and
   - `PreparedCardRule.hasStatefulReward` is false.
5. Always replay actual history, including condition matching, cap-group/global
   state, occurrence state used by actual rewards, actual reward totals,
   caps-hit output, unsupported diagnostics, and checked arithmetic.
6. Fully process the appended row so its suppression, stateful observation,
   and completeness reach the score.
7. Fully process all rows of a stateful card. Both `maxUses` and
   fixed-per-day counterfactual reservations are ordered persistent state.
8. Keep public `calculateRewards()`, ordinary/direct prepared calls, calls
   without the proof, and the final `buildCardResults()` stateful replay on
   current full semantics.
9. Do not expose an unchecked public package option. Prefer a dedicated
   optimizer append wrapper or an internal branded proof over a broadly
   reusable boolean. If a boolean is used at the source-internal boundary,
   its default-false behavior and sole production caller must be locked by
   tests.
10. Preserve the monotonic global completeness latch. The optimization must
    never infer that a previously unknown prefix became complete.

This is a constant-factor fix within the current pure replay architecture. It
does not authorize skipping actual prefix replay or introducing mutable
cross-invocation caches.

## Required proof before accepting a fix

- Deterministic instrumentation must show zero counterfactual candidate/group,
  projection, state-copy, reservation, and reconciliation work for a proven
  stateless historical prefix, while actual-row operation counts stay
  unchanged.
- The direct unsafe-prefix fixture above must remain
  `capSuppressionsComplete: false` without an optimizer proof.
- A direct prepared append with a start index greater than the transaction
  count must retain current full completeness semantics unless a separately
  validated proof contract intentionally rejects it.
- `maxUses` and fixed-per-day fixtures must replay every old counterfactual
  row and preserve reservation order, negative-offset unknown behavior, and
  cross-card ambiguity.
- Catalog and deterministic randomized comparisons must produce exact
  serialized optimizer output, including `undefined` versus `[]`,
  non-enumerable stateful metadata effects, repeated transaction occurrence
  identity, unsupported diagnostics, assignments, and card results.
- Public barrel/export tests must continue proving that prepared/unchecked
  helpers are not package exports.
- Keep timing checks informational. Use operation counts and exact output
  parity as stable gates.

The current focused suites passed at reviewed HEAD:

```text
bun test \
  packages/core/__tests__/cycle13-prepared-cap-validation.test.ts \
  packages/core/__tests__/cycle13-cap-loss-telemetry.test.ts

39 pass, 0 fail, 159 expectations
```

The broader exact-head review session also passed the focused optimizer,
prepared-cap, cap-loss, and merchant-boundary set (80 tests), and the repository
`bun run verify` gate. A deterministic randomized comparison of 10,000 small
cap/stacking/stateful cases found exact current-versus-proposed optimizer
output; these results support but do not replace the explicit proof tests
above.

## Rejected alternatives

| Alternative | Reason rejected |
|---|---|
| Treat `capSuppressionStartIndex` as proof | Reproduced false-completeness result for a direct prepared caller |
| Skip all old rows when `hasStatefulReward` is false | Same problem: stateless old rows can independently make completeness false |
| Disable telemetry for the entire `after` replay | Loses the appended row's suppression and completeness |
| Skip actual prefix replay | Breaks monthly/global cap state and marginal reward; belongs to an incremental redesign |
| Apply the skip to `buildCardResults()` | Destroys ordered same-card stateful reconciliation |
| Re-run only the latest row with empty state | Computes the wrong cap remaining and fallback selection |
| Make a public caller-set “trusted” flag | Weakens the prepared boundary and permits silent completeness forgery |
| Cache prepared or calculated state across invocations | Mutable caller inputs and invocation-local ordering make this unsafe without a larger state design |
| Merge this into the old O(C*T²) item only | Hides a separable telemetry body added after the Cycle 13 baseline and a small regression-safe fix |
| Use wall-clock thresholds as the sole test | Too noisy; deterministic body counts express the root directly |

## Newness and alias reconciliation

- `git blame` assigns the collection flags, append emission boundary,
  counterfactual trackers, reconciliation body, score completeness, and
  stateful portfolio telemetry to
  `d7ffac339159187b57b827f9fe5d1b7518289786`
  (`fix(core): preserve post-cap portfolio loss`).
- That commit follows the Cycle 13 review baseline
  `3e2d66320d213c7c8d7e33ef9a91f899ab70c0f9`.
- Cycle 13 `RPF13-PERF-001` / Plan 139 addressed repeated structural cap-rule
  validation. Commit
  `4fa1385a3ba5f1b2f5104d0d3e100ae2eb16264b` fixed that by preparing each
  card once. It did not own the later counterfactual telemetry body.
- Plan 138 required deterministic full ordered replay for stateful
  counterfactuals. That requirement remains correct; it did not require
  replaying stateless prefix counterfactuals already proven complete.
- `D-C1-040`, `D-C10-02`, `C67-01`, and `PERF-02` own the older actual-history
  O(C*T²) replay and incremental/worker redesign. The `before` calculation
  and actual half of `after` remain within that family. This finding is the
  new cap-free telemetry body layered on top and should cross-reference, not
  replace or duplicate, those items.
- The test named “append-only telemetry replays historical state without
  rebuilding old rows” at
  `packages/core/__tests__/cycle13-prepared-cap-validation.test.ts:232-270`
  verifies output-row filtering and parity. It has no operation-count
  assertion and therefore does not prove its title's performance claim.

No alias search produced an existing item that already owns this exact
counterfactual-prefix body.

## Second-root sweep

No second actionable root was found.

- The full stateful historical replay is required, not redundant.
- The full actual historical replay is redundant at the architectural level
  but already owned by the deferred incremental optimizer items.
- Cards without caps correctly disable suppression collection while still
  allowing actual stateful observation at the current index.
- Once completeness is false, later telemetry-disabled scores report local
  calculation completeness true, but the global flag is monotonic and never
  resets; public loss output therefore remains unknown as intended.
- Unsupported rewards are excluded from the prepared stateful/cap facts and
  from executable behavior consistently.
- Direct public calculator calls retain full validation and full suppression
  semantics.
- No production deep import, alternate worker implementation, or public alias
  bypasses the traced path.

The historical prefixed/leading-NUL XLSX hypothesis remains rejected. This
trace produced no new reproducible evidence and does not resurrect it.

## Protected Cycle 42 artifact check

The six protected artifacts were hash-checked before this report and again
after the only authorized write. They remain untracked (`??`) and byte-exact:

| Artifact | SHA-256 | Status |
|---|---|---|
| `.context/plans/67-high-priority-cycle42.md` | `596dc91904a642bbfe5a5f5c338025023a1e5d0c2c92d9842353233c4fc0ac7a` | unchanged, untracked |
| `.context/reviews/cycle42-aggregate.md` | `272a70771bc14dbe131a8aef65907402c5f07f12fc0c798d535a5ef4a67ee4d1` | unchanged, untracked |
| `.context/reviews/cycle42-code-reviewer.md` | `1dbdd1bdf8e2d672075e73e34b5b2043b33f74a36b938085b8efeafd03f03266` | unchanged, untracked |
| `.context/reviews/cycle42-debugger.md` | `6c6aa0d14a9129109341ac285de900bff8af8c38425a03f09e012206266c3df0` | unchanged, untracked |
| `.context/reviews/cycle42-security-reviewer.md` | `c7909307ce1387d617e9d7f51180a6eb8d7b12e1bfffe30bf5fe5dafdbd9a6a5` | unchanged, untracked |
| `.context/reviews/cycle42-test-engineer.md` | `c3fbf7a4ec5628902bce36af73f9d7c6b223c82e6d1360bac44e80d7612a3e9f` | unchanged, untracked |

No source, test, plan, protected artifact, or other review file was edited by
this tracer.
