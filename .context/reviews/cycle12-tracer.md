# Review-plan-fix Cycle 12 — tracer

- Date: 2026-07-24
- Traced revision: `e72a4c69f7c0eab7053c61a587c2d040760c236c`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Disposition: **all nine retained Cycle 12 findings trace end to end;
  no genuinely new tracer finding**
- Unique tracer additions: **0**
- Reconciled Cycle 12 result: **9 retained findings — 6 Medium, 3 Low;
  1 historical duplicate rejected**
- Scope: read-only source, test, history, and bounded local probe review plus
  this report; no implementation, tracked-file edit, staging, commit, push,
  browser/E2E/server run, deployment, or external-system mutation

## Revision, inventory, and cleanliness lock

The trace was locked to the exact revision above. The tracked inventory
contains **2,291 paths**: **1,129** tracked `.context` paths and **1,162**
active product, data, test, documentation, workflow, configuration, and
vendor-integrity paths.

| Active family | Tracked paths |
| --- | ---: |
| `apps/web` | 168 |
| `packages/core` | 43 |
| `packages/parser` | 86 |
| `packages/rules` | 734 |
| `packages/viz` | 14 |
| `tools/cli` | 28 |
| `tools/scraper` | 35 |
| `scripts` | 19 |
| `e2e` | 16 |
| Root/config/workflow/vendor/other | 19 |

The sorted tracked-path manifest hashed to
`1e63a3eb6976ea3c9026611a888d460fdc589166021f1add07987793bb2f4ff4`.
The corresponding 1,162-path active manifest hashed to
`a36230ca2fc486313b206852fd5864f1fa3931850bfa33e6dac5e0e4ac88be1d`.

At entry, `git status --short` contained untracked review artifacts only: the
six protected Cycle 42 files and the available Cycle 12 specialist reports.
Both the unstaged and staged tracked diffs were empty. The protected artifact
hashes at entry were:

| Protected Cycle 42 artifact | SHA-256 |
| --- | --- |
| `.context/plans/67-high-priority-cycle42.md` | `596dc91904a642bbfe5a5f5c338025023a1e5d0c2c92d9842353233c4fc0ac7a` |
| `.context/reviews/cycle42-aggregate.md` | `272a70771bc14dbe131a8aef65907402c5f07f12fc0c798d535a5ef4a67ee4d1` |
| `.context/reviews/cycle42-code-reviewer.md` | `1dbdd1bdf8e2d672075e73e34b5b2043b33f74a36b938085b8efeafd03f03266` |
| `.context/reviews/cycle42-debugger.md` | `6c6aa0d14a9129109341ac285de900bff8af8c38425a03f09e012206266c3df0` |
| `.context/reviews/cycle42-security-reviewer.md` | `c7909307ce1387d617e9d7f51180a6eb8d7b12e1bfffe30bf5fe5dafdbd9a6a5` |
| `.context/reviews/cycle42-test-engineer.md` | `c3fbf7a4ec5628902bce36af73f9d7c6b223c82e6d1360bac44e80d7612a3e9f` |

## End-to-end propagation matrix

