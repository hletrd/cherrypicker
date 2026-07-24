# Aggregate Review — CherryPicker Review/Plan/Fix Cycle 14

**Date:** 2026-07-24
**Cycle:** 14 / 100
**Baseline:** `5260bbd9b6f44ff35cf1bb9a11819354003e5161`
**Branch:** `codex/review-plan-fix-no-deploy-20260723`
**Deploy mode:** none
**Prompt 1 status:** complete
**Prompt 2 status:** complete
**Prompt 3 status:** pending

## Executive summary

Cycle 14 completed all thirteen selected review lenses: code reviewer,
performance reviewer, security reviewer, critic, verifier, test engineer,
tracer, architect, debugger, document specialist, designer, dependency expert,
and QA tester. Every role reviewed the exact baseline above, inventoried the
repository, reconciled candidates against current and archived review/plan
history, and performed a closing missed-file sweep. No role failed.

The thirteen reports contain **8 raw finding entries**: seven aliases or
independent confirmations of the same performance root and one documentation
entry. Cross-report reconciliation retained **2 unique findings**:

| Severity | Unique findings |
| --- | ---: |
| Medium | 1 |
| Low | 1 |
| **Total** | **2** |

Both findings are High confidence and confirmed by current-HEAD source and
executable evidence. Prompt 1 changed no product source, test, dependency,
configuration, generated artifact, plan, commit, deployment, or external
system. Its only repository writes were the thirteen Cycle 14 role reports and
this aggregate.

## Unique findings

| ID | Severity | Confidence | Finding | Primary raw source |
| --- | --- | --- | --- | --- |
| C14-001 | Medium | High | Append-only cap telemetry rebuilds the cap-free selection and completeness path for every historical row of capped stateless cards, even though the optimizer already reconciled the prefix and only the appended row can emit. | `RPF14-PERF-001` |
| C14-002 | Low | High | Public `CalculationOutput.capSuppressionsComplete` documentation says false means safe-integer overflow only, although ordered stateful/reconciliation failures also return false and may leave a partial suppression array. | `C14-DOC-001` |

## Evidence and reach

### C14-001 — reconciled stateless prefixes repeat cap-free work

`scoreCardsForTransaction()` replays each card's assigned transactions plus
one appended row and passes the prefix length as
`capSuppressionStartIndex`. The calculator uses the index only to gate
emission. It still builds counterfactual candidates and stacking groups,
copies map/set state, projects cap-free rules, accumulates transaction reward,
and reconciles completeness for all older rows.

The compiled artifact has 551 optimizer-executable cards, 383 capped
executable cards, and only two stateful executable cards. Independent
1,000-row probes counted 322,389 to 340,779 avoidable old-row
counterfactuals, at least roughly one million directly counted map/set
allocations in the primary lane, and 134–291 ms of host-dependent savings.
All complete optimizer JSON, loss knownness, and 2,000/10,000-case randomized
comparisons remained exact. Browser work stays in an owned worker but completes
later and uses more CPU; CLI optimize/report pays synchronously.

The safe boundary is narrower than the start index. A direct prepared-call
fixture with a capped higher-priority reward and stronger uncapped fallback
returns reward 500, no emitted rows, and
`capSuppressionsComplete: false`. An unproved stateless prefix skip changes
that result to true. The optimizer alone owns the monotonic fact that every
assigned prefix row was reconciled while
`portfolioCapLossesComplete` remained true.

The fix must therefore default to full replay, accept an optimizer-only
prior-prefix claim, independently require the branded prepared card to be
stateless, and skip only rows before the exact append boundary. Actual history,
the appended row, all `maxUses` and fixed-per-day histories, public/direct
calculation, final stateful replay, arithmetic guards, and output knownness
must remain unchanged.

This root is new. Plan 139 removed repeated immutable rule-structure
validation before replay; this work begins later inside the counterfactual
body added by telemetry commit `d7ffac3`. Deferred incremental-optimizer items
own the older actual-history multiplier, which this repair does not change.

### C14-002 — completeness comment narrows a broader fail-closed contract

`CalculationOutput` is returned by public `calculateRewards()` and exported
from `@cherrypicker/core`. Its field comment says
`capSuppressionsComplete` is false when safe-integer arithmetic would be
exceeded. That is one cause, not the full contract.

The calculator also sets false when an ordered cap-free stateful path produces
a later negative offset that cannot be expressed honestly as independent
positive suppression rows, and for other reconciliation failures. The exact
Cycle 13 fixture returns a safe total reward of 9,000, one valid suppression
row, and `capSuppressionsComplete: false`; the array is partial rather than
empty.

The behavior is correct and the optimizer fails closed to
`portfolioCapLosses: undefined`. The risk is developer interpretation through
the public type. The stable fix is consequence-based TSDoc: false means the
array is not a complete exact diagnostic and may still contain partial rows.
Runtime, schema, persistence, and presentation behavior must not change.

The field and incomplete comment were added together after the Cycle 13
document-review baseline. Historical generic missing-JSDoc notes do not own a
new field with specifically misleading causal wording.

## Cross-agent agreement

