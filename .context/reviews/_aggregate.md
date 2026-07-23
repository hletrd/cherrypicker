# Aggregate Review — CherryPicker Review/Plan/Fix Cycle 8

**Date:** 2026-07-24
**Cycle:** 8 / 100
**Baseline:** `3fd993d471a8676170031f20715f6a53c99e8a9f`
**Branch:** `codex/review-plan-fix-no-deploy-20260723`
**Deploy mode:** none

## Executive summary

Cycle 8 completed all eleven required lenses: code reviewer, critic,
architect, performance reviewer, security reviewer, tracer, debugger,
verifier, test engineer, document specialist, and designer. The repository
has a UI, so the designer combined a complete presentation-source review with
one bounded live browser run. There are no custom reviewer definitions under
`.claude/agents`; generic role agents were used.

The lens reports contain **22 raw findings**. Cross-role agreement collapses
seven duplicate groups:

- `C8-CR-01` and `C8-CT-03` are the same persisted-analysis coherence defect.
- `C8-CR-02` and `C8-CT-04` are the same impossible root-help example.
- `C8-CT-01` and `C8-AR-03` are the same URL-fragment ownership collision.
- `C8-CT-02` and `C8-AR-04` are the same optimizer-executability mismatch.
- `RPF8-TRACE-001`, `RPF8-VER-001`, `RPF8-VER-002`, and `RPF8-TE-001`
  describe the same amount-field resolution boundary: compound Korean headers
  are misclassified and conflicting same-role fields depend on source order.
- `RPF8-PERF-001` and `RPF8-TE-002` are the same parser-source diagnostic
  amplification root cause.
- `RPF8-DBG-001`, `RPF8-VER-003`, and `RPF8-TE-003` are the same exact
  rule-level monthly-cap telemetry defect.

After deduplication, Cycle 8 has **12 unique findings**: 11 Medium and 1 Low.
The principal risks are semantically impossible persisted analysis, zero-value
or unsupported recommendation winners, hostile compressed workbooks,
order-dependent amount parsing, and unbounded tabular diagnostics. Other
findings cover ownership boundaries, cap disclosure, CLI truth, toolchain
reproducibility, scraper prerequisites, and composable navigation state.

The six pre-existing untracked Cycle 42 artifacts were treated as protected
user work and remained outside the review.

| Severity | Unique findings |
|---|---:|
| Medium | 11 |
| Low | 1 |
| **Total** | **12** |

## Unique findings

### Parser and input integrity

| ID | Severity | Confidence | Finding | Raw sources |
|---|---|---|---|---|
| C8-001 | Medium | High | Persisted analysis validates field shapes but accepts mutually contradictory transaction counts, spending totals, rewards, rates, assignments, and monthly summaries. | `C8-CR-01`, `C8-CT-03` |
| C8-002 | Medium | High | Compressed XLSX inputs have no central-directory, expanded-size, entry-count, or compression-ratio budget before SheetJS inflates them. | `RPF8-SEC-001` |
| C8-003 | Medium | High | Amount-field resolution treats Korean incoming/outgoing compound headers as withdrawals and selects conflicting populated same-role fields by source order. | `RPF8-TRACE-001`, `RPF8-VER-001`, `RPF8-VER-002`, `RPF8-TE-001` |
| C8-004 | Medium | High | CSV, XLSX, HTML, OFX, and PDF parsers allocate one diagnostic object per bad row before the worker-level cap can run. | `RPF8-PERF-001`, `RPF8-TE-002` |

### Analysis, optimization, and ownership

| ID | Severity | Confidence | Finding | Raw sources |
|---|---|---|---|---|
| C8-005 | Medium | High | Catalog availability is reused as optimizer executability, so unsupported-only cards and alphabetically first zero-value cards can become recommendation winners. | `C8-CT-02`, `C8-AR-04` |
| C8-006 | Medium | High | Exact positive exhaustion of a rule-level monthly cap sets internal state but is omitted from `capsHit` and downstream terminal/report disclosure. | `RPF8-DBG-001`, `RPF8-VER-003`, `RPF8-TE-003` |
| C8-007 | Medium | High | Parser file/bank contracts and complete bank XLSX column maps are duplicated across package and web layers, while package tests import upward from the application. | `C8-AR-01` |
| C8-008 | Medium | High | The framework-free analysis DTO is owned by the Svelte store, inverting dependencies from analyzer and persistence code back into UI state. | `C8-AR-02` |

