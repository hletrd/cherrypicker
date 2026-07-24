# Review-plan-fix Cycle 14 — critic

- **Date:** 2026-07-24
- **Reviewed revision:** `5260bbd9b6f44ff35cf1bb9a11819354003e5161`
- **Branch:** `codex/review-plan-fix-no-deploy-20260723`
- **Disposition:** **1 genuinely new finding — 1 Medium**
- **Confidence:** High
- **Status:** Confirmed; no browser/manual validation is required
- **Scope:** review and this report only; no product source, test, plan,
  dependency, configuration, generated artifact, commit, push, deployment, or
  external-system change

## Inventory before adjudication

I inventoried the exact Git tree before selecting review targets. It contains
**2,337 tracked paths**: 1,169 `.context` paths and 1,168 active product, data,
test, documentation, workflow, configuration, and vendor-integrity paths.

| Family | Files | Critic treatment |
| --- | ---: | --- |
| `.context` | 1,169 | Complete path/topic index; current and archived performance/correctness findings, deferred roots, Cycle 12–13 aggregates and specialist reports, Plans 129 and 138–140, and every hit for the retained/rejected candidates were reconciled |
| `packages` | 880 | Calculator state, prepared rules, optimizer replay, parser kernels, catalog semantics, and visualization sinks traced directly |
| `apps` | 171 | Upload/parser workers, analysis/coherence, persistence, store ownership, and dashboard/results/report presentation traced directly |
| `tools` | 63 | CLI parse/optimize/report and scraper trust/write paths inspected |
| `scripts` | 19 | Dependency/peer, publication, migration, README, bundle, and E2E-process gates inspected |
| `e2e` | 16 | Browser regression and process-ownership specifications inventoried |
| Root/workflow/instructions/vendor/other | 19 | Manifests, lockfile, workflow, toolchain, documentation, and vendored integrity checked |

The tree contains 358 tracked TS/JS/Svelte/Astro paths and 178 test-like/E2E
paths. The declarative graph contains 683 authored card YAML files across 24
issuers. The complete sorted tracked-path manifest hashes to
`9f94d22676f9f96ff85a5e33b89756985a0ca24091ed3ec4905dfbaa9524e2ac`;
the non-`.context` manifest hashes to
`ae2dee19c2745ee764d2986f1fd129e0da496fabf7a982377502134f48166fce`.

The current change surface from the Cycle 13 review baseline `3e2d663` contains
55 paths: 27 review/plan paths, 10 test/E2E paths, 17 product source paths, and
the lockfile. I traced that surface through:

1. card schema/publication → prepared calculator proof → actual and cap-free
   rule selection → greedy scoring → final optimizer result;
2. optimizer result → worker decoder → analysis coherence → persistence →
   browser, terminal, CLI, and standalone-report sinks;
3. transaction parsing/editing → calendar/performance context → duplicate
   occurrence identity → optimizer replay;
4. lock peer resolution → dependency gate → workflow verification/build; and
5. parser/archive, browser state, CLI consent, scraper network/LLM/write, and
   output escaping boundaries needed to challenge a performance-only reading.

The competing perspectives were user correctness, latency/CPU/allocation
growth, architectural proof ownership, testability, security/privacy,
documentation/UX truthfulness, and operational failure behavior. The current
Cycle 14 code-review, test, security, and performance reports were also read
as provisional evidence, not accepted without direct source and executable
cross-checks.

## Retained finding

### C14-CRIT-001 / RPF14-PERF-001 — append-only scoring rebuilds the cap-free selection for every historical row of stateless capped cards

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed on current HEAD by source lifecycle tracing, operation
  counts, two independent exact-output timing comparisons, randomized
  optimizer parity, and a counterexample rejecting the unsafe patch shape
- **Manual validation:** Not required
- **Prepared proof already available:**
  `packages/core/src/calculator/reward.ts:137-189`
- **Dual actual/counterfactual selection:**
  `packages/core/src/calculator/reward.ts:677-935`