| Aggregate ID | Independent confirmation | Resolution |
| --- | --- | --- |
| C14-001 | performance reviewer, critic, verifier, tracer, architect, debugger, QA tester | Retained Medium/High. Multiple isolated implementations removed only the proven stateless prefix, preserved full JSON/knownness, and reproduced the unsafe direct-call counterexample. |
| C14-002 | document specialist and independent QA re-adjudication | Retained Low/High. Public type, implementation branches, blame, and the partial-array stateful test contradict the overflow-only comment. |

Repeated aliases do not inflate the unique count. Code, security, test,
designer, and dependency reports found no additional root.

## Rejected, qualified, and deduplicated hypotheses

- Treating `capSuppressionStartIndex` or statelessness alone as a proof was
  rejected because direct prepared calls can become falsely complete.
- Skipping actual history or stateful counterfactual history was rejected.
  Actual cap state, `maxUses`, and fixed-per-day reservations affect later
  rows.
- The broader quadratic greedy replay remains historically deferred. C14-001
  removes only the later separable counterfactual body.
- Cycle 13's prepared-card validation root is fixed and distinct. The current
  structural validation count remains one per optimizer card.
- Conservative `portfolioCapLosses: undefined` for negative/stateful offsets
  is Plan 138's intentional fail-closed contract, not a correctness defect.
- The designer's mobile-menu trigger was present, visible, focusable, and
  keyboard-operable at 375 px. Its omission from one agent-browser
  accessibility snapshot was a known tool anomaly, not a product finding.
- Security, persistence, worker, disclosure, parser, dependency, advisory,
  workflow, generated-data, and user-documentation sweeps produced no separate
  current root.
- The prefixed/leading-NUL XLSX inflation hypothesis remains explicitly
  rejected. ZIP metadata admission still requires `PK` at byte zero, and
  corrected probes take the non-ZIP/plaintext path without archive inflation.

## Designer evidence and exact cleanup

The designer inspected the production build in isolated session
`c14-designer-5260bbd`, using profile
`/tmp/cherrypicker-c14-designer-profile.HF5Jqz` and artifact directory
`/tmp/cherrypicker-c14-designer-artifacts.jxatLB`. The preview PID/PGID was
`87082/87082`; the agent-browser daemon/root was `90733/90736` in PGID
`90733`.

After the audit, only those exact owned process trees and session were closed.
Independent parent and Cycle 14 checks confirmed the session list empty, all
recorded PIDs absent, both temporary paths absent, TCP 4173 free, and
`bun scripts/run-e2e.ts status --assert-clean` passing. Unrelated user Chrome
PID/PGID `1368/1368` remained untouched. No browser or server was relaunched.

## Agent execution and provenance

All thirteen report roles completed through bounded rotations with no
unrecovered error. The dependency lane used one bounded child audit and
reconciled it into the single dependency-expert report. A late QA
re-adjudication independently confirmed C14-002 without creating an additional
raw report entry.

The six protected untracked Cycle 42 artifacts remained byte-identical,
untracked, unstaged, and uncommitted throughout both prompts.

## Prompt 2 plan coverage

Prompt 2 verified that Cycle 13 Plans 138–140 were complete and moved those
three byte-identical files into `.context/plans/_archive/`. It created one
implementation plan per retained root:

| Planned file | Finding | Scope |
| --- | --- | --- |
| `141-cycle14-reconciled-stateless-cap-prefix.md` | C14-001 | Default-safe optimizer proof, row-local stateless prefix bypass, operation-count and knownness regressions |
| `142-cycle14-cap-suppression-completeness-doc.md` | C14-002 | Consequence-based public completeness TSDoc with existing behavioral controls |

No retained finding is deferred, rejected, or silently dropped. Plan 141
locks the optimizer-owned proof, exact append boundary, stateless callee gate,
ordinary-call default, stateful histories, and full-output parity. Plan 142
changes documentation only.

The requested `ralph` capability is unavailable. Both plans record the
approved manual disciplined fallback: establish or retain deterministic
regressions, make the smallest root fix, run focused verification, then run
every required repository and E2E gate. Deployment remains none.

## Prompt 3

Pending.

## Protected artifact hashes

```text
596dc91904a642bbfe5a5f5c338025023a1e5d0c2c92d9842353233c4fc0ac7a  .context/plans/67-high-priority-cycle42.md
272a70771bc14dbe131a8aef65907402c5f07f12fc0c798d535a5ef4a67ee4d1  .context/reviews/cycle42-aggregate.md
1dbdd1bdf8e2d672075e73e34b5b2043b33f74a36b938085b8efeafd03f03266  .context/reviews/cycle42-code-reviewer.md
6c6aa0d14a9129109341ac285de900bff8af8c38425a03f09e012206266c3df0  .context/reviews/cycle42-debugger.md
c7909307ce1387d617e9d7f51180a6eb8d7b12e1bfffe30bf5fe5dafdbd9a6a5  .context/reviews/cycle42-security-reviewer.md
c3fbf7a4ec5628902bce36af73f9d7c6b223c82e6d1360bac44e80d7612a3e9f  .context/reviews/cycle42-test-engineer.md
```