| Retained finding | Producer and admission boundary | State propagation and final consumer | Test/history reconciliation |
| --- | --- | --- | --- |
| `C12-CR-001` — shared `capGroup` coherence | Authored YAML, scraper output, or CLI catalog input reaches the rule schema, which requires a string group (`packages/rules/src/schema.ts:242`), but semantic validation checks rules and ambiguities without enforcing coherent cap/reward meaning across one group (`packages/rules/src/catalog-validation.ts:201-455`). Build, CLI, and scraper validators all admit that semantic result (`scripts/build-json.ts:198`; `tools/cli/src/card-catalog.ts:45-56`; `tools/scraper/src/validators.ts:31-64`). | `buildRuleKey` promotes `capGroup` to identity (`packages/core/src/calculator/reward.ts:88-90`). The same key drives monthly cap state and fixed-per-day occurrence state in projected and actual calculations (`:315-387,633-639,789-805,837-860,897-968`), so the optimizer, worker, persistence, and every output sink receive an already incorrect total and cannot repair it. | Existing Cycle 6/9 tests cover coherent shared groups only (`packages/core/__tests__/cycle6-reward-correctness.test.ts:292-325`; `packages/core/__tests__/cycle9-calculation-determinism.test.ts:268-303`). The validator tests do not combine inconsistent shared caps or independent daily rewards. Plan 127 concerned post-calculation plural telemetry identity, not this calculation-state collision. |
| `C12-CR-002` — standalone HTML cap period | The calculator emits typed `CapInfo`, including `per_transaction` (`packages/core/src/models/result.ts:25-35`; `packages/core/src/calculator/reward.ts:884-895`). The optimizer retains the event in `cardResults`, and the CLI report command passes the result to the exported HTML generator (`tools/cli/src/commands/report.ts:49-59,113-123`). | The generator flattens the cap events and labels every one `월 한도` (`packages/viz/src/report/generator.ts:346-383,412-427`), so saved standalone HTML falsely describes a per-purchase clip as a monthly exhaustion. Terminal output uses the generic `한도` and does not introduce this false period. | Cycle 7 report tests cover monthly events but no `per_transaction` generator case (`packages/viz/src/__tests__/cycle7-cap-disclosure.test.ts:111-206`). This is distinct from `C12-CT-001`: this sink renders the event with false wording, whereas browser sinks omit it. |
| `C12-CR-003` — whitespace-first scraper fallback | The bounded fetcher cleans the response and searches preferred content selectors (`tools/scraper/src/fetcher.ts:220-365`). It breaks on the first raw truthy `el.text()`, so whitespace-only `<main>` prevents fallback to populated `#content`; later normalization turns the selected fragment into `""`. | The scraper CLI forwards the empty string (`tools/scraper/src/cli.ts:149-169`). Extraction enforces a maximum size but no non-empty minimum (`tools/scraper/src/extractor.ts:38-49,145-171`), sends an empty untrusted-content block to the model, then applies deterministic quarantine before semantic validation and writing. Quarantine limits publication harm, but cannot recover the discarded source or request cost. | Fetcher coverage has a populated `<main>` but no whitespace-first fallback case (`tools/scraper/src/__tests__/fetcher.test.ts:38-61`); CLI coverage mocks already-clean content. No prior review owns this selector/normalization ordering defect. |
| `RPF12-PERF-001` — CLI statement copy amplification | Analyze, optimize, and report validate a path without a file-size ceiling (`tools/cli/src/validation.ts:18-66`) and call the shared local-first parser wrapper. That wrapper reads the file and copies it into `capturedBytes` (`tools/cli/src/parse-statement.ts:43-56`). | Each injected parser read creates another `Buffer` from the capture, including the full read and prefix (`tools/cli/src/parse-statement.ts:56-83`). The parser retains and decodes the full input (`packages/parser/src/statement.ts:48-89`). Local success therefore pays statement-sized copies before any consent/retry; all three public statement commands inherit the amplification. | Command tests correctly require one disk read and stable byte/digest behavior, but do not assert backing-buffer reuse (`tools/cli/src/__tests__/commands.test.ts:305-345`). The security invariant—one stable snapshot for local and authorized remote attempts—must remain. Plan 76 addressed repeated disk reads, not this in-memory copy chain. |
| `RPF12-D-001` — source-hostname contrast | A card's authored URL passes the rules URL boundary (`packages/rules/src/security.ts:30-48`), is published in detail data, and is revalidated by `safeExternalSourceLink` (`apps/web/src/lib/external-url.ts:8-21`). CardDetail derives a safe hostname and href. | The safe hostname is rendered as normal 14 px muted text in the issuer-gradient header (`apps/web/src/components/cards/CardDetail.svelte:147,207-214,268-286`), using `#64748b` (`apps/web/src/app.css:20-24`). The source and navigation contracts are correct; only the visual sink loses legibility. | Card-detail tests assert the neutral fallback, hostname, and safe href, not computed contrast. A complete check of all 24 `getIssuerColor` values found the muted text below 4.5:1 at both declared tint stops: **3.461–4.384:1** at the stronger `0x22` stop and **4.273–4.498:1** at `0x08`. This extends the confirmed scope from Shinhan to every issuer without creating a second finding. |
| `RPF12-DOC-001` — no-op root parse script | The root manifest advertises `bun run parse` but targets `packages/parser/src/index.ts` (`package.json:30`). That module is only an export barrel (`packages/parser/src/index.ts:1-49`); it has no argument parser or main-entry branch. | Bun accepts and forwards arguments, then the module exits successfully without reading a file or calling the real parse API (`packages/parser/src/statement.ts:43-52`). Contributors and automation therefore receive success for help, valid input, or a nonexistent path while no parse occurs. The functional product CLI uses separate analyze/optimize routes. | No test executes the root script or asserts its exit/output contract. Full-history searches found no earlier owner for this exact manifest-to-entrypoint break. |
| `RPF12-DOC-002` — scraper URL-stamping wording | The canonical system prompt says `url`, issuer, source, and date are boundary-recorded while also telling the model to leave the “official URL” blank (`tools/scraper/src/prompts/system.ts:23-30`). The actual tool schema does not expose `url`, and the request message accurately names only issuer, source, and retrieval time (`tools/scraper/src/extractor.ts:145-171`). | Response parsing clones untrusted output, deletes any attempted URL, stamps trusted provenance, and quarantines rewards before validation/writing (`tools/scraper/src/extractor.ts:93-121`). Runtime remains fail-closed; the stale system contract misleads prompt maintenance and tests rather than publishing an attacker URL. | The schema-contract test explicitly preserves the contradictory sentence (`tools/scraper/src/__tests__/schema-contract.test.ts:96-106`). Plans 122/128 own URL deletion and public source-link trust/rendering, not this remaining false instruction. |
| `C12-CT-001` — browser cap disclosure omission | The calculator emits cap events; optimization retains them in each `CardRewardResult`. Worker decoding (`packages/core/src/optimizer/worker-protocol.ts:87-144`), analysis coherence (`apps/web/src/lib/analysis-result.ts:298-365`), persistence (`apps/web/src/lib/persistence.ts:247-313`), and the store (`apps/web/src/lib/store.svelte.ts:291-303`) all preserve `capsHit`. | No browser presentation component consumes it. `/results` mounts warnings, totals, comparison, and map (`apps/web/src/pages/results.astro:76-115`); `ReportContent` reads `cardResults` but only renders total/rate fields (`apps/web/src/components/report/ReportContent.svelte:13-24,40-130,198-246`). The tracer also followed the dashboard: AnalysisWarnings, SpendingSummary, CategoryBreakdown, SavingsComparison, TransactionReview, and OptimalCardMap are its complete result surface, and none renders cap events (`apps/web/src/pages/dashboard.astro:77-143`). Thus dashboard, results, and the in-app/print report all show the clipped total without the cause. | Worker/analysis/persistence tests prove transport, not presentation. Page contract tests do not assert cap text, and the report E2E fixture has empty `capsHit`. Plans 68/127 established the DTO and web-boundary survival; neither supplied a Svelte sink. The dashboard omission extends the critic's scope but shares the same producer, loss boundary, harm, and repair, so it remains one finding. |
| `RPF12-TE-001` — no pre-merge verification | A pull-request event reaches no repository-owned workflow. The sole workflow listens only to `main` push and manual dispatch (`.github/workflows/deploy.yml:3-6`). | Verification and E2E run in the Pages build job only after a change has already entered `main` (`.github/workflows/deploy.yml:14-45`), followed by upload/deployment. A failing command can stop publication, but cannot provide a pre-merge check. | The workflow-consistency parser omits the trigger map and tests pins, permissions, commands, and ordering only (`scripts/__tests__/workflow-consistency.test.ts:23-39,56-202`). This is distinct from deferred `D-05`, whose criterion was adding test/lint/typecheck content to the deploy workflow; that content now exists. A repair must keep deploy/upload and write/OIDC behavior off read-only PR verification rather than merely adding `pull_request` to the current deploy job. |

