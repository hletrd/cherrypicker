# Aggregate Review — CherryPicker Review/Plan/Fix Cycle 3

**Date:** 2026-07-23
**Cycle:** 3 / 100
**Branch:** `codex/review-plan-fix-no-deploy-20260723`
**Reviewers:** code-reviewer, critic, code-simplifier, verifier,
document-specialist, security-reviewer, tracer, debugger, test-engineer,
qa-tester, perf-reviewer, architect, dependency-expert, designer
**Deploy mode:** none

## Executive summary

The 14 role reports contain 36 raw findings. Cross-role deduplication and the
required final independent sweep produced **28 unique findings**: 4 High, 18
Medium, and 6 Low. Plans 79–83 implemented and verified every finding in this
cycle; there are no Cycle 3 deferrals.

Seven test-engineer findings and two QA findings correlate with production
defects rather than inflating the unique count. The final sweep added three
independently reproduced misses: occurrence limits consumed by unsupported
transactions, long valid JSON misdetected as CSV, and report placeholder
strings being reinterpreted during sequential template replacement.

The completed implementation now fails closed on non-finite facts and incomplete
scraper input, derives publication identity from all generated projections,
uses a content-authenticated SheetJS archive, carries report qualifications
into durable HTML, terminates canceled browser work, keeps replacement state
atomic, and blocks UI focus/reflow/visual regressions. The six pre-existing
untracked Cycle 42 artifacts remained outside this review and were neither
edited nor committed.

| Severity | Unique findings |
|---|---:|
| High | 4 |
| Medium | 18 |
| Low | 6 |
| **Total** | **28** |

## Unique findings

### Domain, parser, and type correctness

| ID | Severity | Confidence | Finding | Raw sources |
|---|---|---|---|---|
| C3-001 | High | High | An unbounded statement `fuelVolumeLiters` fact can overflow a supported won-per-liter reward to `Infinity`, corrupting totals and optimizer comparisons. | C3-CR-001 |
| C3-002 | Medium | High | The browser category artifact is accepted after only array/nonempty checks and cast to `CategoryNode[]`; malformed nodes fail later inside `MerchantMatcher` and poison the session cache. | C3-CR-002 |
| C3-003 | Medium | High | JSON transaction arrays silently discard non-objects and objects missing date/amount, so most rows can disappear while partial success reports zero warnings. | C3-CT-002 |
| C3-004 | Medium | High | `maxUses` occurrence counters advance before tier/unit/fact validation, so an unsupported transaction can consume the only use and suppress a later executable reward. | Final independent sweep |
| C3-005 | Medium | High | Web format sniffing parses only the first 1,024 characters of a 2,048-character prefix, so valid long JSON with an unknown/mismatched extension is classified as CSV. | Final independent sweep |
| C3-006 | Low | High | Server and browser own separate copies of the complete JSON grammar and different test matrices, allowing future parser behavior to diverge. | C3-CS-002 |
| C3-007 | Low | High | The Svelte store mirrors six public core result interfaces instead of importing them, allowing persistence/UI contracts to drift without a compile-time failure. | C3-CS-003 |

### Runtime, publication, scraper, and dependency boundaries

| ID | Severity | Confidence | Finding | Raw sources |
|---|---|---|---|---|
| C3-008 | High | High | Publication identity hashes source inputs but not normalized artifact bytes or the generator/schema contract, so old and new projections can share a `sourceHash` and pass mixed-generation checks. | C3-ARCH-001 |
| C3-009 | Medium | High | Default CLI optimize/report reparses all 683 authoring YAML files instead of the canonical compiled optimizer catalog, creating web/CLI contract drift plus roughly 300 ms and 185 MiB startup cost. | C3-PERF-002, C3-ARCH-002 |
| C3-010 | Medium | High | CSV “worker” parsing still decodes the full file, scans all bank signatures, counts replacement characters, and clones the string on the main thread before worker parsing. | C3-PERF-001 |
| C3-011 | Medium | High | Scraper input beyond 40,000 UTF-16 units is silently omitted from the model-visible source while the caller and written catalog still receive an ordinary success result. | C3-TR-001, C3-TE-005 |
| C3-012 | Medium | High | The scraper imports Zod directly without declaring it, so isolated or strict workspace installation cannot resolve a production dependency. | C3-DEP-002 |
| C3-013 | High | High | The SheetJS runtime tarball is locked by HTTPS URL without a content-integrity digest; frozen resolution does not authenticate changed bytes at that URL. | C3-DEP-001 |
| C3-014 | Low | High | Seven heavy direct dependencies have no production consumer, retaining unnecessary install, update, and supply-chain surface. | C3-DEP-003 |

