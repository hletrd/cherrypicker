# Aggregate Review — CherryPicker Review/Plan/Fix Cycle 12

**Date:** 2026-07-24
**Cycle:** 12 / 100
**Baseline:** `e72a4c69f7c0eab7053c61a587c2d040760c236c`
**Branch:** `codex/review-plan-fix-no-deploy-20260723`
**Deploy mode:** none
**Prompt 1 status:** complete
**Prompt 2 status:** complete
**Prompt 3 status:** complete

## Executive summary

Cycle 12 completed all eleven required review lenses: code reviewer,
performance reviewer, security reviewer, critic, verifier, test engineer,
tracer, architect, debugger, document specialist, and designer. The repository
also contains established dependency-expert and QA-tester reviewer styles, so
both were run as additional lanes. No custom reviewer definitions exist under
`.claude/agents`.

The specialist reports produced **10 concrete raw candidates**. Cross-report
deduplication and independent verifier reproduction retained **9 unique
findings** and rejected **1 historical duplicate**.

| Severity | Unique findings |
|---|---:|
| Medium | 6 |
| Low | 3 |
| **Total** | **9** |

Every retained finding has High confidence. Prompt 1 made no source, test,
configuration, generated-data, plan, staging, commit, push, deployment, or
external-system change. The only repository writes were Cycle 12 review
artifacts and this aggregate.

## Unique findings

| ID | Severity | Confidence | Finding | Raw source |
|---|---|---|---|---|
| C12-001 | Medium | High | `capGroup` is used both as a shared monthly-cap bucket and as rule execution identity. Differing caps become transaction-order dependent, and independent same-day fixed rewards in one group suppress each other. Catalog validation accepts both states. | `C12-CR-001` |
| C12-002 | Low | High | Standalone HTML reports label every cap as `월 한도`, including real `per_transaction` events. | `C12-CR-002` |
| C12-003 | Low | High | The scraper accepts the first existing content selector before trimming it. A whitespace-only `<main>` blocks a populated later selector and sends empty content to extraction. | `C12-CR-003` |
| C12-004 | Medium | High | The CLI consent boundary eagerly reads and copies every statement before ordinary local parsing, creating multiple statement-sized buffers even when remote fallback is disabled. | `RPF12-PERF-001` |
| C12-005 | Medium | High | The 14 px source hostname uses a muted foreground on issuer-tinted headers and fails the 4.5:1 normal-text contrast threshold in the light theme. | `RPF12-D-001` |
| C12-006 | Medium | High | The root `parse` script executes an export-only barrel, consumes no input, produces no parse result, and exits zero even for a nonexistent statement. | `RPF12-DOC-001` |
| C12-007 | Low | High | The scraper system prompt and schema-contract test falsely say the trusted boundary records `url`; runtime deliberately deletes model-authored URL data and stamps only issuer, date, and source. | `RPF12-DOC-002` |
| C12-008 | Medium | High | Dashboard, results, and the in-app/print report preserve `cardResults[].capsHit` but never render cap-hit or lost-benefit explanations. | `C12-CT-001` |
| C12-009 | Medium | High | Automated verification and browser regression run only after a change reaches `main` or on manual dispatch. Pull requests receive no automated pre-merge status, and workflow contract tests do not inspect triggers. | `RPF12-TE-001` |

## Evidence and downstream reach

### C12-001 — shared-cap identity and coherence

`buildRuleKey` prefers `capGroup`, then uses that one key for monthly
accumulation, daily fixed-reward tracking, availability preview, and cap
telemetry. A schema-valid two-rule fixture with differing monthly caps produced
200 or 100 Won after transaction order reversal. A coherent-cap fixture with
two independent `fixed_per_day` rules produced only 100 or 200 Won instead of
the independent 300 Won total. The catalog validator checks each rule in
isolation and does not enforce shared-group tier-cap coherence. This begins
before Cycle 11's plural cap telemetry repair and is therefore distinct.

### C12-002 — standalone cap-period wording

