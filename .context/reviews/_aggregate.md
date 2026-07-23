# Aggregate Review — CherryPicker Review/Plan/Fix Cycle 6

**Date:** 2026-07-24
**Cycle:** 6 / 100
**Baseline:** `449f10a2faffaae2a2c47036070b0e61a5b6eec2`
**Branch:** `codex/review-plan-fix-no-deploy-20260723`
**Deploy mode:** none

## Executive summary

Cycle 6 reviewed every tracked product surface through eleven required lenses:
code reviewer, critic, architect, performance reviewer, security reviewer,
tracer, debugger, verifier, test engineer, document specialist, and designer.
The repository contains a UI, so the designer performed both a source review
and a bounded live browser pass. The repository has no custom reviewer
definitions under `.claude/agents`; generic role agents were used.

The lens reports contain **20 raw findings**. Two duplicate groups were merged:

- `C6-CR-003` and `C6-CT-001` describe the same missing required-merchant
  enforcement.
- `RPF6-ARCH-001` and `C6-DOC-001` describe the same stale Astro major in the
  agent architecture guide.

After cross-role deduplication, Cycle 6 has **18 unique findings**: 3 High, 13
Medium, and 2 Low. The highest risks are reward rules that suppress valid
wildcard earnings, OFX currency that is silently relabeled as KRW, and a
browser release gate that treats retry-only passes as success. The remaining
findings cover exact reward arithmetic, state-aware alternatives, parser and
catalog invariants, consent and filesystem binding, async ownership, catalog
identity in the UI, and documentation/gate truth.

The six pre-existing untracked Cycle 42 artifacts were treated as protected
user work and remained outside the review.

| Severity | Unique findings |
|---|---:|
| High | 3 |
| Medium | 13 |
| Low | 2 |
| **Total** | **18** |

## Unique findings

### Reward and optimizer correctness

| ID | Severity | Confidence | Finding | Raw sources |
|---|---|---|---|---|
| C6-001 | High | High | A zero-value category-specific exclusive rule suppresses an applicable positive wildcard base reward. | `C6-CR-001` |
| C6-002 | Medium | High | Binary floating-point percentage conversion floors exact decimal rewards one Won too low. | `C6-CR-002` |
| C6-003 | Medium | High | Grouped alternatives sum independently scored losing-card transactions and overstate capped, use-limited, or per-day rewards. | `RPF6-DBG-001` |

### Parser, CLI, and persisted-input integrity

| ID | Severity | Confidence | Finding | Raw sources |
|---|---|---|---|---|
| C6-004 | Medium | High | JSON, HTML, OFX, PDF, and persisted transactions bypass the shared required-merchant contract. | `C6-CR-003`, `C6-CT-001` |
| C6-005 | High | High | OFX `<CURDEF>` is discarded and foreign or unspecified amounts are later labeled and optimized as KRW. | `C6-VR-001` |
| C6-006 | Medium | High | CLI `analyze` exits successfully and prints a normal-looking 100% total for a statement with no parsed transactions. | `C6-VR-002` |
| C6-007 | Low | High | Common UTF-8 statement decoding performs three whole-input decoder passes. | `RPF6-PERF-001` |

### Catalog, selection, and UI identity

| ID | Severity | Confidence | Finding | Raw sources |
|---|---|---|---|---|
| C6-008 | Medium | High | A partially stale explicit card selection silently narrows the requested optimization scope. | `C6-CT-002` |
| C6-009 | Medium | High | Duplicate reward-tier references pass validation and are resolved by array order. | `C6-CT-003` |
| C6-010 | Medium | High | Future `lastUpdated` dates pass the shared/custom-CLI catalog boundary despite stricter publication and scraper checks. | `C6-VR-003` |
| C6-011 | Low | High | A stale quick-detection promise can overwrite the bank hint for the current upload selection. | `RPF6-TRACE-001` |
| C6-012 | Medium | High | Shared `bnk` UI labels present shipped BNK Busan cards as BNK Gyeongnam products. | `D6-01` |

### Security boundaries

| ID | Severity | Confidence | Finding | Raw sources |
|---|---|---|---|---|
| C6-013 | Medium | High | CLI and scraper writers retain only a validated pathname, so replacing an intermediate directory can redirect a later write. | `RPF6-SEC-001` |
| C6-014 | Medium | High | Remote-PDF consent is bound to a pathname, not to the immutable bytes inspected before consent. | `RPF6-SEC-002` |

### Test, workflow, and documentation truth

| ID | Severity | Confidence | Finding | Raw sources |
|---|---|---|---|---|
| C6-015 | High | High | CI retries browser tests without `failOnFlakyTests`, allowing retry-only passes through the release gate. | `C6-TE-001` |
| C6-016 | Medium | High | Documentation truth tests omit authoritative agent and generated-source surfaces, allowing known false claims to remain green. | `C6-TE-002` |
| C6-017 | Medium | High | `.claude/CLAUDE.md` still declares Astro 6 while the application runs Astro 7. | `RPF6-ARCH-001`, `C6-DOC-001` |
| C6-018 | Medium | High | The catalog generator and generated fallback header prescribe a Node command that fails in this repository. | `C6-DOC-002` |

## Cross-role agreement and deduplication

