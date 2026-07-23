# Aggregate Review — CherryPicker Review/Plan/Fix Cycle 5

**Date:** 2026-07-23
**Cycle:** 5 / 100
**Baseline:** `e3aa4241bbdc9c9b1dc3abff0df78e0cc9f8d715`
**Branch:** `codex/review-plan-fix-no-deploy-20260723`
**Deploy mode:** none

## Executive summary

The Cycle 5 fanout covered code quality, criticism, architecture, performance,
security, causal tracing, debugging, verification, tests, documentation, and
UI/UX. The reports contain **39 raw findings**. Two pairs overlap:

- C5-TRACE-001 and C5-TEST-001 describe the same unchecked visualization
  money aggregation.
- C5-CT-002 and D5-02 describe the same malformed fallback taxonomy edit.

After cross-role deduplication, Cycle 5 has **37 unique findings**: 4 High, 26
Medium, and 7 Low. The largest correctness risks are unknown previous-month
transactions unlocking excluded performance tiers, optimization claims based
on a cost-free all-card portfolio, indistinguishable parent-category edits,
and bank/performance options that remain editable after a running analysis has
snapshotted them.

The remaining findings span parser encoding and malformed OFX handling,
persisted-state validation and durable reset semantics, deterministic
authoring, atomic scraper writes and trusted freshness dates, unsupported
annual-cap semantics, dependency advisories, checked financial
visualizations, stale issuer documentation, and a broad set of concrete
accessibility and interaction defects.

The six pre-existing untracked Cycle 42 artifacts remained byte-for-byte
unchanged and outside this review.

| Severity | Unique findings |
|---|---:|
| High | 4 |
| Medium | 26 |
| Low | 7 |
| **Total** | **37** |

## Unique findings

### Domain, optimizer, and catalog truth

| ID | Severity | Confidence | Finding | Raw sources |
|---|---|---|---|---|
| C5-001 | High | High | Unknown or confidence-zero previous-month categories are treated as definitely included by category exclusions and can unlock higher performance tiers. | C5-CR-001 |
| C5-007 | Low | High | Custom authoring catalogs and equal-reward optimizer choices inherit unstable filesystem/input order. | C5-CR-007 |
| C5-008 | High | High | Default “savings” optimize a cost-free 683-card portfolio, ignore annual fees and ownership, and can recommend an unlabeled discontinued card. | C5-CT-001 |
| C5-013 | Medium | High | A positive `annualCap` is accepted on supported rules even though the runtime has no annual usage facts and never enforces it. | C5-ARCH-001 |

### Parser and input integrity

| ID | Severity | Confidence | Finding | Raw sources |
|---|---|---|---|---|
| C5-002 | Medium | High | OFX, HTML, HTML-as-XLS, and related text routes force UTF-8 and silently corrupt legacy Korean merchant text. | C5-CR-002 |
| C5-004 | Medium | High | Delimiter detection counts punctuation inside quoted fields and can reject a valid statement. | C5-CR-004 |
| C5-005 | Medium | High | Bank-specific CSV/XLSX adapters accept missing merchant headers or cells without a diagnostic. | C5-CR-005 |
| C5-014 | Medium | High | Timezone-bearing OFX timestamps normalize invalid components into a different valid date. | C5-DBG-001 |
| C5-015 | Medium | High | OFX required-field guards fail to diagnose independently missing date or amount values. | C5-DBG-002 |

### Persistence and financial-output boundaries

| ID | Severity | Confidence | Finding | Raw sources |
|---|---|---|---|---|
| C5-003 | Medium | High | Persisted optional transaction facts and statement periods are only partially validated, allowing malformed state to crash reoptimization. | C5-CR-003 |
| C5-006 | Medium | High | Reset presents success after durable deletion fails, allowing explicitly cleared analysis to return after reload. | C5-CR-006 |
| C5-017 | Medium | High | CLI `analyze` and public terminal/report APIs recompute totals with unchecked addition and silently round an unsafe aggregate. | C5-TRACE-001, C5-TEST-001 |

### Scraper, dependency, performance, and documentation controls

