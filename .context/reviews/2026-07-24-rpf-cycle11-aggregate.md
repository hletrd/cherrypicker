# Aggregate Review — CherryPicker Review/Plan/Fix Cycle 11

**Date:** 2026-07-24
**Cycle:** 11 / 100
**Baseline:** `5a8e636c0c66136ed3fff0396de226f77758a1bd`
**Branch:** `codex/review-plan-fix-no-deploy-20260723`
**Deploy mode:** none

## Executive summary

Cycle 11 completed all eleven required review lenses: code reviewer,
performance reviewer, security reviewer, critic, verifier, test engineer,
tracer, architect, debugger, document specialist, and designer. The repository
contains an Astro/Svelte UI, so the designer performed one bounded production
browser inspection after reading the complete available agent-browser skill
family. No custom reviewer definitions exist under `.claude/agents`.

The role reports contain **4 concrete raw findings**, which map one-to-one to
**4 unique retained findings**. The verifier independently confirmed all four
and rejected none.

| Severity | Unique findings |
|---|---:|
| Medium | 3 |
| Low | 1 |
| **Total** | **4** |

## Unique findings

| ID | Severity | Confidence | Finding | Raw source |
|---|---|---|---|---|
| C11-001 | Low | High | Combining a native or full-width leading minus with the supported Korean-minus or trailing-minus notation is negated twice. Accepted refunds such as `-1000-` and `마이너스-1000` silently become positive spending. | `C11-CR-001` |
| C11-002 | Medium | High | The Cycle 10 merchant-boundary predicate recomputes immutable edge metadata with two regular-expression tests before every `indexOf`. A unique full miss performs about 50,132 such tests and materially blocks main-thread categorization. | `RPF11-PERF-001` |
| C11-003 | Medium | High | The calculator can correctly emit two rule-level monthly caps for one category, but `CategoryReward` retains one overwritten `capAmount`. Web coherence then rejects the optimizer's valid plural-cap result. | `C11-CT-001` |
| C11-004 | Medium | High | Canonical `manual` and `web` card records contain at least 26 clear aggregator, news, or wiki destinations, but every safe `card.url` is presented as an issuer-official card page. | `RPF11-DOC-001` |

## Evidence and downstream reach

### C11-001 — sign composition

The shared amount kernel currently returns positive `1000` for `-1000-`,
`마이너스-1000`, and equivalent full-width compositions while each individual
negative notation remains negative. Generic CSV and JSON entry points produce
a positive transaction with no diagnostic. The same canonical kernel is used
by server, CLI, browser, XLSX, HTML, PDF, and OFX paths, so downstream refund
filters receive an apparently valid positive safe integer.

This is distinct from the fixed Cycle 40–42 `(-1234)` case. Archived Plan 69
covered leading, Korean, trailing, and full-width negative forms separately,
but not their non-parenthesized composition.

### C11-002 — repeated boundary work

The live matcher contains 12,047 static substring entries and 324 taxonomy
keywords. A complete uncached miss invokes the boundary helper about 25,066
times and performs about 50,132 edge regular-expression tests. Independent
equal-output probes measured current boundary-aware comparisons between
2.17× and 4.48× slower than precompiled/index-first controls. Real
`MerchantMatcher` probes consistently showed linear synchronous cost, and a
2,000-row application-level probe delayed a zero-delay timer by about 1.5
seconds.

This finding is limited to the new constant-factor cost introduced by Cycle
10 boundary correctness. Deferred item `D-C1-041` still owns eliminating the
older full-corpus scan architecture.

### C11-003 — plural cap telemetry

The current `kb-all` rule set has a specific 5% overseas online-shopping rule
with a 5,000 Won monthly cap and a general 10% online-shopping rule with a
10,000 Won cap. With 500,000 Won previous spending, two 100,000 Won overseas
Amazon purchases correctly exhaust the first rule and fall back to the
second:

```text
category reward:                15,000
CategoryReward.capAmount:       10,000
monthly_category capsHit:       [5,000, 10,000]
isAnalysisResultCoherent():     false
```

The one-transaction 5,000 Won control validates. The two-transaction result is
financially balanced, but the web validator requires every cap event to equal
the one last-written category field and throws before state can commit. A
default-catalog trace reproduced the same failure without a private card
filter.

### C11-004 — source identity

A complete conservative catalog query found 26 reviewed third-party URLs:
15 Banksalad, 5 Card Gorilla, 2 Namu Wiki, and 4 news sites. The canonical
records comprise 25 `manual` and 1 `web` source. Examples include KB NEED Edu
linking to Financial Post, Lotte LOCA for Auto and IBK CEO linking to Card
Gorilla, and Samsung & POINT linking to Banksalad.

The schema proves only reviewed provenance for `manual` and `web`; the
last-mile guard proves only safe absolute HTTP(S) syntax. Neither proves
issuer ownership. This begins after Cycle 10 Plan 122's fixed model-authority
boundary and is therefore a separate field/copy semantics failure.

## Cross-agent agreement and severity decision