### Navigation, commands, and documentation truth

| ID | Severity | Confidence | Finding | Raw sources |
|---|---|---|---|---|
| C8-009 | Medium | High | Card-detail application state and document landmark navigation share the URL fragment; activating the global skip link can clear an open detail selection. | `C8-CT-01`, `C8-AR-03` |
| C8-010 | Low | High | Root CLI help advertises `optimize ... --cards` alone although optimize/report require `--categories` and `--cards` as a pair. | `C8-CR-02`, `C8-CT-04` |
| C8-011 | Medium | High | The documented Bun-only workstation cannot reproduce `bun run verify`, which shells out to undeclared `npm` despite existing Bun lint/typecheck scripts. | `C8-DOC-001` |
| C8-012 | Medium | High | Scraper help omits its required API key and model override, and missing credentials are discovered only after remote fetch work begins. | `C8-DOC-002` |

## Cross-role agreement and deduplication

| Aggregate ID | Raw finding IDs | Resolution |
|---|---|---|
| C8-001 | `C8-CR-01`, `C8-CT-03` | Merged at Medium/High; both directly mutate a valid serialized result and restore contradictory derived fields. |
| C8-002 | `RPF8-SEC-001` | Preserved at Medium/High. The archive-safety mechanism and missing limits are confirmed; a malicious workbook run was intentionally not performed. |
| C8-003 | `RPF8-TRACE-001`, `RPF8-VER-001`, `RPF8-VER-002`, `RPF8-TE-001` | Merged as one shared amount-field planning defect covering compound-role classification and same-role conflict resolution. |
| C8-004 | `RPF8-PERF-001`, `RPF8-TE-002` | Merged; the tests and performance probe identify the same unbounded parser-source allocation before serialization. |
| C8-005 | `C8-CT-02`, `C8-AR-04` | Merged; both reproduce the same catalog-visibility versus executable-benefit boundary. |
| C8-006 | `RPF8-DBG-001`, `RPF8-VER-003`, `RPF8-TE-003` | Merged; all three trace strict clipping logic that drops exact rule-level cap events. |
| C8-007 | `C8-AR-01` | Preserved at Medium/High. |
| C8-008 | `C8-AR-02` | Preserved at Medium/High. |
| C8-009 | `C8-CT-01`, `C8-AR-03` | Merged; both trace a single fragment channel used for unrelated document and application state. |
| C8-010 | `C8-CR-02`, `C8-CT-04` | Merged at Low/High; the copyable example deterministically fails the paired-option parser. |
| C8-011 | `C8-DOC-001` | Preserved at Medium/High and kept distinct from Cycle 7's fixed `dev:web` wrapper. |
| C8-012 | `C8-DOC-002` | Preserved at Medium/High and kept distinct from the documented PDF fallback credential. |

Every raw finding maps to exactly one aggregate finding. No severity was
downgraded because another reviewer did not independently report it.

## Validation and live evidence

Baseline review checks were green: `git diff --check`,
`bun run toolchain:check`, `bun run dependencies:check`,
`bun run migrations:check`, focused parser/core/web tests, lint, typecheck,
`data:check`, documentation checks, and a production web build. These results
establish reproducibility; they do not close the findings above.

The designer's isolated production-preview pass exercised home, invalid and
successful upload, dashboard, card catalog/detail, desktop/mobile,
light/dark, keyboard, synthetic RTL, request, and performance states. It found
no distinct current defect. At 375 CSS pixels the catalog had no horizontal
overflow; keyboard menu Escape restored focus; the skip link focused
`main#main-content`; form errors exposed `aria-invalid` and described help;
and measured foreground/background combinations met AA contrast. A cache hit
prevented the scoped catalog abort from reaching the UI, so that boundary was
verified from source and existing E2E coverage rather than claimed as live
evidence.

