# Aggregate Review — CherryPicker Review/Plan/Fix Cycle 13

**Date:** 2026-07-24
**Cycle:** 13 / 100
**Baseline:** `3e2d66320d213c7c8d7e33ef9a91f899ab70c0f9`
**Branch:** `codex/review-plan-fix-no-deploy-20260723`
**Deploy mode:** none
**Prompt 1 status:** complete
**Prompt 2 status:** complete
**Prompt 3 status:** complete

## Executive summary

Cycle 13 completed all thirteen selected review lenses: code reviewer,
performance reviewer, security reviewer, critic, verifier, test engineer,
tracer, architect, debugger, document specialist, designer, dependency expert,
and QA tester. Every role reviewed the exact baseline above, inventoried the
repository before sampling implementation paths, reconciled candidates against
the complete historical review and plan corpus, and performed a final
missed-issue sweep. No role failed.

Cross-report reconciliation retained **3 unique findings**. Repeated aliases
and confirmations were collapsed by root cause:

| Severity | Unique findings |
|---|---:|
| Medium | 2 |
| Low | 1 |
| **Total** | **3** |

All three findings have High confidence and executable or deterministic
current-HEAD evidence. Prompt 1 changed no product source, test, dependency,
configuration, generated artifact, plan, staged content, commit, deployment,
or external system. Its only writes were the thirteen Cycle 13 review reports,
this canonical aggregate, and the dated aggregate snapshot.

## Unique findings

| ID | Severity | Confidence | Finding | Primary raw source |
|---|---|---|---|---|
| C13-001 | Medium | High | An exact monthly or global cap hit followed by later eligible spend loses reward, but preview filtering discards the later cap-blocked candidate. The sole retained exact-hit event has equal actual and applied reward, so every disclosure sink falsely says there was no benefit loss. | `C13-CR-001` |
| C13-002 | Medium | High | Shared-cap coherence validation rebuilds maps and rescans the same immutable card rules on every calculator replay inside the greedy optimizer instead of validating each card once per optimization. | `RPF13-PERF-001` |
| C13-003 | Low | High | The frozen graph contains `@astrojs/markdown-remark@7.2.0` even though `astro@7.1.3` declares the present optional peer at exact version `7.2.1`; the dependency gate does not evaluate peer contracts. | `RPF13-DEP-001` |

## Evidence and downstream reach

### C13-001 — post-exhaustion reward loss disappears

`previewRuleAvailability()` marks a rule inapplicable when its monthly cap
group or the card-global cap has no remaining capacity. The rule then never
reaches reward execution, and no positive counterfactual reward or cap-blocked
reason survives. If an earlier transaction reached the cap exactly, the only
`CapInfo` has `actualReward === appliedReward`.

Live BC Card and Samsung Card fixtures reproduced the sequence. The calculator
returns the capped reward total, but browser, visualization, terminal, and
standalone-report formatters derive zero loss from the incomplete event stream
and render `혜택 손실 없음`. The affected calculation path is
`packages/core/src/calculator/reward.ts`; the public event model is
`packages/core/src/models/result.ts`; browser sinks are
`apps/web/src/lib/cap-disclosures.ts` and
`apps/web/src/components/ui/CapDisclosures.svelte`; terminal and report sinks
share `packages/viz/src/cap-disclosure.ts`.

The complete catalog contains 1,004 supported positive monthly-capped rules
across 371 cards, so this is not a synthetic-only state. Existing exact-cap
coverage explicitly expects only the first event and omits the later blocked
transaction. The event stream was sufficient before Cycle 12 added
analysis-wide disclosure copy, but it now makes that copy false. The repair
must preserve exclusive fallback selection while retaining an explicit,
typed, positive cap-blocked loss signal. Exact-at-end, clipped, zero-cap,
monthly, global, and fallback controls are required.

### C13-002 — structural validation in the replay loop