- **Prepared append API and kernel boundary:**
  `packages/core/src/calculator/reward.ts:1127-1179`
- **Emission gate that does not gate computation:**
  `packages/core/src/calculator/reward.ts:1227-1277`
- **Historical-row reconciliation:**
  `packages/core/src/calculator/reward.ts:1528-1627`
- **Optimizer append call:**
  `packages/core/src/optimizer/greedy.ts:244-264`
- **Monotonic optimizer completeness proof:**
  `packages/core/src/optimizer/greedy.ts:633-675`
- **Existing regression that checks rows, not work:**
  `packages/core/__tests__/cycle13-prepared-cap-validation.test.ts:232-270`

#### Mechanism

For every candidate card and new transaction, `scoreCardsForTransaction()`
recalculates the card's assigned history plus the appended transaction. If the
prepared card has any cap, it enables suppression collection and passes the
old history length as `capSuppressionStartIndex`.

Inside the calculator, that index controls only
`emitCapSuppression`. For every row before the index, the unchanged
`collectCapSuppressions: true` still reaches `findRules()`. That function:

- builds both actual and counterfactual candidate arrays;
- creates and fills counterfactual stacking-group maps;
- copies cap and fixed-per-day state;
- filters and sorts group members;
- projects cap-free additive/exclusive candidates; and
- runs reservation and completeness reconciliation after actual execution.

The old row cannot be emitted by this invocation. On a stateless card it also
cannot reserve a `maxUses` occurrence or fixed-per-day reward needed by the
new row. The actual history replay remains necessary to reconstruct monthly
and global cap use; the finding is only the second, cap-free reconstruction.

The current artifact makes the distinction material and mechanically narrow:

```text
artifact cards:                    682
optimizer-executable cards:        551
executable capped cards:           383
executable stateful cards:           2
capped but stateless cards:        381
stateful IDs: shinhan-b-big, shinhan-bom
```

#### Why the optimizer may skip a proven stateless prefix

Every transaction that later appears in a card's assigned prefix was evaluated
for that card as the appended/current row in an earlier greedy iteration.
While telemetry remains enabled, that current-row evaluation performs the
complete cap-free check. If it is unsafe or otherwise incomplete,
`portfolioCapLossesComplete` latches false, and every later score disables
telemetry. It never returns to true.

Therefore the optimizer has a monotonic proof that an enabled stateless prefix
was already reconciled. A stateful card does not have the same independence:
old cap-free choices can consume an occurrence/day opportunity and change the
new row, so its complete counterfactual history must remain.

#### Concrete impact and independent evidence

The performance lane's instrumented exact-HEAD comparison counted the
following redundant stateless-prefix work on the real artifact:

| Rows | Old-row counterfactual replays | Group maps | Copied map/set states | Projections |
| ---: | ---: | ---: | ---: | ---: |
| 100 | 4,708 | 4,708 | 9,416 | 4,708 |
| 1,000 | 340,779 | 340,779 | 681,558 | 340,779 |

At 1,000 rows that is at least **1,022,337 avoidable `Map`/`Set`
allocations**, excluding group-member arrays, projection objects, sorts, and
reconciliation sets. Five alternating samples preserved byte-identical full
optimizer JSON while measuring:

```text
100 rows:   225.7 ms current vs 221.5 ms comparison
500 rows: 1,562.1 ms current vs 1,513.7 ms comparison
1,000 rows:
           3,892.5 ms current vs 3,676.3 ms comparison
           216.3 ms / 5.6% saved
```

I independently extracted exact HEAD outside the repository, changed only the
stateless pre-start counterfactual path for the optimizer comparison, and ran
a different 1,000-row mixed-category workload over all artifact cards. Three
alternating samples produced **3,820.7 ms versus 3,529.6 ms median**, a
**291.1 ms / 8.2%** delta, with exact full JSON equality. A deterministic
10,000-case randomized one-to-three-card optimizer differential, including
caps, additive/exclusive groups, and stateful conditions, also produced
10,000 exact matches.