| Aggregate ID | Raw finding IDs | Resolution |
|---|---|---|
| C6-001 | `C6-CR-001` | Preserved at High/High. |
| C6-002 | `C6-CR-002` | Preserved at Medium/High. |
| C6-003 | `RPF6-DBG-001` | Preserved at Medium/High. |
| C6-004 | `C6-CR-003`, `C6-CT-001` | Merged; both trace the same cross-format merchant invariant. |
| C6-005 | `C6-VR-001` | Preserved at High/High. |
| C6-006 | `C6-VR-002` | Preserved at Medium/High. |
| C6-007 | `RPF6-PERF-001` | Preserved at Low/High. |
| C6-008 | `C6-CT-002` | Preserved at Medium/High. |
| C6-009 | `C6-CT-003` | Preserved at Medium/High. |
| C6-010 | `C6-VR-003` | Preserved at Medium/High. |
| C6-011 | `RPF6-TRACE-001` | Preserved at Low/High. |
| C6-012 | `D6-01` | Preserved at Medium/High. |
| C6-013 | `RPF6-SEC-001` | Preserved at Medium/High. |
| C6-014 | `RPF6-SEC-002` | Preserved at Medium/High. |
| C6-015 | `C6-TE-001` | Preserved at High/High. |
| C6-016 | `C6-TE-002` | Kept distinct from the two defects it failed to detect because the false-green gate is an independently actionable control gap. |
| C6-017 | `RPF6-ARCH-001`, `C6-DOC-001` | Merged and preserved at the higher Medium/High rating. |
| C6-018 | `C6-DOC-002` | Preserved at Medium/High. |

Every raw finding maps to exactly one aggregate finding. No finding was
downgraded because another reviewer did not independently report it.

## Validation and live evidence

Baseline non-browser gates were green: lint, typecheck, build, and the root
test task passed. Reviewer-focused validation additionally reported 2,620 Bun
tests, 2,550 Vitest tests, and `data:check` for all 683 cards and 24 issuers as
passing. These baseline results establish reproducibility but do not close the
findings above.

The designer's isolated production-preview pass exercised the home, upload,
validation, and dashboard flows at 1440×1000 in dark and light themes. It
verified keyboard focus, live validation, upload errors, the analyzed
dashboard, same-origin data requests, and console/page-error cleanliness. The
runtime exposed `BNK경남` at `[data-testid="bank-pill-bnk"]` and
`BNK경남은행 부자되세요 아파트카드` for a card from the canonical Busan Bank
shard, confirming C6-012. Mobile/tablet, synthetic RTL, reduced-motion runtime,
forced catalog failure, print preview, and field performance were explicitly
left unverified rather than inferred as passing.

The browser and preview used unique session/profile/marker ownership. Exact
owned PIDs were reaped, port 4173 was available afterward, and the unrelated
Travelback Playwright process tree observed during preflight was not touched.

## Agent execution notes

All eleven required role reports completed. The first security-review attempt
was rejected by an automated classifier; a single benignly framed retry
completed the same bounded review. The designer's long live-review turn was
interrupted only after its exact owned processes had already been cleaned; a
single no-browser finalization retry produced the provenance report from the
collected evidence. Both retries recovered successfully. There are no
unresolved role failures.

## Plan coverage

Prompt 2 archived the seven completed Cycle 5 plans (89–95) and created six
Cycle 6 plans. Every unique finding is assigned exactly once:

| Plan | Findings | Scope |
|---|---|---|
| 96 | C6-001, C6-002, C6-003 | Reward selection, exact arithmetic, grouped alternatives |
| 97 | C6-004, C6-005, C6-006, C6-007 | Merchant/currency/empty CLI/decode integrity |
| 98 | C6-008, C6-009, C6-010 | Explicit selection, tier uniqueness, freshness |
| 99 | C6-011, C6-012 | Async upload ownership and BNK identity |
| 100 | C6-013, C6-014 | Output directory binding and immutable PDF consent |
| 101 | C6-015, C6-016, C6-017, C6-018 | CI fail-closed behavior and documentation truth |

No finding is deferred. Security, correctness, and test-gate findings remain
mandatory for Prompt 3. The requested `ralph` skill is not installed in either
available skill root, so all six plans explicitly require the disciplined
manual iterative fallback.

## Final missed-issue sweep

Each role performed a bounded final sweep after its primary trace. The
aggregate additionally reconciled all raw IDs, severities, duplicates,
baseline claims, and UI evidence. No raw finding is omitted, and no additional
cross-role duplicate remains.

## Prompt 3 closure

All six plans were implemented with no deferrals. The closing integration and
security audits found five implementation edge cases within existing Cycle 6
findings, not new Prompt 1 findings:

- C6-001: preserve unsupported disclosures before cap exits and project
  same-transaction additive consumption into exclusive shared-cap selection.
- C6-002: validate unknown reward types before a tiny percentage floors to
  zero.
- C6-005: bind currency to every transaction-bearing OFX statement and reject
  mixed, nested, or ambiguous currency.
- C6-013: scrub detached temporary payloads through their retained handles
  after an output-directory identity change.

Focused closure evidence included 200 core tests, 49 OFX parity tests, and 100
filesystem/consent security tests. The finalized implementation passed the
required repository gates: lint, typecheck, build, root tests, the Bun-targeted
suite, Vitest, and 96 regression E2E tests. Web lint/type diagnostics reported
zero errors, warnings, or hints. E2E ownership preflight and postflight were
clean, with no owned run remaining and port 4173 available. No deployment was
performed.
