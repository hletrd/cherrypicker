# Plan 138: Cycle 13 Post-Cap Loss Telemetry

**Finding:** C13-001 (`C13-CR-001`, Medium/High)
**Status:** completed
**Deploy mode:** none

## Evidence

- `previewRuleAvailability()` removes an otherwise eligible rule when its
  monthly cap group or card-global cap has no remaining capacity.
- A later positive counterfactual reward and its cap-blocked reason therefore
  never reach reward execution or `capsHit`.
- When an earlier transaction reached the cap exactly, the only retained event
  has equal actual and applied reward. Browser, terminal, and standalone
  disclosures consequently render `혜택 손실 없음` for an analysis that did
  lose a later reward.
- Live BC Card and Samsung Card rules reproduce the sequence. The supported
  catalog contains 1,004 positive monthly-capped rules across 371 cards.
- Existing exact-exhaustion coverage explicitly expects the later blocked
  transaction to produce no event, so green baseline tests do not protect the
  new disclosure contract introduced by Plan 136.

## Outcome

The calculator preserves typed, transaction-identified cap suppression, while
the optimizer reconciles that suppression against the selected fallback and
the best reward available from another card. A new top-level optimization loss
contract reports true net portfolio loss, not gross candidate suppression.
Presentation layers derive analysis-loss copy only from that authoritative
contract. Existing `capsHit` continues to describe cap reach and clipping on
assigned card results.

## Implementation

1. Add red numeric regressions for:
   - 5,000 Won blocked with no fallback, producing exactly 5,000 Won net loss;
   - 5,000 Won blocked with a 2,000 Won lower-priority fallback, preserving the
     total and producing one 3,000 Won record;
   - 5,000 Won blocked on card A with 3,000 Won selected on card B, producing
     one 2,000 Won portfolio record;
   - an equal or better fallback or other card, producing no net loss;
   - two capped exclusive alternatives, retaining only the highest ordered
     counterfactual;
   - two blocked additive rules, retaining both genuine additive losses.
2. Include exact monthly exhaustion followed by later eligible spend, exact
   global exhaustion followed by later eligible spend, all-unassigned
   zero-cap input, and live BC Card and Samsung Card witnesses.
3. Replace the binary availability preview with a typed result that
   distinguishes ordinary inapplicability, unsupported definitions,
   executable rules, and positive candidates suppressed by a specific cap.
   Carry transaction, rule, group, category, cap, and counterfactual reward
   identity without mutating occurrence or fixed-per-day state.
4. Define stage semantics explicitly. Per-transaction suppression compares the
   uncapped reward with the per-transaction result; monthly suppression
   compares the post-per-transaction reward with the monthly result; global
   suppression compares the post-monthly reward with the global result. When a
   candidate is already fully blocked and several caps are exhausted, record
   only the first blocking stage in that precedence.
5. For each exclusive group, retain only the highest ordered suppressed
   candidate, continue to the existing executable fallback, and subtract that
   same-card fallback reward from gross suppression. Preserve every independent
   additive suppression. Do not count mutually exclusive alternatives as
   simultaneous losses.
6. Add an internal calculator suppression stream separate from `capsHit`.
   Existing exact-hit and clipped `CapInfo` behavior stays intact. Suppression
   records must have transaction identity so repeated optimizer replays can be
   deduplicated deterministically.
7. During scoring, retain current-transaction suppression for every candidate
   card before zero-marginal transactions take the unassigned path. Reconcile
   the best cap-free counterfactual across cards with the actual best selected
   reward. Emit only the winning counterfactual's deterministic records and
   allocate any other-card replacement reward so their `netLostReward` sum
   equals the portfolio difference.
8. Add a typed top-level optimization loss array with card, transaction, rule,
   cap, gross-suppression, replacement-reward, and net-loss fields. Thread it
   through the worker decoder, analysis coherence, persistence and legacy
   decoding, store replacement, and CLI/report inputs. It must not be forced
   into `cardResults[].capsHit`, whose coherence is assignment-scoped.