A real `per_transaction` cap event renders as `월 한도 ... 도달`. The amount
and calculated lost benefit are correct, but the period is false and can make
later purchases appear ineligible. This is distinct from C12-008: the
standalone sink renders an event with incorrect wording, while browser sinks
render no event.

### C12-003 — scraper selector fallback

Cheerio returns whitespace text for an existing empty `<main>`. The current
loop treats that raw string as selected content and stops before `#content`;
normalization then reduces it to an empty string. The CLI does not reject the
empty result, so the LLM request still occurs. Publication quarantine remains
intact, but it cannot recover the discarded source content or request cost.

### C12-004 — statement-buffer ownership

The local-first wrapper converts the full read result with `Buffer.from`, then
returns another `Buffer.from` to the parser and a copied prefix. An 8 MiB
identity probe confirmed separate backing buffers; the performance reviewer
measured 417.2 MiB maximum RSS for a 128 MiB input versus a 161.5 MiB control.
All analyze, optimize, and report commands use this path, and no statement-size
limit bounds the amplification. Consent must remain bound to the exact bytes,
but ordinary local parsing does not require eager remote-consent capture.

### C12-005 — source-hostname contrast

The hostname foreground is `#64748b`. It reaches about 3.67:1 on the strongest
declared Shinhan tint and 3.89:1–3.95:1 on sampled production pixels, below the
4.5:1 requirement for normal 14 px text. The tracer extended the deterministic
calculation across all 24 issuer tint colors and confirmed the same failure
class. The hostname is the destination/provenance cue added after Plan 128, so
the finding has no earlier owner.

### C12-006 — no-op root parse command

`bun run parse -- ./definitely-not-a-statement.csv` exits zero without reading
the missing path. The script targets `packages/parser/src/index.ts`, an
export-only module, instead of a real CLI entry point. The result is a
successful command that performs no advertised parsing and masks bad input.

### C12-007 — false scraper trust-boundary wording

The system instruction tells the model not to provide `url` because the
scraper records it. Runtime instead removes model-authored URLs and stamps only
issuer, `lastUpdated`, and `source`, matching the safer Cycle 10 boundary. The
current test preserves the false sentence rather than the true contract.

### C12-008 — browser cap disclosure

Cap events survive calculator, optimizer, worker, persistence, coherence, and
store boundaries. A real `bc-baro-on-off` transaction produced an uncapped
2,000 Won dining reward clipped to 1,000 Won by a supported per-purchase cap.
Dashboard, results, and `ReportContent` show the correct 1,000 Won outcome but
not the 1,000 Won clip or its period. Terminal and standalone output already
disclose these events, proving the data is available at the browser sinks.

### C12-009 — missing pre-merge verification

The sole GitHub Actions workflow declares only `push` to `main` and
`workflow_dispatch`. Its existing workflow-contract tests cover permissions,
pins, toolchains, commands, order, and E2E configuration but omit the trigger
map. Deferred item `D-05` required quality commands inside the deploy workflow;
the present `verify` step satisfies that older requirement. The missing
pre-merge boundary is therefore genuinely new.

The safe repair shape is a read-only `pull_request` path, never
`pull_request_target`. Pages artifact upload and Pages/OIDC deployment must
remain restricted to trusted `main` pushes or explicit manual dispatch. This
cycle's no-deploy constraint prohibits dispatching or otherwise exercising the
deployment job.

## Cross-agent agreement and severity decision

| Aggregate ID | Independent confirmation | Resolution |
|---|---|---|
| C12-001 | critic, debugger, tracer, verifier, QA | Retained Medium/High. Independent fixtures reproduce both order dependence and fixed-per-day suppression. |
| C12-002 | critic, debugger, tracer, verifier, QA | Retained Low/High. The financial amount is correct, but the cap period is false. |
| C12-003 | critic, debugger, tracer, verifier, QA | Retained Low/High. Empty input is quarantined from direct publication but still discards valid content and spends extraction work. |
| C12-004 | critic, debugger, tracer, verifier, QA | Retained Medium/High. Byte-binding is valid; ownership and eager-copy behavior are not. |
| C12-005 | critic, debugger, tracer, verifier, QA | Retained Medium/High. Live and deterministic contrast probes agree. |
| C12-006 | critic, debugger, tracer, verifier, QA | Retained Medium/High. Nonexistent input exits zero because the target is not executable. |
| C12-007 | critic, debugger, tracer, verifier, QA | Retained Low/High. Runtime remains safe, while instructions and tests state a false trust contract. |
| C12-008 | debugger, tracer, verifier, QA | Retained Medium/High. A real supported card reproduces unexplained cap clipping on every browser results surface. |
| C12-009 | critic, debugger, tracer, verifier, dependency expert, QA | Retained Medium/High. Full history distinguishes trigger timing from the resolved workflow-content debt. |

