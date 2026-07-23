# Review-plan-fix Cycle 12 — QA tester

- Date: 2026-07-24
- Reviewed revision: `e72a4c69f7c0eab7053c61a587c2d040760c236c`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Disposition: **9 retained Cycle 12 findings validated; 1 historical
  duplicate rejected; no additional QA finding**
- Retained severity count: **6 Medium, 3 Low**
- New QA finding count: **0**
- Scope: review, read-only probes/tests, and this report only; no source,
  test, plan, generated-artifact, workflow, staging, commit, push, deployment,
  server, browser, or E2E change/run

## Inventory and QA method

The pass remained locked to the exact revision above. I reconciled all
**2,291 tracked paths**: **1,129** tracked `.context` paths and **1,162**
active product, data, test, documentation, workflow, configuration, and
vendor-integrity paths. Every Cycle 12 report available at close, including
the final verifier, and the implicated historical plans/reviews were read
before assigning novelty. The verifier independently reached the same
9-retained/1-rejected adjudication used below.

QA traced each retained finding from its initiating action through the
production boundary and user-visible or operational outcome, then inspected
the nearest tests for both positive coverage and the missing/false oracle.
Coverage gaps that merely explain why an already-owned defect remains green
are remediation requirements for that defect, not separate QA findings.

## Retained-finding QA matrix

| Finding | Product flow and expected behavior | Current QA result | Existing coverage verdict |
| --- | --- | --- | --- |
| `C12-CR-001` — shared-cap identity/coherence | Custom CLI or scraper-authored rules → semantic validation → calculator/optimizer. A shared monthly pool must have one coherent cap, remain transaction-order invariant, and must not merge independent per-rule daily eligibility. | **Fail, confirmed.** Validator-accepted fixtures return 200 versus 100 when transaction order changes; two independent same-day fixed rules worth 100 and 200 return only 100. | Tests cover same-valued shared caps and one-rule daily behavior, but not mismatched shared thresholds or two rule identities sharing only a monthly pool. |
| `C12-CR-002` — standalone cap label | CLI report → `generateHTMLReport` → saved warning. `per_transaction`, `monthly_category`, and `monthly_total` must have distinct period labels. | **Fail, confirmed.** A per-transaction 50-Won event renders as `월 한도 50원 도달`. | Cap-report tests assert monthly events and the current `월 한도` copy; none supplies a per-transaction event to the HTML sink or checks all three labels. |
| `C12-CR-003` — scraper whitespace fallback | Fetched HTML → `cleanHTML` → extraction admission. Selection must skip empty containers, fall back to later content/body, and avoid an LLM call if nothing remains. | **Fail, confirmed.** Whitespace `<main>` hides populated `#content`; the cleaned value is `""` and request construction accepts it. | The sole cleaner test uses a populated `<main>`. There is no blank-first, later-selector, body-fallback, or empty-request rejection case. |
| `RPF12-PERF-001` — CLI statement-buffer copies | `analyze`/`optimize`/`report` → local-first wrapper → parser. One immutable byte snapshot should serve local parse, consent identity, and authorized retry. | **Fail, confirmed.** Source, captured bytes, two parser reads, and prefix probe have distinct object/backing-buffer identities; statement-sized allocation grows before normal parsing work. | The consent regression correctly proves one disk read and identical byte content across retry, but never asserts buffer adoption/sharing or allocation slope. The process RSS test measures small compiled-catalog startup, not statement-size scaling. |
| `RPF12-D-001` — hostname contrast | Card catalog → detail banner → neutral source link in light theme. The visible destination hostname must remain at least 4.5:1 for 14 px normal text across issuer tints. | **Fail, confirmed.** Muted `#64748b` reaches about 3.665:1 on the strongest Shinhan tint and 4.317:1 at the lighter declared stop. | Card-detail tests assert neutral copy, safe href, and hostname presence. Contrast helpers exist for other semantic tokens, but no test evaluates hostname foreground against the composited issuer gradient. |
| `RPF12-DOC-001` — root `parse` no-op | Contributor/automation invokes the declared root script with help, valid input, or invalid input. It must expose a real command contract or be absent, and failures must be nonzero. | **Fail, confirmed.** Both `--help` and a nonexistent statement execute the export barrel, emit no program result/diagnostic, and exit zero. | CLI process tests cover `analyze`, `report`, and `scrape`; no test enumerates root scripts or invokes `parse`. |
| `RPF12-DOC-002` — false scraper URL wording | Model prompt/test specification → deterministic extraction boundary. Documentation must say that only issuer/source/time are stamped and URL remains absent pending review. | **Fail in specification, runtime safe.** The prompt says the scraper records `url` and calls it official; quarantine actually deletes it and stamps only issuer/source/date. | Runtime extractor tests correctly assert URL deletion. The schema-contract test actively locks the false prompt sentence and “official URL” terminology, so the two test layers contradict each other. |
| `C12-CT-001` — browser drops cap explanations | Optimizer `capsHit` → worker → store/persistence → `/results` and printable `ReportContent`. Every clipped/exact cap should be explained with card, cap type, category, and loss state. | **Fail, confirmed.** Telemetry survives every data boundary, but no page or component consumes `capsHit`; users see the reduced reward without its cap explanation. | Analysis, worker, and persistence tests strongly protect telemetry shape and plural identity. Page/disclosure tests cover other warnings but never require a cap consumer on either browser surface. |
| `RPF12-TE-001` — verification begins after merge | Pull request → repository workflow → required read-only verification. Quality gates should report before merge while Pages upload/deploy remains restricted to trusted events. | **Fail, confirmed.** The sole workflow runs only for a `main` push or manual dispatch, so no repository-owned PR status exists. | All eight workflow-consistency tests pass because their parsed type starts at permissions/jobs and never models or asserts the trigger map. |