| Aggregate ID | Independent confirmation | Resolution |
|---|---|---|
| C11-001 | test engineer, critic, debugger, tracer, verifier | Preserved at Low/High. The code reviewer, test engineer, and tracer recommended Medium because the false purchase reaches rewards and persistence. The critic and verifier recommended Low because every known trigger redundantly encodes negativity twice and matches the historical `(-1234)` likelihood precedent. The aggregate adopts the verifier's explicit Low rating while retaining the financial consequence. |
| C11-002 | critic, test engineer, debugger, tracer, verifier | Preserved at Medium/High. Multiple operation counts and equal-output differentials isolate the Cycle 10 constant-factor regression without closing or relabeling `D-C1-041`. |
| C11-003 | debugger, tracer, verifier | Preserved at Medium/High. Independent real-card one- and two-transaction controls prove a valid producer result is rejected by a singular cross-layer contract. |
| C11-004 | debugger, tracer, verifier | Preserved at Medium/High. Independent complete-corpus queries reproduce the 26 destinations and distinguish reviewed-source semantics from Cycle 10 model authority. |

Every concrete raw ID maps to exactly one aggregate item. Repeated same-cycle
confirmations do not inflate the count. No fifth finding was silently omitted.

## Rejected, qualified, and deduplicated hypotheses

- The leading-NUL/prefixed-XLSX inflation hypothesis remains rejected.
  Non-`PK` input follows SheetJS's plaintext/PRN route and does not enter ZIP
  inflation.
- The underlying linear merchant-matcher architecture remains deferred as
  `D-C1-041`; only the newly repeated edge-metadata work is counted here.
- Instrumented repeated optimizer sorting consumed only 0.2% of a real run
  and 3.2% under equal-amount stress, so it did not clear a separate finding
  threshold.
- The designer deduplicated previously recorded contrast, generic axe-gate,
  dashboard-region, and AAA target-size items. No new current UI defect was
  created from those observations.
- Current scraper, worker, persistence, output-writer, dependency, workflow,
  and credential boundaries produced no new security finding.
- Multiple rule caps are not assumed to fail merely because they share a
  broad category. The retained reproduction uses the real same-key Amazon
  taxonomy result and actual specific-rule exhaustion followed by general-rule
  fallback.

## Review verification

Role-level non-browser checks included:

- 2,607 direct core/parser/web tests plus the root test command;
- 390 debugger-focused tests;
- 294 verifier-focused tests;
- dependency, data, documentation, and toolchain checks; and
- executable parser, matcher, cap, schema, publication, and href probes.

These baseline suites remained green because they do not yet express
redundant sign composition, boundary-metadata ownership, a real plural-cap
producer result, or reviewed-source destination semantics.

## Designer evidence and cleanup

The accepted production preview sampled home, upload validation and success,
dashboard disclosures, keyboard focus, ARIA state, dark/light theme behavior,
desktop and 375 px layouts, overflow, console/page errors, resource loading,
layout shift, and local interaction timing. No genuinely new actionable UI/UX
defect was found.

The first development-preview attempt was rejected because Astro's development
toolbar polluted the accessibility tree. Its exact session, preview process
group, and temporary profile were closed before the one production retry.
The accepted retry used session
`cherrypicker-c11-designer-prod-5a8e636c`, browser roots `73095/73097`,
preview PGID `67651` with listener `67745`, and profile
`/tmp/cherrypicker-c11-designer-prod-5a8e636c.pJpnWa`. Cleanup closed the
exact session, terminated only the owned preview group, and removed only that
profile after confirming it was unused.

Final checks reported no owned E2E run, TCP 4173 free, no active designer
session or attributed process, and no remaining profile. An unrelated
Travelback browser tree was observed before launch, never signaled or changed,
and exited independently.

## Agent execution notes

All eleven required role reports completed. Concurrency limits were handled
through four reusable reviewer threads:

- code reviewer → critic → tracer;
- performance reviewer → architect → debugger;
- security reviewer → document specialist → verifier; and
- designer → test engineer.

The designer's report-only finalization initially encountered model capacity
after exact cleanup. A report-only retry wrote the saved evidence without
relaunching a browser or server. There are no unrecovered role failures.

## Prompt 2 plan coverage

Prompt 2 archived completed Cycle 10 Plans 120–124 and created four Cycle 11
plans. Every unique finding is scheduled exactly once:

| Plan | Finding | Scope |
|---|---|---|
| 125 | C11-001 | One shared amount-sign polarity rule and parser boundary regressions |
| 126 | C11-002 | Compile-once merchant boundary metadata and index-first matching |
| 127 | C11-003 | Rule/cap-group identity with authoritative plural cap telemetry |
| 128 | C11-004 | Neutral reviewed-source link copy with visible destination identity |

No Cycle 11 finding is deferred, rejected, or silently dropped. The requested
`ralph` skill is not registered in the available skill roots, so each plan
records the approved manual test-first fallback.

## Prompt 2 conclusion

All four plans are ready for Prompt 3. Source and test implementation has not
begun at this boundary.

The six protected untracked Cycle 42 artifacts remain byte-identical,
untracked, and unstaged at their recorded SHA-256 values.