Repeated confirmations do not inflate the count. Every raw ID maps either to
one aggregate item or to the explicit rejection below.

## Rejected, qualified, and deduplicated hypotheses

- `RPF12-D-002`, the unnamed CardGrid search SVG, is real but not a new Cycle
  12 finding. It predates the Cycle 9 snapshot and has the same root cause,
  assistive-technology failure, and exact repair as `C9-D-01` / `C9-011` and
  archived Plan 119. The tracer found a dashboard CTA residual with the same
  history. Both must be reopened under the historical owner, not counted here.
- The leading-NUL/prefixed-XLSX inflation hypothesis remains rejected.
  Non-byte-zero `PK` input does not enter ZIP inflation. No reviewer found new
  evidence that changes that admission precondition.
- Architect, debugger, security, tracer, dependency-expert, and QA lanes found
  no distinct additional root defect.
- Existing deferred broad coverage, full-corpus matcher architecture,
  build-stats fallback, mixed runner, E2E temporary-path, and generic
  accessibility-gate items were not relabeled as Cycle 12 findings.

## Review verification

Role-level non-browser evidence included:

- 3,060 debugger tests;
- 2,977 unit-only test-engineer tests and 8 workflow-contract tests;
- 311 tracer tests;
- 456 QA tests;
- 12 dependency/workflow tests with 61 expectations;
- 282 critic-focused tests; and
- bounded executable probes for shared-cap ordering, cap copy, report wording,
  scraper selection, root command execution, contrast, trust-boundary stamping,
  real-card cap disclosure, and workflow trigger parsing.

Green baseline suites are consistent with the findings because the missing
oracles do not assert shared identity, period-specific copy, non-empty selector
fallback, buffer ownership, tinted-host contrast, root command execution,
truthful prompt wording, browser cap disclosure, or PR triggers.

## Designer evidence and cleanup

The designer read and used the complete available agent-browser skill family,
then inspected the production build at 1,440 × 1,000 and 375 × 812. Coverage
included all routes, keyboard/focus behavior, navigation, disclosures, source
links, validation and persisted-state flows, responsive overflow, light/dark
themes, motion rules, console/page errors, network resources, and bounded
performance diagnostics.

The initial browser attempt was rejected after a wait failure. Its exact
profile and daemon/Chrome process group were closed and removed before retry.
The accepted session `cycle12-designer`, profile
`/tmp/cycle12-designer.K1du6v/profile2.OvkKCW`, browser PGID `63134`, and
preview PID/PGID `37650/37650` were all closed by exact ownership. The cycle
temporary root was removed. `bun scripts/run-e2e.ts status --assert-clean`
passed; TCP 4173 was free; no attributable session, repository process, or
profile remained. Unrelated browser processes were not signaled or changed.

## Agent execution notes

All thirteen selected role reports completed. Concurrency limits were handled
through reusable reviewer threads:

- code reviewer → critic → tracer;
- performance reviewer → architect → debugger → QA-tester;
- security reviewer → document specialist → verifier; and
- designer → test engineer → dependency expert.

There were no unrecovered role failures. The six protected untracked Cycle 42
artifacts remained byte-identical, untracked, and unstaged.

## Prompt 2 plan coverage

Prompt 2 verified that completed Cycle 11 Plans 125–128 already contained
completion evidence, then moved only those four files into
`.context/plans/_archive/`. It created nine Cycle 12 plans, with every retained
finding scheduled exactly once:

| Plan | Finding | Scope |
|---|---|---|
| 129 | C12-001 | Separate rule/cap identities and validate shared-group coherence |
| 130 | C12-002 | Render period-accurate standalone cap copy |
| 131 | C12-003 | Select normalized non-empty scraper content and reject empty extraction |
| 132 | C12-004 | Remove ordinary-local eager statement copies while preserving byte-bound consent |
| 133 | C12-005 | Use a tint-safe source-host foreground with a complete contrast matrix |
| 134 | C12-006 | Route the root `parse` shortcut to supported CLI behavior |
| 135 | C12-007 | Align scraper prompt/test wording with URL deletion and trusted stamping |
| 136 | C12-008 | Disclose authoritative plural cap events on all browser result surfaces |
| 137 | C12-009 | Add read-only PR verification and keep Pages publication trusted-only |

No retained Cycle 12 finding is deferred, rejected, or silently dropped. The
requested `ralph` skill is not registered in the available skill roots, so
every plan records the approved manual test-first plan→implement→verify
fallback.

## Prompt 3 remediation

All nine retained findings were implemented test-first and closed without
deployment:

| Finding | Plan | Signed commit | Verified outcome |
|---|---:|---|---|
| C12-001 | 129 | `2812cea6bcbf568d5caf3b89bc00a71d01171095` | Rule execution identity is independent of shared cap-ledger identity; incoherent groups fail validation. |
| C12-002 | 130 | `6ab9416a539b50fdc31079440fa53988ec0c4642` | Standalone cap copy distinguishes per-purchase, category-monthly, and card-monthly periods. |
| C12-003 | 131 | `3a22cbef8267c481dda8e5a6a392935df292c5f1` | Selector fallback skips normalized-empty candidates and empty source fails before extraction. |
| C12-004 | 132 | `8c0e119ffef3b8f9832c0a6c77139ca3d9cf3e40` | Ordinary local parsing performs no consent snapshot read; remote consent retains one exact owned snapshot. |
| C12-005 | 133 | `ca4a9cd041bb93b8280f911a2d5476770624601a` | All 24 issuer tints meet AA source-host contrast in light and dark themes. |
| C12-006 | 134 | `087f2e5dfc209ac2407dec0c1d77a8b988569f51` | Root `parse` routes to supported CLI analysis and rejects invalid input. |
| C12-007 | 135 | `3a22cbef8267c481dda8e5a6a392935df292c5f1` | Prompt and tests now describe URL deletion and the actual trusted metadata set. |
| C12-008 | 136 | `c1126fd9c89efae2049cc4e2b56be025a56a4774` | Dashboard, results, and report render every ordered cap event with applied and lost reward. |
| C12-009 | 137 | `a8a8276da2b0b79484fc1a5e3289fa295b2b690e` | Pull requests run verification/E2E while Pages upload and deploy stay trusted-only. |

The implementation was split into eight fine-grained, GPG-signed commits.
Each commit was pushed immediately to
`codex/review-plan-fix-no-deploy-20260723`. No workflow was dispatched and no
deployment action was taken.

## Prompt 3 verification

The source head passed the complete required matrix before review-artifact
closure:

| Gate | Result |
|---|---|
| `bun run lint` | Passed across all seven workspaces; Astro reported zero errors, warnings, or hints. |
| `bun run typecheck` | Passed across all seven workspaces; Astro reported zero diagnostics in 125 files. |
| `bun run build` | Passed all seven tasks and generated all five static routes. |
| `bun run test` | Passed every workspace and script test suite. |
| `bun run test:bun` | 1,641 tests and 3,319 expectations passed. |
| `bunx vitest run` | 124 files and 2,996 tests passed. |
| `bun run test:e2e` | 96 browser tests passed. |

The repository-owned E2E status assertion passed both before and after the
browser run; there were no owned runs and TCP 4173 was available. An
independent integration review also passed the focused 164-test matrix and
caught one missing applied-reward presentation assertion before closure.

Plans 129–137 are complete. Plans 125–128 were archived only after their prior
completion evidence was checked. The six protected Cycle 42 artifacts remain
byte-identical, untracked, and unstaged. Deploy mode remained `none`.
