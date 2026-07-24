# Cycle 14 — Code Reviewer

## Review identity and disposition

- **Reviewed revision:** `5260bbd9b6f44ff35cf1bb9a11819354003e5161`
- **Branch:** `codex/review-plan-fix-no-deploy-20260723`
- **Lens:** correctness, logic, code quality, SOLID boundaries, cross-package
  contracts, failure behavior, state ownership, and maintainability
- **Disposition:** **0 genuinely new current-HEAD findings**
- **Finding count:** 0 Critical, 0 High, 0 Medium, 0 Low
- **Confidence:** High
- **Manual validation required:** None

This was a review-only pass. No product source, test, generated source,
dependency, plan, commit, deployment, or protected Cycle 42 artifact was
changed. The only file added by this lane is this report.

## Complete inventory and coverage

I built the inventory from the exact Git tree before reviewing implementation.
HEAD contains **2,337 tracked files**:

| Family | Files | Review treatment |
| --- | ---: | --- |
| `.context` reviews and plans | 1,169 | Complete path/topic inventory; Cycle 12 and 13 aggregates, specialist reports, completed plans, archived plans, and all historical hits for retained/rejected candidates were reconciled |
| `packages` | 880 | Implementation, tests, data, and configs inventoried; calculator, cap state, optimizer, parser kernels, rule validation/publication, and viz sinks traced directly |
| `apps` | 171 | Implementation, tests, and configs inventoried; upload, parsing, analysis, worker protocol, persistence/coherence, store ownership, and every browser result sink traced directly |
| `tools` | 63 | CLI parse/analyze/optimize/report flow and scraper fetch/extract/validate/write boundaries inspected |
| `scripts` | 19 | Toolchain, dependency/peer, publication, migration, README, bundle, and E2E-process checks inspected and executed |
| `e2e` | 16 | Runner ownership and browser regression specifications inventoried; current cap-disclosure and duplicate-transaction regressions inspected |
| Root, workflow, instructions, vendor policy, `.omc` | 19 | Direct inspection plus executable consistency, dependency, audit, documentation, and build gates |

The tree contains 1,197 Markdown, 685 YAML, 323 TypeScript, 59 JSON, 15
Svelte, 14 JavaScript, 13 CSV, 6 Astro, 5 HTML, and 20 other tracked files.
There are 358 tracked TS/JS/Svelte/Astro paths and 178 test/E2E paths. After
excluding tests, generated Astro declarations, generated label/keyword
populations, and E2E files, the implementation sweep covered 202 files and
38,715 lines. The declarative population was checked through its complete
schema/publication gates rather than sampled: **683 authored card YAML files,
24 issuers, and 551 optimizer-executable cards**.

The complete sorted manifest SHA-256 is
`9f94d22676f9f96ff85a5e33b89756985a0ca24091ed3ec4905dfbaa9524e2ac`.
Excluding `.context`, it is
`ae2dee19c2745ee764d2986f1fd129e0da496fabf7a982377502134f48166fce`.

Cross-file traces included:

1. statement bytes → bounded format/encoding detection → concrete parser →
   typed transaction facts → categorization → calendar/performance context;
2. card YAML → schema and semantic validation → optimizer artifact → web/CLI
   readers → prepared reward rules → greedy allocation;
3. reward candidate selection → per-transaction/rule/shared/card-global caps
   → rollback/stateful reservations → portfolio-loss reconciliation;
4. optimizer result → worker decoder → analysis coherence → persistence
   projection/migration/reload → dashboard, results, in-app report, terminal,
   and standalone HTML report;
5. upload/parser/optimizer cancellation and epochs → analysis replacement,
   reset, and session restore;
6. scraper target/network policy → bounded fetch → untrusted model output →
   quarantine/semantic validation → guarded writer;
7. manifests and lock graph → peer validation, audit, build graph, bundle
   budgets, generated artifacts, README, and deployment workflow.

## Findings

**None.** No candidate survived current-HEAD reproduction, cross-file
validation, and historical deduplication. Consequently there is no file/line,
severity, confidence, validation mode, failure scenario, or fix entry to
promote in this cycle.

## Cycle 13 closure verification

All three Cycle 13 roots are closed on this exact revision:

| Prior root | Current evidence | Disposition |
| --- | --- | --- |
| C13-001, post-cap loss hidden by event-local reach telemetry | `packages/core/src/models/result.ts:37-75,87-114`; `packages/core/src/calculator/reward.ts:1130-1260`; `packages/core/src/optimizer/greedy.ts:620-887,959-972`; browser/viz persistence and presentation paths | Fixed by `d7ffac3`; exact portfolio losses now reconcile cap-free and capped outcomes, while non-representable stateful cases preserve `undefined` as “unknown” |
| C13-002, cap-coherence validation repeated in the hot path | `packages/core/src/calculator/reward.ts:1127-1174`; `packages/core/src/optimizer/greedy.ts:568-669` | Fixed by `4fa1385`; rules are validated/prepared once and the internal proof-bearing path is reused |
| C13-003, installed optional peer mismatch escaped dependency policy | `scripts/check-dependencies.ts`; `scripts/__tests__/check-dependencies.test.ts`; `bun.lock` | Fixed by `b25b462`; present optional peers and required peers are resolved at the owning lock scope and range-checked |

The nine Cycle 12 fixes also remain closed: visible cap identity/coherence,
standalone cap-period preservation, scraper empty-content rejection, CLI
statement-buffer ownership, source-host contrast, root parse routing,
scraper provenance wording, browser cap disclosure coverage, and pull-request
verification boundaries.

## Duplicate and rejected candidate ledger

