# Review-plan-fix Cycle 15 — verifier

- Date: 2026-07-24
- Reviewed revision: `4b1f368d6b8b92cf009ba18d93639f841a8b5d06`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Baseline used for the repair delta:
  `5260bbd9b6f44ff35cf1bb9a11819354003e5161`
- Lens: evidence-based correctness verification of stated behavior against
  implementation, tests, public/internal contracts, README/documentation,
  generated artifacts, consumers, and archived/current review history
- Disposition: **PASS — 0 genuinely new current-HEAD findings**
- Scope: review and this report only; no source, test, plan, configuration,
  generated-artifact, staging, commit, push, deployment, browser, server, or
  external-system mutation

## Inventory and provenance

I reset the review to the exact Git object above before using any prior
inventory. The exact-HEAD tree contains **2,354 tracked paths**: **1,185**
tracked `.context` paths and **1,169** active product, data, test,
documentation, workflow, configuration, and integrity paths. The sorted
tracked-path manifest SHA-256 is
`9e060303ffa4a07a2c264d3c8462417b2861ea6362a491dbcf975f7777748166`;
excluding `.context`, it is
`8d03ca399a2ddd9f1a237a1e7665f4e1a6b0e55a290c64858aaceef76acd7c91`.

The product/test delta from the prior reviewed baseline is exactly four paths,
**411 insertions and 7 deletions**:

| Path | Delta role |
|---|---|
| `packages/core/src/calculator/reward.ts` | Prepared-card cap/state facts, optimizer-only prefix proof, validation, and row-local counterfactual bypass |
| `packages/core/src/calculator/types.ts` | Public completeness documentation |
| `packages/core/src/optimizer/greedy.ts` | Sole production proof authority and monotonic completeness latch |
| `packages/core/__tests__/cycle14-reconciled-stateless-cap-prefix.test.ts` | Direct, stateful, invalid-proof, knownness, and operation-count controls |

No README, browser consumer, generated artifact, schema, parser, persistence,
CLI, visualization, workflow, or dependency path changed in the repair delta.
Those unchanged paths were still traced where they consume or state the
changed contract.

## Verified contract and behavior

### 1. Prepared-card classification is derived and fail-closed

`prepareCardRuleForCalculation()` first performs the cross-rule structure
checks, then derives `hasRewardCap` from the card-global, monthly-rule, and
per-transaction caps and derives `hasStatefulReward` from supported
`maxUses`/`usePeriod` and fixed-per-day rewards
(`packages/core/src/calculator/reward.ts:128-190`). Unsupported rules are
excluded before either reward-rule fact is inferred. Positive annual caps
cannot silently bypass this classification because the catalog validation
contract requires such rules to remain unsupported.

The prepared value carries a module-private symbol and is frozen. Its
constructor and unchecked calculator are absent from the public barrel
(`packages/core/src/index.ts:53-72`) and the package export map exposes no
calculator deep path. Public callers therefore continue through
`calculateRewards()`, including structural and safe-integer validation.

### 2. The shortcut has one production authority and exact preconditions

`scoreCardsForTransaction()` is the only production enabling site. For every
eligible transaction it scores every executable prepared card against that
card's already assigned canonical prefix plus exactly one appended row. It
asserts the prefix proof only while the live portfolio-completeness latch
still enables cap collection and the card actually has a cap
(`packages/core/src/optimizer/greedy.ts:228-304`).

The callee independently:

- defaults the proof to false;
- rejects it when suppression collection is disabled;
- requires `capSuppressionStartIndex === transactions.length - 1`;
- validates the prepared-card brand; and
- actually activates the bypass only when the prepared card is stateless
  (`packages/core/src/calculator/reward.ts:1126-1200`).

The kernel's row-local flag skips only counterfactual selection and
reconciliation for rows strictly before the append boundary. Actual matching,
reward application, cap consumption, category totals, cap-hit diagnostics,
unsupported-rule diagnostics, and the appended row retain their ordinary
paths (`packages/core/src/calculator/reward.ts:1256-1312,1517-1663`).