| ID | Severity | Confidence | Finding | Raw sources |
|---|---|---|---|---|
| C5-010 | Medium | High | Scraper `--force` truncates the canonical rule before its replacement is durable. | C5-CT-003 |
| C5-011 | Medium | High | Impossible or future model-authored freshness dates can become catalog generation metadata. | C5-CT-004 |
| C5-012 | Low | High | Every `Icon` instance reconstructs the same 27-entry immutable SVG path table. | C5-PERF-001 |
| C5-016 | Medium | High | The locked graph contains 40 known advisories while the blocking dependency gate performs no advisory scan. | C5-SEC-001 |
| C5-018 | Low | High | Issuer READMEs contain stale manual dates and DGB catalog prose that `docs:check` certifies without checking. | C5-DOC-001 |

### Taxonomy and upload interaction

| ID | Severity | Confidence | Finding | Raw sources |
|---|---|---|---|---|
| C5-009 | Medium | High | The transaction editor fallback writes qualified subcategory IDs as phantom top-level categories. | C5-CT-002, D5-02 |
| C5-019 | High | High | Every parent category option closes to the same `전체` label, so users cannot verify which parent they selected. | D5-01 |
| C5-020 | High | High | Bank and previous-spending controls remain editable after analysis snapshots them, so displayed values can differ from the result's inputs. | D5-03 |
| C5-021 | Medium | High | Correcting a row while `미분류만 보기` is active removes the focused select without a deliberate focus destination. | D5-04 |
| C5-022 | Medium | High | The horizontally scrollable transaction table lacks a named, focusable keyboard scroll region. | D5-05 |
| C5-023 | Medium | High | Transaction category selects are enabled but empty before asynchronous taxonomy loading completes. | D5-06 |
| C5-026 | Medium | High | Inactive upload-step numbers fail normal-text contrast in both themes. | D5-09 |
| C5-027 | Medium | High | The upload retry action fails dark-mode text contrast. | D5-10 |
| C5-028 | Medium | High | Upload branch transitions can remove focused controls and use an unreliable, short-lived status announcement before navigation. | D5-11 |
| C5-031 | Medium | High | The previous-spending number input advertises a comma-grouped format it cannot accept reliably and clears errors before revalidation. | D5-14 |

### Page, report, and card-catalog UX

| ID | Severity | Confidence | Finding | Raw sources |
|---|---|---|---|---|
| C5-024 | Medium | High | Card details expose raw exclusion identifiers such as `tax_payment` in the Korean interface. | D5-07 |
| C5-025 | Medium | High | Multiple summary-tile labels and actions fail 4.5:1 light-mode contrast. | D5-08 |
| C5-029 | Medium | High | Persisted-result pages server-render a false empty state, then replace it after hydration without distinct readiness/error states. | D5-12 |
| C5-030 | Medium | High | Printed results retain navigation, sorting, and interactive-only controls. | D5-13 |
| C5-032 | Medium | Medium-high | Bottom pagination replaces cards above the viewport without transferring focus or scroll context. | D5-15 |
| C5-033 | Medium | Medium-high | Dark mode changes custom tokens but does not declare the native-control color scheme. | D5-16 |
| C5-034 | Low | High | Theme toggles expose neither current state nor the resulting light/dark action. | D5-17 |
| C5-035 | Low | High | Results-page savings content has no navigable section heading. | D5-18 |
| C5-036 | Low | High | Noninteractive feature and dashboard panels lift like clickable cards on hover. | D5-19 |
| C5-037 | Low | High | “Same issuer” navigation opens the unfiltered catalog and discards the promised issuer context. | D5-20 |

## Raw-finding coverage matrix

Every raw finding maps to exactly one unique aggregate finding.

| Review report | Raw IDs to aggregate IDs |
|---|---|
| code-reviewer | C5-CR-001 → C5-001; C5-CR-002 → C5-002; C5-CR-003 → C5-003; C5-CR-004 → C5-004; C5-CR-005 → C5-005; C5-CR-006 → C5-006; C5-CR-007 → C5-007 |
| critic | C5-CT-001 → C5-008; C5-CT-002 → C5-009; C5-CT-003 → C5-010; C5-CT-004 → C5-011 |
| perf-reviewer | C5-PERF-001 → C5-012 |
| architect | C5-ARCH-001 → C5-013 |
| debugger | C5-DBG-001 → C5-014; C5-DBG-002 → C5-015 |
| security-reviewer | C5-SEC-001 → C5-016 |
| tracer | C5-TRACE-001 → C5-017 |
| test-engineer | C5-TEST-001 → C5-017 |
| document-specialist | C5-DOC-001 → C5-018 |
| designer | D5-01 → C5-019; D5-02 → C5-009; D5-03 → C5-020; D5-04 → C5-021; D5-05 → C5-022; D5-06 → C5-023; D5-07 → C5-024; D5-08 → C5-025; D5-09 → C5-026; D5-10 → C5-027; D5-11 → C5-028; D5-12 → C5-029; D5-13 → C5-030; D5-14 → C5-031; D5-15 → C5-032; D5-16 → C5-033; D5-17 → C5-034; D5-18 → C5-035; D5-19 → C5-036; D5-20 → C5-037 |