## Propagation confirmations and scope extensions

### Shared group behavior fails before every downstream boundary

A schema-valid two-rule card with one shared group but monthly caps of 100 and
1,000 Won was accepted. Reversing the two transactions changed total reward
from 200 to 100 Won. A second accepted card used a coherent 1,000 Won shared
cap but two separately scoped `fixed_per_day` rewards worth 100 and 200 Won;
the shared daily identity suppressed one reward instead of producing 300 Won.

A bounded scan of the current 683 authored card records found no group shared
by multiple rules, so the checked-in production catalog is not presently
exercising the defect. That does not close the supported authoring contract:
scraper/CLI publication and direct core callers can introduce the accepted
shape, and the incorrect amount is final before worker, persistence, terminal,
HTML, or browser presentation.

### Browser omission includes all persisted result surfaces

The critic established the `/results` and `ReportContent` omission. The tracer
followed the same stored `cardResults` through the dashboard's full component
tree and found no cap consumer there either. A complete source search for
`capsHit`, `capReached`, `혜택 손실`, and `한도 도달` across web presentation
files found no rendering site. This is one systemic missing-consumer boundary,
not one finding per page.

The standalone terminal and HTML reports are separate consumers and do read
the event. HTML's false period is already `C12-CR-002`; it is not evidence that
the browser propagation succeeds.

