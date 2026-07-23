# Aggregate Review — CherryPicker Review/Plan/Fix Cycle 2

**Date:** 2026-07-23
**Cycle:** 2 / 100
**Branch:** `codex/review-plan-fix-no-deploy-20260723`
**Reviewers:** code-reviewer, perf-reviewer, architect, security-reviewer, critic, tracer, verifier, debugger, test-engineer, document-specialist, designer
**Deploy mode:** none

## Executive summary

The 11 role reports contain 36 raw findings. Cross-review deduplication plus the
required final independent sweep produces **27 unique findings**: 11 High, 14
Medium, and 2 Low. The largest correctness clusters are catalog/runtime contract
drift, partial parser success that looks complete, CLI calendar semantics, and
unowned asynchronous web work. The final sweep additionally confirmed that the
skip link resolves against the document `<base>` instead of the current route,
and that optimizer disclosures collapse same-named rules from different cards.

Every unique finding is scheduled in Plans 73–78. No Cycle 2 finding is
deferred. The six pre-existing untracked Cycle 42 artifacts remain outside this
review and must not be edited or committed.

| Severity | Unique findings |
|---|---:|
| High | 11 |
| Medium | 14 |
| Low | 2 |
| **Total** | **27** |

## Unique findings

### Domain and catalog correctness

| ID | Severity | Confidence | Finding | Raw sources |
|---|---|---|---|---|
| C2-001 | Medium | High | Merchant-scoped rules marked unsupported emit issues before merchant applicability is checked, so unrelated transactions acquire irrelevant disclosures. | C2-CR-001 |
| C2-002 | High | High | Five Samsung mileage rules are published as supported with `rate + unit:miles`, but the calculator rejects that shape and returns zero. | C2-CR-002 |
| C2-003 | High | High | The browser catalog reader validates Zod-normalized values but returns the raw graph; omitted normalized tier fields can pass validation and produce `NaN`. | C2-CR-003, C2-V-003, C2-ARCH-01, C2-TE-01 |
| C2-004 | High | High | Typed payment/channel/fuel/performance facts supported by core and the catalog cannot enter or survive either product’s parsed transaction path. | C2-CT-001 |
| C2-010 | Medium | High | Reward merchant allowlists compare raw case-sensitive strings while categorization uses normalized merchant text. | C2-V-002 |
| C2-027 | Medium | High | Aggregate calculation issues omit card identity, so common rule IDs such as `reward-001` from different cards deduplicate into one issue and understate disclosures. | Final independent sweep |

### Parser and CLI completeness

| ID | Severity | Confidence | Finding | Raw sources |
|---|---|---|---|---|
| C2-005 | High | High | CLI optimize/report pool every input month into one calculation whose monthly cap trackers span the whole file. | C2-CT-002, C2-TR-01 |
| C2-006 | High | High | JSON/CSV/OFX invalid-date rows are warned about but still enter CLI optimization and reports. | C2-CT-002, C2-TR-02 |
| C2-007 | High | High | Remote PDF fallback advertises a 100,000-character ceiling but silently sends only the first 8,000 characters and presents the subset as complete. | C2-CT-003 |
| C2-008 | High | High | Remote PDF response parsing silently drops malformed model rows without exposing rejected-row counts or errors. | C2-CT-004 |
| C2-009 | Medium | High | Web analysis replaces actionable zero-row parser errors with a generic “no transactions” message. | C2-V-001 |
| C2-022 | Medium | High | Untrusted parser error fields reach CLI terminal sinks without control-sequence or bidi sanitization. | C2-SEC-02 |

### Web lifecycle and admission

| ID | Severity | Confidence | Finding | Raw sources |
|---|---|---|---|---|
| C2-011 | High | High | `reoptimize()` has no operation ownership guard and can overwrite a newer analysis/reset and clear its loading state. | C2-D-001, C2-ARCH-03, C2-TE-03 |
| C2-012 | High | High | Queue cancellation does not reach active parser/PDF work, and browser PDF resources are not explicitly destroyed. | C2-PERF-01, C2-TE-02 |
| C2-013 | Medium | High | The 50 MB aggregate upload limit is warning-only and there is no file-count admission limit. | C2-PERF-02, C2-TE-04 |
| C2-026 | Medium | High | `href="#main-content"` resolves against `<base href="/cherrypicker/">`, so the skip link leaves nested routes instead of focusing their main landmark. | Final independent sweep |

### Runtime efficiency and publication identity

| ID | Severity | Confidence | Finding | Raw sources |
|---|---|---|---|---|
| C2-014 | Medium | High | The server parser’s default entry eagerly loads every format plus the Anthropic SDK even for a local CSV command. | C2-PERF-03, C2-ARCH-04, C2-TE-06 |
| C2-015 | Medium | High | A normal CSV CLI parse reads and decodes the complete file once for detection and again for parsing. | C2-PERF-04, C2-TE-06 |
| C2-016 | Medium | High | Summary, optimizer, detail, and category artifacts have no mandatory shared generation identity, so one session can mix publication generations undetectably. | C2-ARCH-02, C2-TE-05 |