### CLI and standalone report integrity

| ID | Severity | Confidence | Finding | Raw sources |
|---|---|---|---|---|
| C3-015 | High | High | The durable CLI HTML report omits parse/calendar exclusions, previous-spending basis, and unsupported-rule limitations that were disclosed only in the generating terminal. | C3-CT-001 |
| C3-016 | Medium | High | The report escape helper pre-decodes unbounded numeric entities with `String.fromCodePoint`, so invalid or oversized entities crash report generation. | C3-CS-001, C3-DBG-002, C3-TE-003 |
| C3-017 | Medium | High | Sequential `replaceAll` calls reinterpret user data matching later template placeholders; a card named `{{CARD_COMPARISON}}`, for example, injects a second report table. | Final independent sweep |
| C3-018 | Medium | High | Catalog/taxonomy strings reach visualization tables and optimization disclosures without the existing terminal sanitizer, preserving OSC, CSI, control, and bidi payloads. | C3-SEC-001, C3-TE-001 |
| C3-019 | Medium | High | Report output validation uses the input-style `mustExist: false` path and then follows an existing final-component symlink, truncating its target. | C3-SEC-002, C3-TE-002 |
| C3-020 | Medium | High | Subcommand `--help` is treated as a statement path, and report usage omits correctness-critical catalog, bank, category, and previous-spending options. | C3-DOC-001 |
| C3-021 | Low | High | Analyze, optimize, and report silently ignore unknown, stray, incomplete, or invalidly typed options, allowing typos to select defaults without failing. | C3-DBG-004 |

### Web lifecycle, UI, and release regression coverage

| ID | Severity | Confidence | Finding | Raw sources |
|---|---|---|---|---|
| C3-022 | Medium | High | The analysis abort signal stops parser work but is not threaded through category/catalog waits or optimizer execution, so canceled runs retain downstream network/validation/CPU work. | C3-TR-002, C3-TE-006 |
| C3-023 | Medium | High | A failed replacement analysis clears the in-memory result but leaves the prior `sessionStorage` entry, which reload/navigation resurrects as if it were current. | C3-DBG-001, C3-TE-004, C3-QA-001 |
| C3-024 | Medium | High | Dropping a new file during the 1.2-second success countdown does not cancel the old navigation timer, so the new selection is discarded by navigation to the prior result. | C3-DBG-003, C3-TE-007, C3-QA-002 |
| C3-025 | Medium | High | Entering card detail from the keyboard removes the grid and leaves focus on `<body>`; returning likewise does not restore focus to the originating card. | C3-DES-001 |
| C3-026 | Medium | High | The home hero’s `-mx-6` exceeds the mobile container padding and widens a 375 px document to 383 px, producing horizontal page overflow. | C3-DES-002 |
| C3-027 | Low | High | The Korean card-detail navigation landmark exposes the untranslated accessible name “breadcrumb.” | C3-DES-003 |
| C3-028 | Low | High | Screenshot tests only capture PNGs and are excluded from the release gate; no stable visual baseline or diff can fail on covered CSS/layout regressions. | C3-QA-003 |

## Raw-finding coverage matrix

Every raw role finding maps to at least one unique aggregate finding.

| Review | Raw IDs → aggregate IDs |
|---|---|
| code-reviewer | C3-CR-001→C3-001; C3-CR-002→C3-002 |
| critic | C3-CT-001→C3-015; C3-CT-002→C3-003 |
| code-simplifier | C3-CS-001→C3-016; C3-CS-002→C3-006; C3-CS-003→C3-007 |
| verifier | verification matrix→C3-001,C3-002,C3-003,C3-006,C3-007,C3-015,C3-016,C3-020 |
| document-specialist | C3-DOC-001→C3-020 |
| security-reviewer | C3-SEC-001→C3-018; C3-SEC-002→C3-019 |
| tracer | C3-TR-001→C3-011; C3-TR-002→C3-022 |
| debugger | C3-DBG-001→C3-023; C3-DBG-002→C3-016; C3-DBG-003→C3-024; C3-DBG-004→C3-021 |
| test-engineer | C3-TE-001→C3-018; C3-TE-002→C3-019; C3-TE-003→C3-016; C3-TE-004→C3-023; C3-TE-005→C3-011; C3-TE-006→C3-022; C3-TE-007→C3-024 |
| qa-tester | C3-QA-001→C3-023; C3-QA-002→C3-024; C3-QA-003→C3-028 |
| perf-reviewer | C3-PERF-001→C3-010; C3-PERF-002→C3-009 |
| architect | C3-ARCH-001→C3-008; C3-ARCH-002→C3-009 |
| dependency-expert | C3-DEP-001→C3-013; C3-DEP-002→C3-012; C3-DEP-003→C3-014 |
| designer | C3-DES-001→C3-025; C3-DES-002→C3-026; C3-DES-003→C3-027 |
| final independent sweep | premature occurrence accounting→C3-004; long-JSON detection reproduction→C3-005; report placeholder-collision reproduction→C3-017 |