The live run used preview PID/PGID 78381 on port 42889 and named browser
`c8-designer-3fd993d-cPAFIo`, daemon PID/PGID 80759, Chrome root 80808, and
unique profile `/tmp/cherrypicker-c8-designer-3fd993d.cPAFIo/profile`. The
exact browser and preview were closed and reaped. The named PIDs/profile were
absent afterward, ports 42889 and 4173 had no listener, and
`bun scripts/run-e2e.ts status --assert-clean` passed independently. No
unrelated process was signaled.

## Agent execution notes

All eleven role reports completed. The designer completed browser cleanup
before report writing; the first finalization turn then stalled, so it was
interrupted and retried once with an explicit no-browser, report-only scope.
Both role reports were durably written on that bounded retry. No lens failed,
and no browser or preview was restarted.

There are no custom reviewer definitions. The requested `ralph` skill is not
installed in either available skill root; Prompt 3 will use the recorded
disciplined manual fallback.

## Plan coverage

Prompt 2 archived the six completed Cycle 7 plans (102–107) and created six
Cycle 8 plans. Every unique finding is assigned exactly once:

| Plan | Findings | Scope |
|---|---|---|
| 108 | C8-002, C8-003, C8-004, C8-007 | XLSX archive admission, amount-field resolution, bounded diagnostics, parser-owned contracts |
| 109 | C8-001, C8-008 | Framework-free analysis DTO and persisted semantic coherence |
| 110 | C8-005, C8-006 | Executable positive benefits, explicit unassigned spending, exact rule-cap telemetry |
| 111 | C8-009 | Independent card-selection query state and document fragments |
| 112 | C8-010, C8-011 | Executable root help and Bun-only verification truth |
| 113 | C8-012 | Scraper credential preflight and complete operating documentation |

No finding is deferred. Every plan records that the requested `ralph` skill is
not installed and defines a disciplined manual test-first fallback.

## Prompt 3 implementation closure

Plans 108–113 are implemented with every acceptance item complete. The
implementation closes all 12 unique findings without deferral:

- Parser boundaries now preflight both central and local ZIP metadata before
  SheetJS, resolve amount-field ambiguity deterministically, bound diagnostics
  at source in a plain array, and own browser-safe parser contracts.
- Analysis persistence now uses a framework-free DTO and rejects incoherent
  periods, counts, monthly summaries, per-card/category allocations, rates,
  selected-card state, undisclosed truncation, and ambiguous legacy results.
- Optimizer output excludes unsupported/zero-benefit winners, records
  unassigned spending honestly, and discloses exact rule-cap exhaustion across
  web, terminal, report, and persistence sinks.
- Card selection moved to composable query state; CLI examples and Bun-only
  verification are executable; scraper credentials/model/host/overwrite and
  publication steps are preflighted and documented.

The exact final gate matrix passed on the final source tree:

- `bun run lint`
- `bun run typecheck`
- `bun run build`
- `bun run test` (including 741 web tests and 69 script tests)
- `bun run test:bun` (1,601 tests)
- `bunx vitest run` (113 files, 2,811 tests)
- `bun run test:e2e` (96 tests)

Two bounded gate fixes were required. Vitest exposed that the initial bounded
diagnostic `Array` subclass was prototype-unequal to ordinary arrays, so the
collector now preserves a genuine plain-array contract with bounded owned
mutators. E2E then exposed one direct-core fixture that omitted the new
explicit supported-rule marker; the fixture was brought to the production
contract. Both complete gate matrices passed afterward.

The successful E2E run used ownership ID
`1784830551134-da785935-bca9-47c9-84f7-52d511d73135` on loopback port 4173.
Independent preflight and postflight checks found an empty ownership registry,
no attributable Playwright/preview process, and no listener on port 4173.
The prior failed fixture run was independently reaped and verified clean
before the successful rerun.

## Final missed-issue sweep

Each role performed a bounded final sweep after its primary trace. The
aggregate additionally reconciled every raw ID, severity, duplicate, baseline
claim, implementation acceptance item, gate result, and browser cleanup
artifact. The integration audit mapped its local-header and semantic-coherence
gaps back to C8-002/C8-001 rather than opening duplicate findings. No raw
finding is omitted, no additional cross-role duplicate remains, and no
deployment occurred.