The enclosing `portfolioCapLossesComplete` state begins true and only latches
false; it is never restored during an invocation
(`packages/core/src/optimizer/greedy.ts:637-751`). This ordering matters: the
current appended row is fully reconciled before any newly discovered
incompleteness disables proof use on later iterations. Stateful `maxUses` and
fixed-per-day cards always replay their full counterfactual history. The final
stateful card replay may still invalidate completeness, after which
`portfolioCapLosses` is omitted rather than represented as known
(`packages/core/src/optimizer/greedy.ts:471-571,823-978`).

### 3. Public output and documentation remain coherent

`CalculationOutput.capSuppressionsComplete` now says exactly what the
implementation does: false means the emitted rows are partial and cannot be
totaled authoritatively, whether the cause is unrepresentable arithmetic or
ordered reconciliation (`packages/core/src/calculator/types.ts:68-83`;
failure branches at
`packages/core/src/calculator/reward.ts:1584,1601-1607,1633-1635`).

The optimizer's separate public contract preserves
`portfolioCapLosses: undefined` as unknown, not zero
(`packages/core/src/models/result.ts:87-115`). Worker decoding, analysis
coherence validation, persistence validation, the browser disclosure
component, terminal output, and standalone report generation accept and
preserve that shape. No serialized field or public type changed.

README claims are correspondingly higher-level: the optimizer reflects
previous-spending requirements and caps when calculating monthly benefits
(`README.md:21-35`), and the generated catalog section distinguishes 683
catalog cards from 551 optimizer-executable cards (`README.md:62-66`). Neither
claim promises complete cap-loss diagnostics when exact reconciliation is
unknown.

## Independent executable evidence

The verification did not treat comments or the new regression file as proof
by themselves.

1. **Published-catalog classifier audit — PASS.** The canonical optimizer
   artifact loader validated all **682 recommendation-eligible published
   cards** under source identity
   `ad1edfe624495c7380b86255de27a29091eacc09e325d82a9533034ad2279b58`.
   An independent scan of supported rules found 427 capped cards, 2 stateful
   cards (both capped), 425 capped/stateless cards, and 381
   capped/stateless/executable cards. Every result matched the prepared
   calculator's derived flags: **0 classifier mismatches**.

2. **Live full-optimizer differential — PASS.** I ran the published catalog
   over 120 deterministic transactions spanning all catalog top-level
   categories, mixed dates, amounts, merchants, a subcategory, and varied
   previous spending. For the control, each of the 381 executable
   capped/stateless cards received a semantically unreachable fixed-per-day
   sentinel. The sentinel can never match a transaction but forces the
   existing full-history replay path. The optimized and forced-full-replay
   results were byte-for-byte identical, including 88 assignments, totals,
   alternatives, card results, diagnostics, knownness, and all 106 published
   portfolio-loss rows.

3. **Focused deterministic regression matrix — PASS.**
   `bun test` over
   `cycle13-cap-loss-telemetry.test.ts`,
   `cycle13-prepared-cap-validation.test.ts`,
   `cycle14-reconciled-stateless-cap-prefix.test.ts`, and
   `cycle9-calculation-determinism.test.ts` completed with **53 passed,
   0 failed, and 235 expectations**. This covers exact cap witnesses,
   same-card fallbacks, cross-card/stateful unknownness, invalid prepared
   claims, public-export isolation, canonical ordering, and current-delta
   operation counts.

4. **Generated data and docs — PASS.** `bun run data:check` reparsed all
   **683 authored cards across 24 issuers**, checked every generated byte
   surface and README catalog, and confirmed **551 optimizer-executable
   cards**. The summary, optimizer, category artifact, and all 24 issuer
   detail shards carry one identical source hash: **27/27 identity surfaces
   agree**.

The broader current Cycle 15 code-review and test lanes independently report
green full-tree/runner gates. Their evidence was used only for
cross-reconciliation; the four checks above were performed separately for
this verifier lane.

## Findings

**None.** No candidate survived source reproduction, contract tracing,
independent comparison with the ordinary full-replay path, generated-artifact
validation, consumer tracing, and historical deduplication. There is therefore
no truthful file/line, severity, confidence, validation status, failure
scenario, or suggested fix to record.

## Historical and current reconciliation

