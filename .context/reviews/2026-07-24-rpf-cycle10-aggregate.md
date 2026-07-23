# Aggregate Review — CherryPicker Review/Plan/Fix Cycle 10

**Date:** 2026-07-24
**Cycle:** 10 / 100
**Baseline:** `56c0f1fcd5b670b20cd972556199f37e3f382d8d`
**Branch:** `codex/review-plan-fix-no-deploy-20260723`
**Deploy mode:** none

## Executive summary

Cycle 10 completed all eleven required review lenses: code reviewer,
performance reviewer, security reviewer, critic, verifier, test engineer,
tracer, architect, debugger, document specialist, and designer. The repository
contains an Astro/Svelte UI, so the designer performed one bounded live browser
interaction after the complete available agent-browser skill family was read.
No custom reviewer definitions exist under `.claude/agents`.

The role reports contain **9 raw findings**, which deduplicate to **9 unique
findings**: 8 Medium and 1 Low. The verifier independently confirmed the first
eight findings, and the tracer independently confirmed all nine after the
debugger's late dotted-card-ID finding arrived.

| Severity | Unique findings |
|---|---:|
| Medium | 8 |
| Low | 1 |
| **Total** | **9** |

## Unique findings

### Calculation, optimization, and result integrity

| ID | Severity | Confidence | Finding | Raw source |
|---|---|---|---|---|
| C10-001 | Medium | High | Short ASCII categorizer aliases such as `cu`, `kt`, and `skt` use unrestricted substring matching. Unrelated merchant words can receive a false category and a real category-based card reward. This is a distinct categorizer path left open by Cycle 9 Plan 114's broader acceptance wording. | `C10-CR-001` |
| C10-002 | Medium | High | Alternative-card counterfactuals append a proposed transaction group after the candidate's existing transactions without the canonical reward-fact sort, so stateful uses and caps can omit or misstate alternatives. | `C10-CR-002` |
| C10-003 | Medium | High | Current v4 persistence accepts snapshots with no previous-spending basis, including coordinated deletion of the redundant option. Disclosure disappears and later reoptimization can silently switch from a user-entered basis to statement-derived spending. | `C10-CR-003` |
| C10-004 | Medium | High | Fresh analysis performs the same exhaustive, allocation-heavy transaction coherence validation twice on the main thread after worker optimization; reachable six-figure inputs produce hundreds of milliseconds to more than one second of blocking. | `RPF10-PERF-001` |
| C10-005 | Medium | High | Supported unitless mileage rules are calculated, optimized, and rendered as Won despite promising miles and having no explicit miles-to-Won valuation contract. This reopens and strengthens the historical C14-09 contract failure. | `RPF10-DOC-001` |

### Trust, presentation, runtime settlement, and navigation

| ID | Severity | Confidence | Finding | Raw source |
|---|---|---|---|---|
| C10-006 | Medium | High | The scraper lets the untrusted model author `card.url`; quarantine leaves that URL intact, publication carries it forward, and the catalog labels any syntactically safe value as the official card page. | `RPF10-SEC-001` |
| C10-007 | Medium | High | Card details discard supported reward identity and structured eligibility conditions. Distinct merchant-scoped rules can render as indistinguishable broad-category rows, while the grid calls a unique-category count a benefit count. | `C10-CT-001` |
| C10-008 | Low | High | A cloneable malformed optimizer worker response is read without runtime decoding or a guarded settlement path. Values such as `null` throw in the listener, leave the promise pending, retain listeners, and keep the worker alive. | `C10-CT-002` |
| C10-009 | Medium | High | Canonical card IDs allow dot-separated segments, but card navigation uses a private hyphen-only regex. Eight published cards throw on list selection and cannot be opened by deep link. | `C10-DBG-001` |

## Cross-agent agreement and deduplication

| Aggregate ID | Independent confirmation | Resolution |
|---|---|---|
| C10-001 | verifier, tracer | Preserved at Medium/High. It is a real categorizer-to-reward defect, qualified as incomplete cross-surface closure of Plan 114 rather than a regression in the fixed merchant-allowlist path. |
| C10-002 | verifier, tracer | Preserved at Medium/High with the reproduced `maxUses: 1` counterfactual and signed-delta requirement. |
| C10-003 | verifier, tracer | Preserved at Medium/High across deserialize, disclosure, and reload-then-reoptimize behavior, including truncated-result coverage. |
| C10-004 | verifier, tracer | Preserved at Medium/High. Independent 100,000-row probes confirmed duplicate post-worker main-thread work. |
| C10-005 | verifier, tracer | Preserved at Medium/High and explicitly classified as a reopened/strengthened C14-09 valuation-contract failure. |
| C10-006 | verifier, tracer | Preserved at Medium/High through extraction, publication, and final external-link rendering. |
| C10-007 | verifier, tracer | Preserved at Medium/High with production LOCA LIKIT Eat rows that lose distinct labels and merchant scopes. |
| C10-008 | verifier, tracer | Preserved at Low/High and kept distinct from Cycle 9's `messageerror` settlement fix because the malformed value arrives through an ordinary cloneable `message`. |
| C10-009 | tracer | Preserved at Medium/High after an independent production-catalog scan reproduced all eight affected IDs and both click/direct-query failures. |

Every raw finding maps to exactly one aggregate item. No severity or confidence
was downgraded during aggregation. The architect, test engineer, designer, and
tracer produced no additional unique findings; the verifier produced no new
finding and rejected none of the eight candidates available during its run.

## Rejected and deduplicated competing hypotheses