## Boundary and user-facing evidence

### Financial calculation and disclosure

The current calculator tests are broad, but the exact shared-cap composition
is absent. `packages/core/__tests__/cycle9-calculation-determinism.test.ts:
268-303` uses the same 500-Won threshold for both members of a shared group.
`packages/core/__tests__/cycle6-reward-correctness.test.ts:293-323` likewise
uses coherent 100-Won caps. The direct failing fixture proves the required
additional dimensions are:

1. unequal or null-versus-number thresholds in one group must fail semantic
   admission;
2. coherent shared caps must be invariant to transaction order; and
3. two `fixed_per_day` rules sharing only the cap ledger must retain separate
   daily-occurrence identities.

The producer already returns truthful cap telemetry. The standalone HTML test
fixtures at `packages/viz/__tests__/cycle7-cap-disclosure.test.ts:47-69,
111-206` include only `monthly_total` and `monthly_category`, then assert the
generic `월 한도` wording. The browser tests take the opposite incomplete
path: they prove `capsHit` survives coherence, worker transfer, and storage,
but `rg "capsHit" apps/web/src/components apps/web/src/pages` returns no
consumer. A repaired acceptance suite must therefore use one shared
type-to-label projection and require it in standalone HTML, `/results`, and
printable `ReportContent`, including exact, clipped, repeated, and plural
same-category events.

### Scraper and CLI boundaries

`tools/scraper/__tests__/fetcher.test.ts:38-61` establishes only the happy
path where the first `<main>` has text. The reproduction with an empty first
container confirms that selector existence is not a valid acceptance oracle.
QA acceptance must assert selection of the first **normalized non-empty**
candidate, body fallback, and a pre-client error when every candidate is
empty.

The URL trust boundary itself remains safe:
`tools/scraper/__tests__/extractor.test.ts:92-139,245-267` proves attempted
model URLs are deleted. The defect is that
`tools/scraper/__tests__/schema-contract.test.ts:96-106` requires prose that
describes a different boundary. The repaired test must assert both sides of
one contract: `url` is absent from the model schema and remains absent after
deterministic quarantine, while issuer/source/date are stamped.

The local-first CLI test at `tools/cli/__tests__/commands.test.ts:305-345`
correctly protects the security invariant: one filesystem read, unchanged
content across local and remote attempts, and a digest bound to those bytes.
It converts each returned value with `Buffer.from`, so it cannot detect
statement-sized object duplication. Allocation/ownership checks must augment,
not replace, that security test.

The manifest-level command remains untested. Fresh QA probes returned:

```text
bun run parse -- --help                              exit 0
bun run parse -- /definitely/not/a/statement.csv    exit 0
```

Both emitted only Bun's expansion to `packages/parser/src/index.ts`; neither
produced parser help, a parse result, or an invalid-path diagnostic.

### Web accessibility and workflow timing

The neutral source-link test verifies the important semantic and security
copy, but not whether the destination cue remains readable over runtime
issuer colors. A fix should exercise representative light-theme tint
composites at the token/helper level and retain the existing href/copy tests;
browser-only screenshot sampling should not be the sole regression oracle.

