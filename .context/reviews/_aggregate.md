# Aggregate Review — CherryPicker Review/Plan/Fix Cycle 9

**Date:** 2026-07-24
**Cycle:** 9 / 100
**Baseline:** `c5c6eab9b421e547d66716e989e08c747cc36aa1`
**Branch:** `codex/review-plan-fix-no-deploy-20260723`
**Deploy mode:** none

## Executive summary

Cycle 9 completed all eleven required review lenses: code reviewer,
performance reviewer, security reviewer, critic, verifier, test engineer,
tracer, architect, debugger, document specialist, and designer. The
repository contains an Astro/Svelte UI, so the designer performed one bounded
live browser interaction after reading the complete agent-browser skill set.
No custom reviewer definitions exist under `.claude/agents`.

The role reports contain **16 raw findings**. Five duplicate groups collapse
to **11 unique findings**: 9 Medium and 2 Low. The highest-signal defects are
false merchant allowlist matches, persisted analysis that remains internally
balanced while contradicting canonical transaction facts, category-spending
UI derived from reward assignments, file-order-dependent greedy rewards, and
malformed dates accepted through permissive prefix matching.

| Severity | Unique findings |
|---|---:|
| Medium | 9 |
| Low | 2 |
| **Total** | **11** |

## Unique findings

### Calculation and analysis truth

| ID | Severity | Confidence | Finding | Raw sources |
|---|---|---|---|---|
| C9-001 | Medium | High | Short Latin `specificMerchants` aliases use unrestricted substring matching and bypass category checks, so the current `CU` rule rewards unrelated merchants such as `SECURITY SERVICE`, `CULTURE CENTER`, and `CUBAN RESTAURANT`. | `C9-CR-01`, `C9-TE-01` |
| C9-002 | Medium | High | Persisted analysis reconciles derived optimizer objects with one another but not with canonical category/count facts. Coordinated category relabels, mixed unassigned-row undercounts, and contradictory truncated monthly/optimizer totals restore successfully. | `C9-AR-01`, `VER-01`, `C9-TE-02` |
| C9-003 | Medium | High | Persisted cap disclosures receive only primitive shape checks; impossible applied rewards, unknown categories, and `capReached` contradictions are accepted. | `C9-AR-01`, `VER-02`, `C9-TE-02` |
| C9-004 | Medium | High | The web “category spending” and top-category views use reward assignments, so unassigned spending disappears, remaining categories are renormalized, and all-unassigned analyses show a false empty state. The E2E oracle observes another component and cannot detect this. | `C9-CT-01`, `C9-TE-03` |
| C9-005 | Medium | High | The greedy optimizer comparator is not total over reward-relevant facts. Tied amount/merchant/date rows preserve upload order and can change reward, card assignment, and unassigned spending; a probe produced 900 versus 500 won. | `RPF9-TRACE-001` |

### Input and worker boundaries

| ID | Severity | Confidence | Finding | Raw sources |
|---|---|---|---|---|
| C9-006 | Medium | High | Shared date parsing accepts arbitrary suffix or surrounding text such as `2024-01-15oops` and `x2024년 1월 15일z`, silently converting damaged rows into valid dates. | `RPF9-DBG-001` |
| C9-007 | Low | Medium | Parser and optimizer worker wrappers do not settle or clean up on the standard `messageerror` event, leaving a likely indefinite loading/worker-lifetime hole under deserialization failure. | `RPF9-DBG-002` |

### Security, documentation, and accessibility

| ID | Severity | Confidence | Finding | Raw sources |
|---|---|---|---|---|
| C9-008 | Medium | Medium | The scraper places untrusted page text and extraction instructions in one LLM message, and structurally valid model output can mark attacker-influenced reward facts as optimizer-supported before manual source review. | `SEC-01` |
| C9-009 | Medium | High | README calls `bun run verify` CI-equivalent although CI additionally requires the Playwright browser suite. | `DOC-01` |
| C9-010 | Medium | High | Root and issuer documentation presents catalog counts and representative benefits without distinguishing browseable cards from optimizer-executable cards; highlighted unsupported-only cards cannot be recommended. | `DOC-02` |
| C9-011 | Low | High | Decorative inline SVGs in upload and card-detail flows remain exposed as unnamed accessibility-tree images. | `C9-D-01` |

## Cross-agent agreement and deduplication

| Aggregate ID | Raw finding IDs | Resolution |
|---|---|---|
| C9-001 | `C9-CR-01`, `C9-TE-01` | Merged at Medium/High. The code reviewer reproduced the false reward; the test engineer proved the existing catalog test observes only diagnostics, not reward output. |
| C9-002 | `C9-AR-01`, `VER-01`, `C9-TE-02` | Merged at Medium/High. All three reports reproduce the same missing canonical transaction/category/count witness, including truncated-state residue. |
| C9-003 | `C9-AR-01`, `VER-02`, `C9-TE-02` | Kept distinct from C9-002 because cap telemetry has its own persisted contract and downstream disclosure semantics, while preserving the architect's shared root-cause context. |
| C9-004 | `C9-CT-01`, `C9-TE-03` | Merged at Medium/High. The product defect and the cross-component false-positive E2E oracle describe the same category-truth boundary. |
| C9-005 | `RPF9-TRACE-001` | Preserved at Medium/High with deterministic 900-versus-500 evidence. |
| C9-006 | `RPF9-DBG-001` | Preserved at Medium/High with direct parser probes and cross-format consumers. |
| C9-007 | `RPF9-DBG-002` | Preserved at Low/Medium and classified likely because browser fault injection is still needed. |
| C9-008 | `SEC-01` | Preserved at Medium/Medium/manual-validation. Shape validation does not establish source truth, and supported output reaches optimizer publication. |
| C9-009 | `DOC-01` | Preserved at Medium/High. |
| C9-010 | `DOC-02` | Preserved at Medium/High. |
| C9-011 | `C9-D-01` | Preserved at Low/High with live accessibility-tree evidence. |