### Documentation, workflow, and report product

| ID | Severity | Confidence | Finding | Raw sources |
|---|---|---|---|---|
| C2-017 | Medium | High | Upload help and analyzer comments describe a retired current-month previous-spending fallback instead of exact previous-calendar-month behavior. | C2-DOC-01 |
| C2-018 | High | High | The README YAML example fails the documented canonical schema. | C2-DOC-02 |
| C2-019 | High | High | `.claude/AGENTS.md` teaches obsolete category, reward, and `discontinued` shapes that publication rejects. | C2-DOC-03 |
| C2-020 | Medium | High | `.claude/AGENTS.md` documents manual copying instead of the multi-artifact `data:build`/`data:check` workflow. | C2-DOC-04 |
| C2-021 | Medium | High | The deploy workflow uses mutable action tags and grants Pages/OIDC writes at workflow scope, including the build job. | C2-SEC-01 |
| C2-023 | Medium | High | The standalone report CSP blocks its own inline stylesheet, leaving the HTML report entirely unstyled. | C2-DES-01 |
| C2-024 | Low | High | Card detail describes inclusive tier maxima as “less than,” contradicting calculator boundary semantics. | C2-DES-02 |
| C2-025 | Low | High | The generated report still exposes the retired `CardPick` product name. | C2-DES-03 |

## Raw-finding coverage matrix

Every raw role finding maps to at least one unique aggregate finding.

| Review | Raw IDs → aggregate IDs |
|---|---|
| code-reviewer | C2-CR-001→C2-001; C2-CR-002→C2-002; C2-CR-003→C2-003 |
| critic | C2-CT-001→C2-004; C2-CT-002→C2-005,C2-006; C2-CT-003→C2-007; C2-CT-004→C2-008 |
| verifier | C2-V-001→C2-009; C2-V-002→C2-010; C2-V-003→C2-003 |
| debugger | C2-D-001→C2-011 |
| perf-reviewer | C2-PERF-01→C2-012; C2-PERF-02→C2-013; C2-PERF-03→C2-014; C2-PERF-04→C2-015 |
| architect | C2-ARCH-01→C2-003; C2-ARCH-02→C2-016; C2-ARCH-03→C2-011; C2-ARCH-04→C2-014 |
| test-engineer | C2-TE-01→C2-003; C2-TE-02→C2-012; C2-TE-03→C2-011; C2-TE-04→C2-013; C2-TE-05→C2-016; C2-TE-06→C2-014,C2-015 |
| document-specialist | C2-DOC-01→C2-017; C2-DOC-02→C2-018; C2-DOC-03→C2-019; C2-DOC-04→C2-020 |
| security-reviewer | C2-SEC-01→C2-021; C2-SEC-02→C2-022 |
| tracer | C2-TR-01→C2-005; C2-TR-02→C2-006 |
| designer | C2-DES-01→C2-023; C2-DES-02→C2-024; C2-DES-03→C2-025 |
| final independent sweep | skip-link URL resolution→C2-026; cross-card issue identity reproduction→C2-027 |

## Plan coverage

| Plan | Scheduled findings |
|---|---|
| 73 — Domain and catalog correctness | C2-001, C2-002, C2-003, C2-004, C2-010, C2-027 |
| 74 — Parser and CLI completeness | C2-005, C2-006, C2-007, C2-008, C2-009, C2-022 |
| 75 — Web lifecycle, cancellation, and admission | C2-011, C2-012, C2-013, C2-026 |
| 76 — Parser runtime efficiency | C2-014, C2-015 |
| 77 — Publication identity and contributor documentation | C2-016, C2-017, C2-018, C2-019, C2-020, C2-024 |
| 78 — Workflow and standalone report integrity | C2-021, C2-023, C2-025 |

No Cycle 2 finding is deferred.

## Verification and process notes

- Reviewer full-suite evidence: 2,196 tests passed, 0 failed on installed Bun
  1.3.12. The repository pin is Bun 1.2.6, so the pinned release gates must
  still run separately.
- Focused reviewer evidence: 194 cross-boundary tests, 206 core/rules tests, 42
  loader/queue/publication tests, and data/docs/migration checks passed.
- No required reviewer failed or required a retry.
- Browser review used an isolated CherryPicker preview/session. That session
  and preview were closed, repository E2E status was clean, and port 4173 was
  clear afterward. The pre-existing xylolabs agent-browser process was
  preserved.
- Cycle 1 Plans 68–71 were archived after their recorded implementation and
  acceptance. Plan 72 remains active because Cycle 2 found publication
  identity and parser-entry work that extends its quality-gate scope.

## Cycle 2 implementation closure

- Plans 73–78 are completed; all 27 unique findings were implemented with no
  deferrals.
- `lint`, `typecheck`, `build`, workspace tests, `test:bun`, standalone
  Vitest, data/docs/migration checks, and `git diff --check` passed.
- The final isolated Playwright rerun passed all 84 tests. Repository-owned
  browser/server processes were cleaned, port 4173 was clear, and the
  unrelated xylolabs agent-browser session remained intact.
- Deploy mode remained `none`.