The browser performs optimization in a worker, so this does not freeze the
window. It does delay result readiness and spend CPU/battery. CLI `optimize`
and `report` pay the cost synchronously. A normal 100-row statement pays only
about four milliseconds in the measured mix; that limits the severity to
Medium. The quadratic prefix growth and roughly 0.2–0.3 seconds at 1,000 rows
make it more than an unmeasured micro-optimization.

#### The obvious patch is unsafe

`capSuppressionStartIndex` alone is not proof that its prefix was previously
checked. An arbitrary internal prepared-calculator caller may request later
rows without an optimizer history.

I built a stateless two-row fixture whose first row has additive capped
rewards with an unrepresentable cap-free sum and whose second row is safe.
Current HEAD returns:

```json
{
  "fullComplete": false,
  "appendComplete": false,
  "fullRows": [1],
  "appendRows": [1]
}
```

A naive “stateless and before start means skip” comparison returns
`appendComplete: true`, even though its full replay remains false. The 39
existing cap-loss/prepared tests still pass that unsafe comparison, proving
the current suite does not own this boundary. The production optimizer remains
equal in that fixture because the first current-row evaluation latches
telemetry unknown before the prefix can be reused.

This counterexample does not invalidate the finding. It narrows the fix:
statefulness plus an optimizer-owned prior-prefix proof is required.

#### Novelty and duplicate adjudication

This is genuinely new relative to Cycle 13:

- `git blame` attributes the counterfactual state, start index, dual selection,
  and reconciliation to telemetry commit `d7ffac3`, after all Cycle 13 review
  roles examined baseline `3e2d663`.
- Plan 138 requires deterministic replay for `maxUses` and fixed-per-day
  state. It does not require or budget redundant stateless-prefix projection.
- `RPF13-PERF-001` / Plan 139 concerned whole-card structural validation before
  every calculator replay. That scan is now prepared once and remains fixed.
  This finding begins after preparation, inside the later telemetry path.
- Deferred `D-C1-040`, `D-C10-02`, `C67-01`, and `PERF-02` own the older
  actual-history replay and eventual incremental optimizer. This finding does
  not remove actual replay or implement an accumulator; it removes only new
  cap-free work added inside that historical multiplier.
- The append-only test's title says historical rows are not rebuilt, but its
  assertions check emitted array parity and result values. It contains no
  counterfactual operation-count or unsafe-prefix oracle.

The broader telemetry cost is not the finding. An exact-revision comparison
measured current-row plus history telemetry overhead, but current-row
counterfactual calculation is required for truthful loss disclosure. Only the
isolated older stateless work above is promoted.

#### Fix

Keep public calculation, direct prepared calls, actual history, current-row
counterfactuals, and all stateful counterfactual history unchanged.

1. Add a private/internal optimizer-only
   `prefixCounterfactualAlreadyReconciled` proof/option that defaults to
   `false`. Only `scoreCardsForTransaction()` may set it, and only while the
   monotonic `portfolioCapLossesComplete` input is true.
2. Pass the prepared card's existing `hasStatefulReward` proof into the private
   kernel. For a row before `capSuppressionStartIndex`, skip counterfactual
   selection/reconciliation only when the prefix proof is present and the card
   is stateless.
3. Continue actual selection/execution for every historical row, complete
   counterfactual replay for every stateful row, and complete counterfactual
   work for every current/emittable row.
4. Add operation-count tests for zero proven stateless-prefix projections,
   unchanged `maxUses` and fixed-per-day prefix projections, and default full
   replay for direct prepared calls.
5. Add the unsafe stateless-prefix fixture above and require both full and
   ordinary append-only calls to remain incomplete. Retain randomized
   optimizer parity and an exact compiled-artifact comparison.

Do not infer the proof from the start index, expose a public unchecked fast
path, or broaden the change into the deferred incremental optimizer.

## Competing perspectives and rejected candidates

