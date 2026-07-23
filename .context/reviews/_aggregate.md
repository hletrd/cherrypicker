# Aggregate Review — CherryPicker Review/Plan/Fix Cycle 7

**Date:** 2026-07-24
**Cycle:** 7 / 100
**Baseline:** `3086a379e31e5b17f82401807f5b3c24325b9962`
**Branch:** `codex/review-plan-fix-no-deploy-20260723`
**Deploy mode:** none

## Executive summary

Cycle 7 completed all eleven required lenses: code reviewer, critic,
architect, performance reviewer, security reviewer, tracer, debugger,
verifier, test engineer, document specialist, and designer. The repository
has a UI, so the designer combined a complete presentation-source review with
one bounded live browser run. There are no custom reviewer definitions under
`.claude/agents`; generic role agents were used.

The lens reports contain **19 raw findings**. Cross-role agreement collapses
five duplicate groups:

- `C7-AR-003` and `RPF7-VER-001` are the same custom-taxonomy/compiled-catalog
  contract mismatch.
- `RPF7-PERF-001` and `RPF7-SEC-001` are the same JSON diagnostic
  amplification root cause.
- `RPF7-VER-002`, `C7-TE-003`, and `C7-DOC-001` are the same Bun-only
  documentation/runtime contradiction and missing truth guard.
- `C7-TE-004` and `C7-DOC-002` are the same undocumented remote-PDF API-key
  prerequisite.

After deduplication, Cycle 7 has **14 unique findings**: 2 High, 11 Medium,
and 1 Low. The highest risks are canonical taxonomy keywords being shadowed
by legacy maps and mutually exclusive choice benefits being awarded
simultaneously. Other findings cover directional statement amounts, exact
reward arithmetic and cap telemetry, catalog binding, persisted-state
coherence, bounded diagnostics and warning provenance, test truth, setup
documentation, and a keyboard skip-link/hash-routing collision.

The six pre-existing untracked Cycle 42 artifacts were treated as protected
user work and remained outside the review.

| Severity | Unique findings |
|---|---:|
| High | 2 |
| Medium | 11 |
| Low | 1 |
| **Total** | **14** |

## Unique findings

### Parser and persisted analysis integrity

| ID | Severity | Confidence | Finding | Raw sources |
|---|---|---|---|---|
| C7-001 | Medium | High | Credit/refund fields are accepted as positive spending, and paired Debit/Credit statements change meaning with header order. | `C7-CR-001` |
| C7-006 | Medium | High | Persistence discards invalid transactions but preserves optimization and summaries derived from them. | `C7-CT-001` |
| C7-007 | Medium | High | Compact invalid JSON rows create an unbounded diagnostic graph across parser, worker clone, state, and UI. | `RPF7-PERF-001`, `RPF7-SEC-001` |
| C7-008 | Low | High | Persisted warning truncation invents a filename and changes the displayed affected-file count. | `RPF7-TRACE-001` |

### Reward, taxonomy, and catalog correctness

| ID | Severity | Confidence | Finding | Raw sources |
|---|---|---|---|---|
| C7-002 | Medium | High | Exported percentage helpers use binary `Math.floor(amount * rate)` and disagree with the exact main calculator. | `C7-CR-002` |
| C7-003 | High | High | Legacy keyword maps override canonical taxonomy keywords and make supported rewards unreachable. | `C7-AR-001` |
| C7-004 | High | High | Free-form user-choice restrictions bypass fail-closed validation, allowing mutually exclusive benefits simultaneously. | `C7-AR-002` |
| C7-005 | Medium | High | CLI optimize/report accept a custom taxonomy with the unrelated compiled card catalog. | `C7-AR-003`, `RPF7-VER-001` |
| C7-009 | Medium | High | Exactly exhausting the global monthly cap leaves `capReached` false and omits `capsHit`. | `RPF7-DBG-001` |

### Test, documentation, and UI truth

| ID | Severity | Confidence | Finding | Raw sources |
|---|---|---|---|---|
| C7-010 | Medium | High | The documented Bun-only setup passes its gate, but `dev:web` shells to an undeclared Node runtime; the truth test misses it. | `RPF7-VER-002`, `C7-TE-003`, `C7-DOC-001` |
| C7-011 | Medium | High | Three CSV regression tests become assertion-free when parsing returns no transactions. | `C7-TE-001` |
| C7-012 | Medium | High | Direct Playwright freshness checks the matcher but not the two imported optimizer modules or their source graph. | `C7-TE-002` |
| C7-013 | Medium | High | The remote-PDF example omits its required `ANTHROPIC_API_KEY`, and its executable-example test checks only text presence. | `C7-TE-004`, `C7-DOC-002` |
| C7-014 | Medium | High | The card-list skip link's `#main-content` is interpreted as a card ID and replaces the list with a false not-found state. | `C7-D-001` |

## Cross-role agreement and deduplication

