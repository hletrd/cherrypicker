# Review-plan-fix Cycle 14 — performance reviewer

- Date: 2026-07-24
- Reviewed revision: `5260bbd9b6f44ff35cf1bb9a11819354003e5161`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Lens: CPU and allocation growth, algorithmic scaling, browser/CLI
  responsiveness, concurrency and cancellation, worker/resource ownership,
  parser and persistence memory bounds, and cross-file runtime behavior
- Disposition: **1 genuinely new finding — 1 Medium**
- Scope: review and this report only; no source, test, plan, configuration,
  generated artifact, dependency, staging, commit, push, browser, E2E,
  deployment, or external-system change

## Inventory and duplicate control

The exact Git tree contains **2,337 tracked paths**: **1,169** tracked
`.context` paths and **1,168** active product, data, test, documentation,
workflow, configuration, and vendor-integrity paths. The active paths comprise
880 package paths, 171 web paths, 63 tool paths, 19 scripts, 16 E2E paths, and
19 root/workflow/configuration/vendor paths.

The review-relevant inventory includes 202 non-test runtime
TypeScript/JavaScript/Svelte/Astro/CSS paths, 148 unit/E2E test paths, 23
configuration/manifest/workflow paths, 29 active Markdown documents, all 683
authored card YAML files and 24 issuer READMEs, and 30 generated/public catalog
JSON paths. I traversed the complete active inventory and traced upload
admission, parser dispatch/workers, categorization, analysis validation and
persistence, catalog loading, reward calculation, optimization, worker
transport, UI rendering, CLI/reporting, scraper I/O, generation scripts, and
resource cleanup. Bulk card data and generated projections were structurally
checked as one publication graph rather than sampled as isolated cards.

For duplicate control, I indexed and searched all current and archived
`.context` findings and plans, including the complete performance-review
history, the deferred register, Plans 72 and 138–140, Cycle 13 role reports and
aggregate, and the six protected untracked Cycle 42 artifacts. I did not
re-report:

- the deferred incremental optimizer and its established replay complexity
  (`D-C1-040`, `D-09`, `D-C10-02`, and `C20-PERF01`);
- the compiled merchant matcher (`D-C1-041`);
- transaction-table virtualization, whole-input CSV/XLSX/PDF/HTML costs,
  persistence serialization, worker string cloning, diagnostic bounds, or
  catalog/rendering micro-optimizations already owned by historical entries;
- Cycle 13's repeated structural cap validation (`RPF13-PERF-001`), which Plan
  139 fixed by preparing each optimizer card once.

The finding below is a narrower cost introduced later by Plan 138's
`d7ffac3` telemetry implementation. It preserves the feature-essential
current-row counterfactual and isolates only redundant older-row work.

## Finding

### RPF14-PERF-001 — append-only telemetry replays every older stateless row even though only the appended row can be emitted

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed on current HEAD by operation counters, an exact-revision
  differential, an optimizer-output-preserving isolated comparison, and a
  direct-call safety probe
- **Primary locations:**
  - `packages/core/src/optimizer/greedy.ts:244-264` enables cap telemetry for
    every capped candidate, appends one transaction, and passes the old
    history length as `capSuppressionStartIndex`.
  - `packages/core/src/calculator/reward.ts:1127-1179` forwards the start index
    only as an emission boundary; it does not tell the kernel whether older
    counterfactual state is needed.
  - `packages/core/src/calculator/reward.ts:1227-1277` sets
    `emitCapSuppression` false for old rows but still passes the unchanged
    `collectCapSuppressions` flag to `findRules()`.
  - `packages/core/src/calculator/reward.ts:677-935` consequently rebuilds
    counterfactual candidate groups, copies cap/day state, sorts candidates,
    and projects the cap-free result for every old row.
  - `packages/core/src/calculator/reward.ts:1528-1627` also reruns
    counterfactual reservation/completeness reconciliation for those
    non-emitting rows.
  - `packages/core/src/calculator/reward.ts:137-189` already computes the exact
    distinction needed to avoid this work:
    `PreparedCardRule.hasStatefulReward`.
  - `packages/core/src/optimizer/greedy.ts:633-675` keeps completeness
    monotonically for the whole optimization, so an older append result does
    not need to be re-proved on every later score.