- The leading-NUL/prefixed-XLSX inflation hypothesis remains rejected.
  Non-`PK` input follows SheetJS's plaintext/PRN route and does not enter ZIP
  inflation.
- Renamed or partially overlapping uploads can remain a product concern, but
  the causal duplicate-ingestion issue already exists in historical review
  provenance and was not relabeled as new.
- Timezone-bearing ISO timestamps are rejected by the current strict date
  contract; accepting them would be a feature expansion, not a current bug.
- Generation and abort ownership prevented the traced stale-result overwrite
  variants, and source-hash pinning rejected rather than merged mixed catalog
  generations.
- A direct-call persistence probe containing an invalid-date transaction was
  rejected because all reachable parser paths exclude that row before analysis
  state.
- A narrow annual-fee wording ambiguity did not meet the materiality threshold.
- The designer's bounded valid-analysis attempt did not reach success within
  its wait, but it established neither a reproducible timeout nor a causal
  failure and was recorded only as a coverage limitation.

## Validation and live evidence

Review roles ran repository lint/typecheck, 2,952 non-browser tests, focused
core/web/scraper/publication suites, security/dependency checks, data/document
checks, and executable reproductions. These green baseline checks establish
that the findings are missing cross-path contracts rather than already-covered
failures.

The designer's one isolated live preview sampled the home/upload surfaces,
desktop layout and overflow, validation, theme behavior, keyboard skip
navigation, accessibility-tree structure, and runtime errors. The observed
surfaces were clean; the skip link focused the main landmark. The analysis
success state was not observed in the bounded interval and is not overclaimed.

The owned preview used runner PID/PGID `55343` with Astro listener PID `55438`
on `127.0.0.1:4173`. The owned browser used session
`cherrypicker-c10-designer`, profile
`/tmp/cherrypicker-c10-designer-profile.TRP7GO`, agent-browser daemon
PID/PGID `61867`, and Chrome root PID `61868`. The browser session was closed,
the exact owned preview PGID was terminated, and only the exact profile was
removed after confirming it was unused. Final checks reported an empty E2E
ownership registry, port 4173 free, no active agent-browser sessions, and no
attributable repository/profile process. No unrelated Travelback process or
profile was signaled or removed.

## Agent execution notes

All eleven role reports completed. Concurrency limits were handled through four
reusable reviewer threads with bounded rotations: code reviewer → critic →
tracer; performance reviewer → architect → debugger; security reviewer →
document specialist → designer; and test engineer → verifier. The designer's
initial finalization turn did not return promptly after its browser session
closed, so it was interrupted; exact cleanup was completed independently, and
a report-only retry verified the saved designer provenance without relaunching
a browser. There are no unrecovered role failures.

## Plan coverage

Prompt 2 archived completed Cycle 9 Plans 114–119 and created five Cycle 10
plans. Every unique finding is scheduled exactly once:

| Plan | Findings | Scope |
|---|---|---|
| 120 | C10-001, C10-002 | Shared merchant boundaries and canonical alternative ordering |
| 121 | C10-003, C10-004 | Required spending provenance and single-pass validated-result flow |
| 122 | C10-006, C10-009 | Trusted scraper URL provenance and canonical card-ID navigation |
| 123 | C10-007, C10-008 | Condition-complete card details and runtime worker settlement |
| 124 | C10-005 | Mileage valuation fail-closed across data, calculation, and publication |

No Cycle 10 finding is deferred or silently dropped. The requested `ralph`
skill is not registered in the available skill roots, so every plan records a
manual test-first fallback.

## Prompt 3 implementation closure

All five plans are implemented with every acceptance item checked:

- Plan 120 centralizes normalized merchant boundaries across categorization
  and reward matching, then canonicalizes all optimizer reward inputs and
  signed alternative deltas.
- Plan 121 requires exact previous-spending provenance in current and
  persisted results, brands producer-validated results for one exhaustive
  fresh-analysis scan, and keeps untrusted/edit-time validation linear and
  fail closed.
- Plan 122 removes model authority over official card URLs, rejects
  unreviewed LLM-scraped destinations at canonical publication boundaries,
  and uses the browser-safe canonical card-ID grammar for navigation.
- Plan 123 preserves supported reward identity and all structured eligibility
  conditions in card details, corrects benefit-area copy, and runtime-decodes
  every ordinary optimizer worker response through one cleanup path.
- Plan 124 quarantines all mileage rewards until a program-aware Won valuation
  exists, adds calculator and catalog defenses, presents the valuation reason
  in user-facing card details, and regenerates all catalog projections and
  issuer documentation.

The integrated Cycle 10 regression run passed 676 tests across 37 files with
4,257 expectations. `bun run data:check` verified 683 cards and 551
optimizer-executable cards, `bun run web:build:check` built all five routes and
passed the browser bundle budget, and the integrated web typecheck reported
zero errors, warnings, or hints. Final repository-wide gates, signed-commit
verification, and remote parity are recorded after the final gate pass.

The final combined-diff review found one presentation gap before the full
gates: card detail discarded the mileage valuation reason and used generic
condition wording. Gate Fix 1 added an exact Korean no-Won-conversion
disclosure, wired it to each unsupported reward reason, and added
artifact-to-presentation coverage. Ten focused card-detail tests and the
integrated web typecheck passed after the correction.

## Final missed-issue sweep

Each role recorded an inventory, duplicate-control search, and closing sweep.
The aggregate rechecked all raw IDs, exact current-file evidence, prior-history
qualifications, rejected hypotheses, protected-file scope, and browser
ownership. All nine unique findings remain reproducible and actionable; no raw
finding is silently omitted.