| Candidate or objection | Critic decision |
| --- | --- |
| “The optimizer is already quadratic, so this is `PERF-02`.” | **Rejected as a duplicate objection.** The multiplier is historical, but the dual stateless counterfactual body was added by `d7ffac3` and is removable without changing the multiplier or actual results. |
| “All telemetry work is necessary for correctness.” | **Qualified.** Current-row work and stateful history are necessary. A previously reconciled stateless prefix is not. The finding and fix retain the necessary portions. |
| Unguarded `hasStatefulReward === false` fast path | **Rejected as behavior-changing.** The unsafe-prefix probe changes `capSuppressionsComplete`; the fix requires an explicit optimizer proof and safe default. |
| Negative-offset/stateful telemetry becomes `undefined` | **Intentional fail-closed contract**, explicitly owned by Plan 138. Randomized cap differentials confirm every defined result reconciles exactly. |
| Counterfactual name has no positive aggregate witness | **Not promoted.** Only locally edited/corrupted session display text can exploit the gap; fresh producers and financial arithmetic remain coherent, and persistence has no authoritative catalog-name map. Manual hardening note only. |
| Shared cap group spans categories | **Prospective schema concern only.** The complete supported catalog has no current witness; no product failure was reproduced. |
| Same-category visible cap identity | **Cycle 12 duplicate**, C12-CT-001 / Plan 129. |
| Cycle 42 amount/parser and non-finite persistence candidates | **Stale and fixed.** The web amount entry uses the canonical parser, and current persistence requires safe finite shapes plus full coherence. |
| Cycle 42 `safeJSONParse`, CSP, sessionStorage, HTML normalization, remote-PDF limitations | **Historical rejected/deferred security items.** The current security lane reproduced no new sink or exploit path. |
| Prefixed/leading-NUL XLSX inflation | **Explicitly rejected again.** ZIP admission still requires `PK` at byte zero. Corrected probes return `not-zip`, a plaintext/PRN sheet, zero production transactions, and no archive inflation. No new evidence permits resurrection. |
| Designer upload stall, decorative SVG naming, parser duplication, optimizer-catalog cloning | **Inconclusive, fixed, or historically owned** with no new current-HEAD failure. |

No separate correctness, security, dependency, UX, documentation, state,
resource-lifecycle, or test root survived the cross-perspective challenge.

## Verification and final missed-file sweep

- Exact-HEAD `bun run verify` — **PASS**: toolchain, migration, dependency and
  peer contracts, `bun audit`, all 683-card data/docs checks, lint, typecheck,
  every workspace/root test task, Astro static build, and bundle budgets.
- Current focused core run — **80 passed, 0 failed, 288 assertions** across
  telemetry, preparation, optimizer, and merchant-boundary performance.
- Isolated comparison focused run — **39 passed, 0 failed, 159 assertions**.
- Full-artifact comparisons — exact optimizer JSON at 100, 500, and 1,000
  rows; both real stateful cards retained full-history operation counts.
- Independent randomized optimizer differential — **10,000 exact matches**.
- Independent unsafe-prefix probe — current full and append calls both
  incomplete; unguarded skip incorrectly complete.
- `git diff --check` — **PASS**.

The isolated comparison tree was outside the repository and was moved to Trash
after validation. It is recoverable there. The closing missed-file sweep
revisited arithmetic and safe-integer failure, rule selection and stacking,
monthly/global/per-transaction caps, rollback and stateful reservations,
counterfactual ordering/completeness, duplicate transaction occurrences,
worker ownership/decoding, persistence migration/coherence/size bounds, every
result sink, parser format/encoding/archive boundaries, catalog publication,
CLI consent/output, scraper network/model/write policy, dependency/lock
resolution, workflow authority, documentation, and all 55 changed paths.

The six protected Cycle 42 artifacts remained byte-identical with SHA-256
prefixes `596dc919`, `272a7077`, `1dbdd1bd`, `6c6aa0d1`, `c7909307`, and
`c3fbf7a4`. Concurrent Cycle 14 sibling reports were not modified. This lane
wrote only `.context/reviews/cycle14-critic.md`.

**Final count: 1 new finding — 1 Medium (High confidence, Confirmed).**