The browser cap-disclosure omission is a presentation failure, not a worker or
persistence loss. The working data-boundary tests should remain, with source/
component assertions added for both user-facing sinks and a behavioral test
that distinguishes per-transaction from exhausted monthly state.

The workflow finding is also a timing boundary rather than missing gate
content. `.github/workflows/deploy.yml:3-6` has only:

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:
```

The strong `verify` and browser-regression steps occur at lines 41-45, after a
change has already reached `main`. `scripts/__tests__/workflow-consistency.test.ts:
23-26` omits the `on` field from its interface; lines 56-202 test pins,
permissions, versions, commands, and ordering without checking event timing.
A repaired contract must require a read-only PR verification event/job and
prove Pages/OIDC writes remain unreachable from it.

## Historical duplicate and novelty decisions

### CardGrid SVG is not a new Cycle 12 finding

The SVG at `apps/web/src/components/cards/CardGrid.svelte:301-306` really
lacks `aria-hidden`, `focusable="false"`, and an accessible name. Its behavior
is therefore suitable for a regression in the eventual repair. It is excluded
from `NEW_FINDINGS`, however, because Cycle 9 already reported decorative
inline SVGs escaping the hidden-icon contract as `C9-D-01` / `C9-011`, with
the same accessibility-tree harm and exact repair. Plan 119 fixed only its
enumerated FileDropzone/CardDetail sites and missed this pre-existing glyph.
A missed site of an incompletely applied root repair is not made novel by a
new line-specific discovery.

### The PR-trigger failure is genuinely distinct

The complete ledger search for `pull_request`, pull request, pre-merge,
branch protection, required status, and workflow-trigger findings found no
earlier owner outside the current Cycle 12 reports. Historical `D-05`
(`.context/plans/00-deferred-items.md:41-47`) was explicitly a **gate-content**
finding: its exit criterion was adding test, lint, and typecheck steps to the
deploy workflow. Plan 72 later required and implemented those verification
contents and ordering
(`.context/plans/72-cycle1-performance-quality-docs.md:468-497`).

`RPF12-TE-001` concerns a separate predicate: **when** those now-present gates
run. Main-push-only verification cannot provide a pre-merge status even
though its post-merge contents are strong. The finding is therefore retained
as new rather than revived from `D-05`.

## Verification and missed-issue sweep

Focused non-browser QA execution passed **456 tests across 19 files, 0
failures, and 1,634 expectations**. The selection covered:

- calculator and order/daily/cap behavior;
- semantic catalog validation;
- terminal and standalone cap disclosure;
- scraper cleaning, extraction, and schema contracts;
- CLI command, consent, process, and RSS contracts;
- web cap coherence, worker transfer, persistence, page/disclosure wiring,
  source-link copy, and decorative SVG semantics; and
- workflow consistency.

The green result is consistent with the retained defects: each missing or
false oracle is identified in the matrix above. No test was weakened or
modified, and no browser/E2E/server process was started.

The closing QA sweep revisited success, empty, invalid, clipped, exact,
repeated, plural, order-reversed, restored, worker-transferred, report,
light-theme, command-help, scraper-quarantine, and workflow-event paths.
Potential test gaps that were already fixed, deferred, historical, direct
facets of retained findings, or lacked a concrete product failure were
excluded. No distinct QA-only failure survived reproduction and duplicate
control.

## Repository integrity

- HEAD remained `e72a4c69f7c0eab7053c61a587c2d040760c236c`.
- Branch remained `codex/review-plan-fix-no-deploy-20260723`.
- The tracked worktree and index were clean before this report and remained
  clean after it; only pre-existing untracked review artifacts plus this
  requested report are present.
- The six protected Cycle 42 artifacts retained their baseline SHA-256
  digests:

```text
596dc91904a642bbfe5a5f5c338025023a1e5d0c2c92d9842353233c4fc0ac7a
272a70771bc14dbe131a8aef65907402c5f07f12fc0c798d535a5ef4a67ee4d1
1dbdd1bdf8e2d672075e73e34b5b2043b33f74a36b938085b8efeafd03f03266
6c6aa0d14a9129109341ac285de900bff8af8c38425a03f09e012206266c3df0
c7909307ce1387d617e9d7f51180a6eb8d7b12e1bfffe30bf5fe5dafdbd9a6a5
c3fbf7a4ec5628902bce36af73f9d7c6b223c82e6d1360bac44e80d7612a3e9f
```

**Final count: 9 retained findings (6 Medium, 3 Low), 1 historical duplicate
excluded, and 0 genuinely new QA findings.**