## Independent reproduction evidence

- `maxUses: 1` fuel fixture, missing facts first and valid 10-liter
  transaction second: `totalReward: 0`, one unsupported issue. The valid
  transaction should receive the only use.
- A 6,508-character valid JSON transaction wrapper named `statement.txt`:
  `detectFormatFromFile()` returned `csv`.
- A report whose best-card name is `{{CARD_COMPARISON}}`: the generated HTML
  contained two “카드별 혜택 비교” table captions.

## Plan coverage

Every Cycle 3 finding is scheduled. There are no Cycle 3 deferrals.

| Plan | Scheduled findings |
|---|---|
| 79 — Domain and parser correctness | C3-001 through C3-007 |
| 80 — Publication, runtime, and dependency boundaries | C3-008 through C3-014 |
| 81 — CLI and standalone report integrity | C3-015 through C3-021 |
| 82 — Web cancellation and state transitions | C3-022 through C3-024 |
| 83 — UI focus, reflow, localization, and visual regressions | C3-025 through C3-028 |

Plans 73–78 were already fully implemented and verified in Cycle 2 and were
archived before Cycle 3 implementation. Plan 72 remains active only as the
historical home for its explicitly recorded Cycle 1 deferrals.

## Implementation closure

| Plan | Status | Findings |
|---|---|---|
| 79 — Domain and parser correctness | completed | C3-001 through C3-007 |
| 80 — Publication, runtime, and dependency boundaries | completed | C3-008 through C3-014 |
| 81 — CLI and standalone report integrity | completed | C3-015 through C3-021 |
| 82 — Web cancellation and state transitions | completed | C3-022 through C3-024 |
| 83 — UI focus, reflow, localization, and visual regressions | completed | C3-025 through C3-028 |

All 28 findings have implementation and regression evidence in their owning
plan. No Cycle 3 item was deferred or silently dropped.

## Verification and process notes

- Required gates passed: repository lint, typecheck, and build; Turbo test;
  `bun run test:bun` (1,660 tests); `bunx vitest run` (2,290 tests); and
  `bun run test:e2e` (90 browser tests).
- Data build/check published 683 cards across 24 issuer shards with identity
  `392b610e498cc3fc793b41c8cfc572c1f75b50ae853f967433568b829c2cbffd`.
- Dependency policy, catalog publication/parity, fresh-process CLI budgets,
  scoped Astro diagnostics, and `git diff --check` passed.
- The first E2E run identified a report-fixture contract omission and the
  loading/detail-focus timing race; both were fixed. The first Vitest run also
  identified one Bun-only process-contract file crossing the Node runner
  boundary; it is now explicitly owned by the Bun suite. A Vite
  static/dynamic import warning was removed by using one static card-catalog
  boundary.
- The two committed visual baselines passed after inspection. A deliberate
  temporary test-only border change failed exactly those two assertions and
  emitted inspectable diff artifacts; the change was removed afterward.
- The first security/trace reviewer attempt was blocked by an automated content
  classifier. The single permitted retry was narrowed to defensive local
  correctness/error-path/test review and completed all five assigned reports.
  No other reviewer failed.
- Designer review used only the isolated
  `AGENT_BROWSER_SESSION=c3-cherrypicker-designer` and port 43217. Its browser
  and preview were closed; repository E2E ownership is clean and ports 43217
  and 4173 are clear. Unrelated Travelback and xylolabs process trees were not
  signalled.
- Every managed browser run was preceded and followed by a repository-scoped
  ownership audit. Port 4173 was clear after cleanup, and unrelated Travelback
  and xylolabs process trees were not signalled.
- No deployment was performed. Deploy mode remains `none`.