| Aggregate ID | Raw finding IDs | Resolution |
|---|---|---|
| C7-001 | `C7-CR-001` | Preserved at Medium/High. |
| C7-002 | `C7-CR-002` | Preserved at Medium/High. |
| C7-003 | `C7-AR-001` | Preserved at High/High. |
| C7-004 | `C7-AR-002` | Preserved at High/High. |
| C7-005 | `C7-AR-003`, `RPF7-VER-001` | Merged; both reproduce the same unbound custom-taxonomy/compiled-catalog pair. |
| C7-006 | `C7-CT-001` | Preserved at Medium/High. |
| C7-007 | `RPF7-PERF-001`, `RPF7-SEC-001` | Merged; security and performance probes use the same allocation path and reproduction. |
| C7-008 | `RPF7-TRACE-001` | Preserved at Low/High. |
| C7-009 | `RPF7-DBG-001` | Preserved at Medium/High. |
| C7-010 | `RPF7-VER-002`, `C7-TE-003`, `C7-DOC-001` | Merged at the higher Medium/High rating. The Bun-only runtime contract is authoritative, so the root fix removes the undeclared Node dependency and guards that script contract. |
| C7-011 | `C7-TE-001` | Preserved at Medium/High. |
| C7-012 | `C7-TE-002` | Preserved at Medium/High. |
| C7-013 | `C7-TE-004`, `C7-DOC-002` | Merged; both describe the same incomplete remote-PDF setup contract. |
| C7-014 | `C7-D-001` | Preserved at Medium/High. |

Every raw finding maps to exactly one aggregate finding. No severity was
downgraded because another reviewer did not independently report it.

## Validation and live evidence

Baseline review checks were green: `bun run verify`, root tests, the
Bun-targeted suite, 100 Vitest files / 2,630 tests, 2,707 coverage-run tests,
`data:check` for 683 cards and 24 issuers, dependency validation, and
`bun audit`. These results establish reproducibility; they do not close the
findings above.

The designer's isolated 1440×900 production-preview pass exercised the home
and card-list routes, keyboard skip navigation, light/dark persistence,
loading and network boundaries, and the card-list error transition. It
captured accessibility trees, text/DOM/computed-style evidence, screenshots,
a trace, a CPU profile, and browser state under `/tmp`. Invoking the visible
skip link focused `main#main-content`, then `CardPage` interpreted
`#main-content` as a card selection and rendered a not-found alert, confirming
C7-014. The run produced no unrelated console or page error.

The live run used unique marker `rpf-cycle7-designer-3086a3`, browser PGID
2330, and preview PID/PGID 99042 on port 42773. The exact session and preview
were closed and reaped. PIDs 2330, 2332, and 99042 were absent afterward;
ports 42773 and 4173 had no listener; and
`bun scripts/run-e2e.ts status --assert-clean` passed. Unrelated interactive
Chrome, Remote Desktop, Travelback, and xylolabs processes were untouched.

## Agent execution notes

All eleven required role reports completed without a failed lens or retry.
The designer interrupted one hung text wait, continued within the same owned
session, and completed cleanup before writing provenance. A separate
read-only parser design audit was run only after the review evidence was
complete; it made no source or plan change. There are no unresolved role
failures.

## Plan coverage

Prompt 2 archived the six completed Cycle 6 plans (96–101) and created six
Cycle 7 plans. Every unique finding is assigned exactly once:

| Plan | Findings | Scope |
|---|---|---|
| 102 | C7-001, C7-007, C7-011 | Directional amount parsing, bounded diagnostics, assertion-complete CSV tests |
| 103 | C7-003, C7-004 | Canonical taxonomy authority and fail-closed user choices |
| 104 | C7-002, C7-009 | Exact public reward helpers and exact global-cap state |
| 105 | C7-006, C7-008 | Atomic persisted analysis and warning provenance |
| 106 | C7-005, C7-010, C7-013 | CLI catalog binding, Bun-only web script, remote-PDF setup |
| 107 | C7-012, C7-014 | Direct-E2E freshness and namespaced card routing |

No finding is deferred. The requested `ralph` skill is not installed in the
available skill roots, so every plan records the disciplined manual fallback.

## Prompt 3 implementation closure

Plans 102–107 are implemented with every acceptance item complete. Focused
verification passed across parser/web (1,698 parser tests and 184 parser/UI
adapter tests), core/rules/viz (352 core/rules tests and 241 core/viz tests),
persistence (119 tests), CLI/document contracts, package typechecks, and
`data:check` for all 683 cards across 24 issuers.

The bounded integration audit found and closed two residual test-contract
gaps without opening new scope: old E2E deep links were migrated to the
namespaced form for C7-014, and the C7-013 README test now binds the remote
command, root script, credential prerequisite, and nonlogging guidance in one
localized contract. No finding is deferred.

## Final missed-issue sweep

Each role performed a bounded final sweep after its primary trace. The
aggregate additionally reconciled every raw ID, severity, duplicate,
baseline claim, and browser artifact. No raw finding is omitted, and no
additional cross-role duplicate remains.