Cycle 12 correctly added `assertCoherentCapGroupMonthlyCaps()` to the public
calculator boundary. The helper scans supported rewards and tiers and builds
nested maps. The greedy optimizer repeatedly calls the calculator with the
same card-rule objects while scoring, assigning, computing alternatives,
constructing card results, and evaluating the best single card.

On the real 682-card optimizer artifact and 100 transactions, the current path
made 125,075 calculator calls and created 451,946 validation maps. Alternating
current-HEAD and isolated comparison runs returned byte-identical results, but
the current median was 267.6 ms versus 221.8 ms when only the repeated
already-valid-card check was bypassed, a 20.6 percent increase. An independent
verifier measured a 16.1 percent increase. At 1,000 transactions, the repeated
check added about 301.7 ms.

This is distinct from the deferred incremental-optimizer work: the replay
architecture can remain unchanged. The safe repair is an invocation-scoped,
opaque prepared-card path that validates each optimizer input once, while the
public `calculateRewards()` boundary continues to fail closed for arbitrary or
mutable direct input. A bare process-wide identity cache is insufficient
because callers can mutate previously validated rule objects.

### C13-003 — incompatible present optional peer

The 632-row lock graph contains 77 serialized peer contracts. A complete scan
found one mismatch: `astro@7.1.3` declares exact optional peer
`@astrojs/markdown-remark: 7.2.1`, while the graph resolves the present package
to `7.2.0`. `bun pm why @astrojs/markdown-remark` reports the same requirement
and installed version.

The current Astro configuration does not activate the legacy unified Markdown
path, so the impact is Low. The graph is nevertheless unsupported and a
frozen install preserves it. `scripts/check-dependencies.ts` checks direct
imports, remote references, and vendored integrity, but not peer presence or
compatibility. The repair must resolve the exact compatible peer and add a
lock-graph policy: required peers must be present and compatible; optional
peers may be absent, but must be compatible when present.

## Cross-agent agreement

| Aggregate ID | Independent confirmation | Resolution |
|---|---|---|
| C13-001 | code reviewer, critic, verifier, test engineer, tracer, architect, debugger, document specialist, designer, QA tester | Retained Medium/High. Real-card calculator output and every disclosure sink reproduce the false no-loss claim. |
| C13-002 | performance reviewer, critic, verifier, tracer, architect, debugger, QA tester | Retained Medium/High. Independent operation counts, timings, and output parity confirm lifecycle placement as the root cause. |
| C13-003 | dependency expert, verifier and deterministic full-lock scan | Retained Low/High. The exact present-peer mismatch is unique, while its code path is currently dormant. |

Repeated confirmations do not inflate the finding count. Every retained alias
maps to one aggregate root above.

## Rejected, qualified, and deduplicated hypotheses

- A shared `capGroup` spanning categories can make a group-level event look
  category-specific. The API-level risk is real, but the complete supported
  catalog has zero such groups. It remains a manual schema-risk note rather
  than a new current-product finding.
- The designer's same-category rule/cap identity observation is the completed
  Cycle 12 `C12-001` / Plan 129 root and was not reopened under a new name.
- The prefixed or leading-NUL XLSX ZIP-inflation hypothesis remains rejected.
  No reviewer found a path around offset-zero `PK` archive admission or new
  evidence that changes the historical decision.
- Security, buffer ownership, CSP, browser-stall, generic accessibility, and
  older deferred optimizer candidates produced no separate current-HEAD root.

## Designer evidence and exact cleanup

The designer inspected the production build in the owned browser session
`c13-designer-3e2d663`, using profile
`/tmp/cherrypicker-c13-designer.0LwxQG/profile`. The preview process was PID
and PGID `56129`; the owned Chrome root was PID `59664` in PGID `59663`.

After the attempt, only those exact owned process trees were closed. The
temporary directory was removed. Independent checks confirmed those PIDs were
gone, TCP 4173 was free, and
`bun scripts/run-e2e.ts status --assert-clean` passed. No unrelated browser or
repository process was signaled.