All 1,185 tracked `.context` paths were path/topic inventoried and
candidate-searched. The focused corpus included the Cycle 14 aggregate and
specialist reports, Plans 138, 141, and 142, the deferred register, and every
Cycle 15 report present during this lane's final reconciliation. The current
code-review, test-engineer, and security-reviewer reports retain no conflicting
candidate.

The following were deliberately excluded:

- **Fixed C14-001 / Plan 141:** historical stateless counterfactual prefix
  replay is the behavior repaired by this delta. Default-safe proof handling,
  the callee-owned stateless gate, monotonic ownership, focused tests, and the
  independent live full-replay comparison all agree. Re-reporting it would
  duplicate completed work.
- **Fixed C14-002 / Plan 142:** the public completeness comment now describes
  all current false branches and the partial-array consequence. No remaining
  documentation contradiction was found.
- **Plan 138's conservative stateful unknown result:** non-additive
  max-use/fixed-per-day histories intentionally produce
  `portfolioCapLosses: undefined`. Existing sinks remain silent for unknown
  and known-zero results; that reviewed product decision is not a regression
  introduced here.
- **Broader greedy replay architecture debt:** the older incremental-optimizer
  work remains historically registered. Plan 141 removes only a separately
  proven stateless counterfactual prefix. The live differential supplied no
  new correctness failure or distinct performance root.
- **Prefixed/leading-NUL XLSX ZIP inflation:** explicitly rejected again
  absent new evidence. Archive admission still requires `PK` at byte zero
  (`packages/parser/src/shared/xlsx-archive.ts:118-132`), the Cycle 14
  corrected real-workbook probes took the non-ZIP/plaintext path, and this
  delta does not touch parsing.
- **Six protected untracked Cycle 42 artifacts:** they are outside exact HEAD,
  establish no current-tree defect, and were not edited, staged, or otherwise
  adopted by this lane.

## Final missed-file and interaction sweep

The closing pass re-read every changed line and every call site of the new
proof/classification fields, then swept the complete active inventory for:

- empty, one-row, invalid-index, collection-disabled, uncapped, zero-cap,
  tier-mismatch, unsupported-only, negative/zero-amount, non-KRW, and unsafe
  numeric paths;
- per-transaction, rule/shared monthly, card-global, `maxUses`, and
  fixed-per-day state; actual versus counterfactual ledgers; fallback and
  stacking behavior; duplicate transaction occurrences; and canonical
  ordering;
- monotonic unknown propagation, final stateful replay, partial arrays,
  known-zero versus unknown output, worker decoding, result coherence,
  persistence, browser/terminal/report disclosures, and public exports;
- card YAML validation, recommendation/execution availability, generated
  source identity, category/detail shards, README counts and claims; and
- parser/archive boundaries, worker cancellation, network/filesystem/LLM
  trust boundaries, dependencies, workflows, and deployment authority to
  ensure the bounded Cycle 14 delta did not create an indirect interaction.

No missed file, state transition, error path, generated-data drift, public
contract mismatch, historical duplicate, or genuinely new current-HEAD root
remained.

## Protected artifact integrity

```text
596dc91904a642bbfe5a5f5c338025023a1e5d0c2c92d9842353233c4fc0ac7a  .context/plans/67-high-priority-cycle42.md
272a70771bc14dbe131a8aef65907402c5f07f12fc0c798d535a5ef4a67ee4d1  .context/reviews/cycle42-aggregate.md
1dbdd1bdf8e2d672075e73e34b5b2043b33f74a36b938085b8efeafd03f03266  .context/reviews/cycle42-code-reviewer.md
6c6aa0d14a9129109341ac285de900bff8af8c38425a03f09e012206266c3df0  .context/reviews/cycle42-debugger.md
c7909307ce1387d617e9d7f51180a6eb8d7b12e1bfffe30bf5fe5dafdbd9a6a5  .context/reviews/cycle42-security-reviewer.md
c3fbf7a4ec5628902bce36af73f9d7c6b223c82e6d1360bac44e80d7612a3e9f  .context/reviews/cycle42-test-engineer.md
```

**Final count: 0 new findings.**