Every raw finding maps to at least one aggregate item. The architect and test
engineer each covered both C9-002 and C9-003, so the aggregate preserves their
evidence without double-counting either unique issue. No severity or
confidence was downgraded to justify planning.

## Rejected competing hypothesis

A leading-NUL XLSX was initially suspected of skipping ZIP admission budgets
because direct `XLSX.read()` returned a workbook named `Sheet1`. Independent
tracer and security retries inspected SheetJS dispatch and reran the product
parser. Non-`PK` input takes the PRN/plaintext path, produces ZIP-gibberish
cells, and returns zero transactions with a header error; it does not enter
ZIP inflation. This is not a finding.

## Validation and live evidence

Reviewers ran repository lint, typecheck, unit tests, focused parser/core/web
tests, scraper security tests, dependency checks, data/document checks, and
executable probes. The green baseline establishes reproducibility but does not
close the findings above.

The designer's single isolated preview run exercised home/upload validation,
successful analysis, keyboard skip navigation, desktop overflow, dark mode,
reduced-motion source behavior, status/focus transitions, accessibility-tree
semantics, and bounded loopback timing. It confirmed one unnamed decorative
image defect and found no distinct responsive, contrast, form-association, or
focus regression.

The attributable preview was PID/PGID `92306` on `127.0.0.1:4173`; the
browser used `/tmp/cherrypicker-c9-designer-profile`. The browser was closed,
the exact preview was interrupted, and independent final checks reported an
empty E2E ownership registry, no port 4173 listener, and no attributable
Playwright, preview, agent-browser, Chrome, or profile process. No unrelated
interactive Chrome tree was signaled.

## Agent execution notes

All eleven role reports completed. Concurrency limits required three initial
workers covering nine lenses, followed by a bounded test/designer rotation.
The security bundle was retried once to remove the disproved prefixed-XLSX
claim. The first test/designer finalization turn was interrupted after cleanup
when it did not return promptly; one report-only retry wrote both provenance
files without another browser run. There are no unrecovered agent failures.

## Plan coverage

Prompt 2 archived completed Cycle 8 plans 108–113 and created six Cycle 9
plans. Every unique finding is scheduled exactly once:

| Plan | Findings | Scope |
|---|---|---|
| 114 | C9-001, C9-005 | Merchant token boundaries and transaction-order determinism |
| 115 | C9-002, C9-003, C9-004 | Canonical category facts, persistence/cap coherence, and dashboard truth |
| 116 | C9-006, C9-007 | Anchored date grammars and worker `messageerror` settlement |
| 117 | C9-008 | Untrusted scraper source quarantine and reviewed promotion |
| 118 | C9-009, C9-010 | CI gate wording and catalog-versus-executable documentation |
| 119 | C9-011 | Decorative inline SVG accessibility semantics |

No finding is deferred. The requested `ralph` skill is not registered in
either available skill root; every plan records the disciplined manual
test-first fallback and preserves signed, fine-grained, no-deploy branch
policy.

## Prompt 3 implementation closure

Plans 114–119 are complete, and all eleven aggregate findings are closed.
Merchant aliases now honor ASCII token boundaries, the optimizer uses a
canonical reward-fact order, and assignment counts are exact. Analysis schema
version 4 persists a canonical latest-month category summary and rejects
transaction, allocation, monthly, optimizer, and cap contradictions. The
dashboard consumes this summary even when every transaction is unassigned.

Date parsing now uses anchored supported grammars, worker wrappers settle and
clean up on `messageerror`, and scraper output remains quarantined until a
source reviewer explicitly promotes it. Contributor and generated catalog
documentation distinguishes the 683 browseable cards from the 566
optimizer-executable cards. All eight reviewed decorative SVGs are absent
from the accessibility tree.

The first owned E2E run found one duplicate category-panel test identifier
introduced while establishing the new test boundary. The redundant inner
identifier was removed, its component contract was tightened, and the exact
E2E command then passed 96 of 96 tests. This is the cycle's single gate-driven
fix.

| Required gate | Final result |
|---|---|
| `bun run lint` | Passed, 0 diagnostics |
| `bun run typecheck` | Passed, 0 diagnostics |
| `bun run build` | Passed, 7 of 7 packages |
| `bun run test` | Passed, 12 of 12 tasks and 70 script tests |
| `bun run test:bun` | Passed, 1,624 tests |
| `bunx vitest run` | Passed, 116 files and 2,870 tests |
| `bun run test:e2e` | Passed, 96 tests |

After E2E, the ownership registry was clean, port 4173 was available with no
listener, and independent process inspection found no attributable residual
preview or Playwright process. No deployment was performed.

## Final missed-issue sweep

Each role recorded its inventory and final sweep. The aggregate rechecked all
raw IDs, exact current-file evidence, duplicate groups, confidence, rejected
hypotheses, protected-file scope, and browser ownership. Historical deferred
performance work was not re-reported as new. No current raw finding is
silently omitted.