9. Render true net loss from the top-level contract on dashboard, results,
   in-app report, terminal, and standalone report. Narrow existing exact-hit
   `capsHit` copy so it never makes an analysis-wide no-loss claim.
10. Add controls for occurrence/day state, exact exhaustion at the final
    transaction, clip plus later block, declared zero caps, both monthly cap
    types, global caps in a different unassigned category, repeated
    per-transaction events, replay deduplication, and unchanged fallback
    selection.

## Acceptance

- [x] Exact cap exhaustion followed by later eligible spend records the exact
      positive net portfolio loss.
- [x] An exact hit on the final eligible transaction still records zero lost
      reward.
- [x] Monthly and global post-exhaustion events identify the real blocking cap
      and preserve deterministic order.
- [x] Exclusive fallback reward selection and total reward remain unchanged.
- [x] Mutually exclusive alternatives are not counted as simultaneous losses.
- [x] A 5,000 Won suppressed candidate with a 2,000 Won fallback reports
      exactly 3,000 Won, and a 3,000 Won other-card reward also reduces the
      portfolio loss to exactly 2,000 Won.
- [x] Equal or better replacement reward produces no net-loss record.
- [x] Independent additive losses remain independently represented.
- [x] Zero-reward unassigned transactions can carry loss without violating
      assignment/card-result coherence.
- [x] Dashboard, results, in-app report, terminal, and standalone report no
      longer claim no loss for the reproduced analysis.
- [x] Existing telemetry, optimizer, persistence, and legacy compatibility
      tests remain green.

## Verification

Run the focused core exact-cap, optimizer, analysis-coherence, persistence,
worker, browser cap-disclosure, CLI, and visualization suites first. Then run
`bun run lint`, `bun run typecheck`, `bun run build`, `bun run test`,
`bun run test:bun`, `bunx vitest run`, and `bun run verify`. Finish with
`bun run test:e2e`, `bun scripts/run-e2e.ts status --assert-clean`, TCP 4173,
and exact owned process-tree cleanup checks.

## Execution note

The requested `ralph` capability is unavailable. Prompt 3 will use the approved
manual disciplined fallback: add a focused failing regression, implement the
smallest root fix, run focused green verification, and then run every required
repository gate. No deployment is permitted.

## Completion evidence

Completed in signed commit
`d7ffac339159187b57b827f9fe5d1b7518289786`.

- The calculator now carries typed transaction-level suppression causes while
  preserving the existing assignment-scoped `capsHit` contract.
- The optimizer publishes a duplicate-safe top-level
  `portfolioCapLosses` array only when reconciliation is exact. `undefined`
  means unknown; `[]` means known zero.
- Ordered `maxUses` and fixed-per-day counterfactuals are replayed
  deterministically. Hidden or cross-card state interactions, negative
  offsets, unsafe arithmetic, and cap-free winner ties fail closed to unknown
  instead of publishing a positive-only overstatement.
- Dashboard, results, in-app report, terminal, and standalone report share the
  Korean net-loss copy and remain silent for unknown or known-zero telemetry.
- Worker decoding, current/legacy persistence, duplicate transaction
  occurrences, stable transaction editing, and the 4 MiB persistence bound
  have focused regressions. Oversized loss telemetry is omitted as a whole so
  reload preserves unknown; an irreducibly oversized snapshot fails before a
  storage write.
- Independent final audit exercised 13,120 randomized/exhaustive two-card
  state/cap/rate/date/card-ID cases and 2,000 prepared replay/projection cases
  with zero known-loss or visible-output mismatches.
- Final verification passed core 312/312, web 905/905, visualization 24/24,
  `test:bun` 1,641/1,641, Vitest 3,105/3,105, the repository `verify` gate,
  and E2E 97/97. The E2E runner finished clean with TCP 4173 free.