### Hostname contrast is systemic, not issuer-specific

The original Shinhan calculation was reproduced, then the same sRGB composite
was applied to all 24 issuer colors returned by
`apps/web/src/lib/formatters.ts`. Every issuer fails the 4.5:1 threshold at
both nontransparent gradient stops. The safe-link producer and hostname
derivation need no change; the fix belongs at the header text/background
contract and should cover the adjacent muted card-name treatment under the
same banner as appropriate.

## Historical duplicates and non-findings

### Unnamed inline SVGs — reopen Cycle 9, do not count in Cycle 12

`RPF12-D-002` is behaviorally correct but historically duplicate. A static
opening-tag scan of every inline SVG in current `.svelte` and `.astro` files
found two remaining glyphs without an accessible name, role, or decorative
`aria-hidden` contract:

- the CardGrid search glyph
  (`apps/web/src/components/cards/CardGrid.svelte:296-310`);
- the dashboard “추천 결과 보기” arrow
  (`apps/web/src/pages/dashboard.astro:145-153`).

Both predate the Cycle 9 Plan 119 repair and have the same decorative-glyph
producer, unnamed accessibility-tree exposure, user harm, and exact repair as
historical `C9-D-01` / `C9-011`. The current regression test enumerates only
FileDropzone and CardDetail
(`apps/web/src/__tests__/decorative-svg-semantics.test.ts:1-47`), explaining
how both residual sites survived. The dashboard site expands the missed sweep;
it does not create a Cycle 12 ID.

### Prefixed XLSX inflation — rejected

No prefixed-XLSX inflation candidate survives the parser trace.
`packages/parser/src/shared/xlsx-archive.ts:113-132` checks the first two bytes
for the ZIP `PK` signature before archive inspection or inflation. A
non-`PK`-prefixed input takes the non-ZIP path, so prepending bytes does not
reach this inflater. Cycle 9 already traced SheetJS handling of non-PK input to
its plaintext/PRN parser; repeating that known classification would inflate
the finding count, not a ZIP archive. No new producer-to-inflater path or
contract failure was found.

### Raw cap category label — historical residual, not a new root

The standalone cap warning can expose an internal category key such as
`dining` or `online_shopping`. That residual belongs to the same visualization
label-localization root recorded and repaired incompletely under Cycle 50
`C50-M01` (`.context/plans/_archive/cycle50-fixes.md:8-22`). It should be
included when that historical repair is reopened, not assigned a Cycle 12
tracer ID.

## Test and missed-propagation sweep

The bounded, non-browser focused suite covered the relevant calculator,
catalog validation, report disclosure, web analysis/persistence contracts,
SVG and card-detail contracts, page UI contracts, CLI behavior, scraper
fetch/schema contracts, and workflow consistency:

```text
311 pass
0 fail
1063 expect() calls
13 test files
```

No browser, E2E, server, deployment, or external-system command was run.
Passing results confirm the current contracts but do not contradict the traced
gaps: each retained finding is precisely at an assertion or consumer boundary
the focused suite does not cover.

## Final tracer disposition

- **Retain without new IDs:** `C12-CR-001`, `C12-CR-002`, `C12-CR-003`,
  `RPF12-PERF-001`, `RPF12-D-001`, `RPF12-DOC-001`, `RPF12-DOC-002`,
  `C12-CT-001`, and `RPF12-TE-001`.
- **Reject as historical duplicate:** `RPF12-D-002`; reopen Cycle 9 and include
  both CardGrid and dashboard residual sites in that repair.
- **Reject as historical/non-reachable inflation:** raw category localization
  remains Cycle 50 work, and prefixed non-PK XLSX input does not reach ZIP
  inflation.
- **Genuinely new tracer findings:** **0**.

At close, `HEAD` and branch were still exactly
`e72a4c69f7c0eab7053c61a587c2d040760c236c` and
`codex/review-plan-fix-no-deploy-20260723`; both `git diff --quiet` and
`git diff --cached --quiet` returned success. Status contained only 18
untracked review artifacts (the six protected Cycle 42 artifacts and twelve
Cycle 12 reports, including this one), all six protected hashes remained
exactly as locked above, and the `.context` Markdown inventory was 1,146.