#### Concrete scenario

A 1,000-row latest-month statement is scored against the current optimizer
artifact. The artifact has 682 cards, of which 551 are executable. **383**
executable cards have a reward cap, so they need a counterfactual for the
newly scored row. Only **2** executable cards have supported
`maxUses`/fixed-per-day state, so only those two need their cap-free history
replayed to determine the appended row.

Current HEAD nevertheless counterfactually replays the complete assigned
history of every stateless capped card on every later score. The browser
worker prevents this CPU work from freezing the window, but the result arrives
later and uses more CPU/battery. CLI `optimize` and `report` pay it
synchronously before output.

#### Why the older stateless work is redundant

The actual calculation must still replay history to reconstruct monthly and
global cap usage; this finding does not remove that work. The current-row
cap-free projection for every capped candidate is also feature-essential and
is not classified as a defect.

For a stateless prepared card inside the optimizer, however, a prior row's
cap-free selection cannot reserve an occurrence or day for the new row. Each
prior assigned row was already evaluated as the appended row during an earlier
greedy iteration. If it made telemetry incomplete, the optimizer's monotonic
`portfolioCapLossesComplete` flag already disabled later publication. Thus,
when the optimizer can prove that the prefix was reconciled, rows before
`capSuppressionStartIndex` need only the actual selection path. Stateful
prepared cards must retain the current full-history counterfactual path.

That proof cannot be inferred from `capSuppressionStartIndex` alone. A direct
internal prepared-calculator caller may request only later emitted rows without
having checked the prefix. A synthetic stateless prefix with a capped,
higher-priority 1% rule and an uncapped 5% fallback made current HEAD return
`capSuppressionsComplete: false`; the naive unconditional stateless skip
returned `true`. The proposed fast path must therefore be optimizer-scoped and
opt-in, while existing direct/internal calls default to the full replay.

#### Operation and timing evidence

I instrumented exact-HEAD copies outside the repository. To quantify the
optimizer-only opportunity, the comparison skipped counterfactual
selection/reconciliation before `capSuppressionStartIndex` when
`hasStatefulReward` was false. It continued the actual replay for every row,
continued the current-row counterfactual for all capped cards, and continued
full counterfactual history for stateful cards. This comparison models the
fast path only under the optimizer's already-reconciled-prefix invariant; the
direct-call probe above establishes why the production API must require that
additional proof rather than applying the skip unconditionally.

On the real artifact and a deterministic mixed-category workload:

| Transactions | Avoided old-row counterfactual replays | Avoided group `Map`s | Avoided copied `Map`/`Set` states | Avoided rule projections |
| ---: | ---: | ---: | ---: | ---: |
| 100 | 4,708 | 4,708 | 9,416 | 4,708 |
| 1,000 | 340,779 | 340,779 | 681,558 | 340,779 |

At 1,000 rows this is at least **1,022,337 avoidable `Map`/`Set`
allocations**, before counting group-member arrays, projection objects, sorts,
and reconciliation sets.

Five alternating samples per variant returned byte-identical complete
optimization JSON:

| Transactions | Current HEAD median | Stateless-history skip median | Saved |
| ---: | ---: | ---: | ---: |
| 100 | 225.7 ms | 221.5 ms | 4.2 ms / 1.9% |
| 500 | 1,562.1 ms | 1,513.7 ms | 48.3 ms / 3.1% |
| 1,000 | 3,892.5 ms | 3,676.3 ms | 216.3 ms / 5.6% |

The nonlinear growth is expected: candidate cards with no assigned history
still perform only the necessary appended-row projection, while histories of
selected capped cards grow across iterations.

For provenance, an exact-revision comparison of the Plan 139 implementation
commit `4fa1385` against current HEAD measured 237.3 versus 270.4 ms at 100
rows and 3,843.4 versus 4,182.3 ms at 1,000 rows after normalizing only the new
telemetry field. That broader 13.9%/8.8% delta includes feature-essential
current-row telemetry and is not the promoted defect; the isolated table above
measures the avoidable portion.