| Candidate | Disposition on current HEAD |
| --- | --- |
| **Prefixed/leading-NUL XLSX ZIP inflation** | **Explicitly rejected again, not resurrected.** `preflightXLSXArchive` ZIP-inspects only an offset-zero `PK` signature; prefixed probes remain on the non-ZIP/plaintext route and do not reach archive inflation. This pass found no new reproducible evidence. |
| Same-category visible cap identity | Duplicate of Cycle 12 C12-CT-001 / Plan 129; its current regression and coherence checks pass. |
| Shared cap group spanning categories | Prospective schema/API concern only. Complete catalog validation still finds no supported current witness spanning categories, so there is no current failure scenario to promote. |
| Negative offsets or cross-card stateful `maxUses`/fixed-per-day telemetry | Intentional conservative contract, not silent loss: these cases publish `portfolioCapLosses: undefined` when exact additive reconciliation cannot be proved. Randomized stateful comparisons confirmed defined output is exact. |
| Unassigned counterfactual card name without an aggregate name witness | Rejected as a hardening idea, not a current defect. A locally edited session payload can alter display-only text when the card is absent from assignment/card-result/best-single witnesses (`apps/web/src/lib/analysis-result.ts:265-291`), but no fresh producer emits that mismatch, arithmetic is unaffected, and current persistence has no authoritative catalog-name map from which to prove it. |
| Cycle 42 web amount double-negative | Stale artifact from commit `7fa6eef`. The web entry point now re-exports the canonical browser-safe parser and explicitly preserves `(-1234)` semantics (`apps/web/src/lib/parser/amount.ts:1-7`); current tests pass. |
| Cycle 42 non-finite optimization/monthly-breakdown fields | Stale and fixed. Deserialization requires safe integers/finite rates and valid year-month entries before a full coherence check (`apps/web/src/lib/persistence.ts:745-915`). |
| Cycle 42 `safeJSONParse` key-list claim | Previously rejected and still unsupported: forbidden keys are rejected at every depth, only plain objects survive, exhaustive shapes are checked, and no prototype-writing merge sink or executable payload exists (`apps/web/src/lib/persistence.ts:68-125,720-915`). |
| Parser duplication | Historical D-01 debt, substantially reduced by canonical browser-safe shared entry points; no new parity failure was reproduced. |
| Designer upload stall | Still lacks a reproducible DOM, console, worker, or epoch trace. Current queue/worker ownership tests and the full build pass. |
| Decorative SVG names, CSP `unsafe-inline`, sessionStorage confidentiality, optimizer replay redesign | Historical rejected/deferred items with no new current-HEAD evidence; not duplicated here. |

The six pre-existing untracked Cycle 42 artifacts were byte-identical before
and after review. Their SHA-256 values remain:

- plan `596dc91904a642bbfe5a5f5c338025023a1e5d0c2c92d9842353233c4fc0ac7a`;
- aggregate `272a70771bc14dbe131a8aef65907402c5f07f12fc0c798d535a5ef4a67ee4d1`;
- code reviewer `1dbdd1bdf8e2d672075e73e34b5b2043b33f74a36b938085b8efeafd03f03266`;
- debugger `6c6aa0d14a9129109341ac285de900bff8af8c38425a03f09e012206266c3df0`;
- security reviewer `c7909307ce1387d617e9d7f51180a6eb8d7b12e1bfffe30bf5fe5dafdbd9a6a5`;
- test engineer `c3fbf7a4ec5628902bce36af73f9d7c6b223c82e6d1360bac44e80d7612a3e9f`.

## Executable verification

- `bun run verify` — **PASS**. Toolchain pin, domain migration, dependency and
  locked-peer policy, `bun audit`, all 683-card generated-data and README
  checks, every workspace lint/typecheck, all workspace/root unit tests, Astro
  static build, and bundle budgets completed with zero failures. Astro
  reported 0 errors, 0 warnings, and 0 hints; `bun audit` found no
  vulnerabilities.
- Focused Cycle 13/web/viz/dependency suite — **303 passed, 0 failed, 992
  assertions** across cap-loss telemetry, prepared-cap validation, analysis
  coherence, worker decoding, persistence, disclosures, and peer policy.
- Non-stateful randomized cap differential — **100,000 cases**. Every defined
  loss array exactly equaled `cap-free totalReward - capped totalReward`
  (`98,847` defined; `1,153` intentional unknown).
- Stateful randomized differential — **70,000 cases** including `maxUses` and
  fixed-per-day state. Every defined loss array reconciled exactly (`25,240`
  defined; `44,760` intentional unknown).
- Fresh optimizer → worker protocol fuzz — **20,000 randomized outputs**, all
  accepted by the browser decoder.
- Fresh full analysis → coherence fuzz — **20,000 randomized snapshots**, all
  accepted by `isAnalysisResultCoherent`.
- `git diff --check` — **PASS**.

## Final missed-file sweep

The closing pass revisited safe-integer arithmetic, rule preparation and proof
ownership, tier/condition selection, additive/exclusive projection,
per-transaction/shared/global caps, rollback and stateful reservation
histories, deterministic ordering and duplicate transaction occurrences,
optimizer counterfactual selection, telemetry completeness, calendar and
previous-spending provenance, all parser format/encoding/direction boundaries,
XLSX preflight routing, worker terminal ownership, persistence migrations and
coherence, catalog publication, CLI and report sinks, scraper trust/write
boundaries, generated documentation, dependency/lock policy, workflow
permissions, and browser presentation on dashboard/results/report.

No missed file or cross-file interaction produced a second current-HEAD
candidate. This lane changed only this review report. A concurrent lane added
`cycle14-test-engineer.md` during the final status check; all six protected
untracked artifacts remained unchanged.