## Cross-review agreement

- C5-009 was independently found by the critic and the designer static audit.
  Both traced the absent fallback parent map to a malformed stored category and
  downstream reward mismatch.
- C5-017 was independently reproduced by the tracer and test engineer. Both
  showed that two individually valid amounts can cross the safe-integer
  boundary and print a one-won-short exact-looking total.
- The verifier independently reproduced C5-012 through C5-015 and explained
  why current green tests miss those paths.
- The code reviewer and critic both identified failures caused by treating
  partial or implicit product state as authoritative: unknown categories,
  incomplete persisted facts, implicit portfolio eligibility, and piecemeal
  fallback taxonomy state.
- The designer findings were reconciled against shipped markup, CSS tokens,
  route behavior, and card data. Runtime-only effects remain explicitly marked
  for browser or assistive-technology regression coverage during implementation.

## Agent failures

- The primary designer stalled during final report generation and again on its
  single permitted retry. Its isolated browser session and preview were closed
  exactly and verified clean. The completed static subreview was recovered
  into `designer.md`; no unobserved live claim was fabricated.
- No other requested reviewer failed or timed out.

## Baseline validation evidence

- `bun run test`: 2,457 tests passed across 99 files.
- `bun run test:e2e`: 93 browser tests passed in both reviewer-owned runs, with
  exact clean postflight ownership checks.
- Focused parser/rules/core/scraper/CLI verification: 194 tests passed.
- Lint, typecheck, data, migration, dependency-integrity, documentation, and
  production build checks passed on the review baseline.
- `bun audit --json` reproduced 40 advisories across 15 packages: 18 High, 16
  Moderate, and 6 Low.
- The host Bun is 1.3.12 while the repository currently pins 1.2.6; baseline
  results are supporting evidence, not a claim of exact pinned-toolchain
  reproduction.
- No deployment was performed.

## Plan coverage

Every Cycle 5 finding is scheduled exactly once. There are no Cycle 5
deferrals.

| Plan | Scheduled findings |
|---|---|
| 89 — Domain and catalog truth | C5-001, C5-007, C5-008, C5-013 |
| 90 — Parser and input integrity | C5-002, C5-004, C5-005, C5-014, C5-015 |
| 91 — Persistence and checked output | C5-003, C5-006, C5-017 |
| 92 — Scraper provenance and issuer documentation | C5-010, C5-011, C5-018 |
| 93 — Dependency and icon hardening | C5-012, C5-016 |
| 94 — Taxonomy and upload UX | C5-009, C5-019 through C5-023, C5-026 through C5-028, C5-031 |
| 95 — Page, report, and card UX | C5-024, C5-025, C5-029, C5-030, C5-032 through C5-037 |

Plans 84 through 88 were fully completed and verified in Cycle 4 and were
archived before Cycle 5 implementation. Older historical plans and deferrals
were left in place; no Cycle 5 finding was added to them.

## Implementation closure

All **37 of 37** unique Cycle 5 findings were implemented through Plans 89–95;
**0 findings were deferred**.

The final read-only implementation audit found manifestations of existing
findings rather than new unique issues. README reward/portfolio wording mapped
to C5-008; persisted-record shape probes mapped to C5-003; parser probes mapped
to C5-002, C5-004, and C5-005; and the cross-month public-total probe mapped to
C5-017. Astro 7 documentation drift was introduced during implementation and
was corrected in the same plan. The aggregate count therefore remains 37.

Final configured gates:

- `bun run lint` — passed.
- `bun run typecheck` — passed.
- `bun run build` — passed.
- `bun run test` — passed.
- `bun run test:bun` — 1,737 tests passed.
- `bunx vitest run` — 2,550 tests passed across 95 files.
- `bun run test:e2e` — 96 of 96 tests passed, with clean repository-owned
  process state before and after the run.

No deployment was performed (`Deploy mode: none`).