## Agent execution and provenance

All thirteen role reports completed through bounded reviewer rotations with no
unrecovered failure. Each report records the same baseline and branch, its
inventory and historical deduplication method, focused evidence, and final
sweep. No browser was relaunched after the designer cleanup.

The six protected untracked Cycle 42 artifacts remained byte-identical,
untracked, unstaged, and uncommitted throughout Prompt 1.

## Prompt 2 plan coverage

Prompt 2 verified that Cycle 12 Plans 129–137 were completed and moved only
those nine byte-identical files into `.context/plans/_archive/`. It created one
test-first implementation plan for each retained root:

| Planned file | Finding | Scope |
|---|---|---|
| `138-cycle13-post-cap-loss-telemetry.md` | C13-001 | Preserve typed post-exhaustion cap loss without changing fallback selection |
| `139-cycle13-prepared-cap-validation.md` | C13-002 | Validate optimizer cards once through an opaque prepared calculation path |
| `140-cycle13-optional-peer-validation.md` | C13-003 | Resolve the Astro peer and enforce present-peer compatibility in the dependency gate |

No retained Cycle 13 finding is deferred, rejected, or silently dropped.
Independent plan audits tightened Plan 138 around fallback-aware portfolio net
loss and optimizer transport, Plan 139 around exact invocation-local validation
counts and mutable-input safety, and Plan 140 around nearest peer resolution
without adding a dormant optional dependency.

The requested `ralph` capability is unavailable in this environment, so every
plan records the approved manual disciplined fallback: add a failing
regression, implement the smallest root fix, run focused green verification,
then run every required repository gate. Deployment remains none.

## Prompt 3 completion

All three retained findings were fixed test-first and pushed as signed commits:

- Plan 139 / C13-002:
  `4fa1385a3ba5f1b2f5104d0d3e100ae2eb16264b`
- Plan 140 / C13-003:
  `b25b462ec08082d4ce6dc5d3c04ae175c4ed65c0`
- Plan 138 / C13-001:
  `d7ffac339159187b57b827f9fe5d1b7518289786`

Plan 138 now distinguishes exact, known-zero portfolio loss from unknown
telemetry, reconciles cap suppression against the real cap-free winner, and
keeps every dashboard, result, in-app report, terminal, standalone report,
worker, persistence, and duplicate-transaction path coherent. An independent
final audit exercised 13,120 randomized/exhaustive two-card cases and 2,000
prepared replay/projection cases with zero known-loss or visible-output
mismatches. A 12,000-transaction persistence probe remained under the 4 MiB
limit by omitting oversized telemetry as unknown.

The prepared calculation path removes repeated structural rule validation
without weakening the public calculator boundary. Nine samples per revision
over 683 cards found the 90- and 100-transaction paths 18–20 percent faster
than the Cycle 12 baseline, with exact JSON parity after normalizing only the
new telemetry. The dependency repair removed Astro's stale optional peer and
added package-path-aware, fail-closed peer validation.

After the implementation freeze, sequential final verification passed:

- `bun run lint`
- `bun run typecheck`
- `bun run build` (7/7)
- `bun run test`
- `bun run test:bun` (1,641/1,641; 3,319 assertions)
- `bunx vitest run` (126 files; 3,105/3,105)
- `bun run verify`
- `bun run test:e2e` (97/97)

An initial concurrent gate attempt starved the scraper subprocess and produced
a five-second timeout in both Bun and Vitest. Sequential reruns completed
green; the isolated subprocess took 554 ms, so no product fix was required.
The E2E runner ended clean, TCP 4173 was free, and no owned browser, preview,
Playwright, or runner process remained. The six protected untracked Cycle 42
artifacts stayed byte-identical, untracked, unstaged, and uncommitted.
Deployment was not performed.