#### Novelty versus Cycle 13

`RPF13-PERF-001` and Plan 139 concern repeated rule-structure validation on
every calculator call. That work existed before cap-loss telemetry and was
removed by an opaque prepared-card path. The present finding begins inside
the later `d7ffac3` counterfactual stream after preparation has succeeded.

Plan 139's completion benchmark compares final HEAD with the older Cycle 12
baseline and reports an 18–20% net improvement from removing structural
validation. That net comparison can mask work added by the subsequent
telemetry commit and does not distinguish current-row projection from
historical projection. Plan 138 requires deterministic stateful replay but
contains no performance budget or stateless-history exception. The existing
append-only regression at
`packages/core/__tests__/cycle13-prepared-cap-validation.test.ts:232-270`
checks output/emission parity, not counterfactual operation counts.

Full-history searches for `capSuppressionStartIndex`, append-only telemetry,
stateless counterfactual history, and cap-free replay found no prior owner for
this narrower allocation regression.

#### Suggested fix

Keep the current public calculator behavior, default internal prepared-call
behavior, and current-row telemetry contract unchanged. At the optimizer and
prepared-card boundary:

1. add an explicit private/internal
   `prefixCounterfactualAlreadyReconciled` proof/option that defaults to false;
2. have only `scoreCardsForTransaction()` set it, and only while its monotonic
   `portfolioCapLossesComplete` input is true;
3. derive a per-row `collectTransactionCounterfactual` flag that stays true
   for rows at or after `capSuppressionStartIndex`, for all rows of a stateful
   prepared card, and whenever the prefix proof is absent;
4. only when the proof is present, the card is stateless, and the row is
   before the start index, run the actual selection path but skip
   counterfactual grouping/projection and the matching reconciliation block.

Pass the prepared statefulness proof into the private kernel rather than
exporting another unchecked public API. Add internal observer regressions
requiring zero pre-start counterfactual projections for a proven/reconciled
capped stateless optimizer prefix, full pre-start projections for `maxUses`
and fixed-per-day cards, and full replay for a direct append-only call without
the proof. The unsafe-fallback fixture above must remain incomplete. Retain
direct/prepared output parity, the current randomized cap telemetry suite, and
exact whole-result parity on the compiled catalog.

## Verification and final missed-file sweep

- Current HEAD focused tests passed: **80 tests, 288 expectations, 0
  failures** across cap-loss telemetry, prepared-card validation, optimizer,
  and compiled merchant-boundary performance suites.
- The optimizer-comparison patch passed **39 cap-loss/prepared-card tests, 159
  expectations, 0 failures**.
- A forced 90-row run over the two real stateful cards
  (`shinhan-b-big`, `shinhan-bom`) produced exact output and identical
  counterfactual operation counts in current and comparison variants.
- The 100/500/1,000-row real-catalog optimizer comparisons produced exact
  full JSON parity.
- The direct stateless unsafe-prefix probe demonstrated the required guard:
  current HEAD returned incomplete while an unguarded skip returned complete.
  This competing patch shape was rejected rather than proposed.
- No browser, preview server, E2E test, deployment, or production mutation was
  performed.

The closing sweep rechecked every active nested loop, sort, spread/call
argument, full-input decode, parser/archive bound, worker clone and transfer,
queue/backpressure point, abort/listener/timer owner, cache, persistence
serialization, reactive list, catalog/build script, scraper response bound,
CLI I/O path, and current commit delta. No second genuinely new,
non-duplicate performance issue cleared the evidence threshold.

The prefixed/leading-NUL XLSX ZIP-inflation hypothesis remains explicitly
rejected. `packages/parser/src/shared/xlsx-archive.ts:118-130` enters ZIP
metadata inspection only for `PK` at byte zero; no current path or new
reproduction contradicts the prior corrected investigation.

The six protected Cycle 42 artifacts remained byte-identical. The only
repository path written by this role is
`.context/reviews/cycle14-perf-reviewer.md`.

**Final count: 1 new performance finding — 1 Medium (High confidence,
Confirmed).**
