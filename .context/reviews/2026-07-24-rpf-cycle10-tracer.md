# Review-plan-fix Cycle 10 — tracer

- Date: 2026-07-24
- Baseline: `56c0f1fcd5b670b20cd972556199f37e3f382d8d`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Lens: causal data-flow tracing, competing hypotheses, cross-fix
  interactions, and historical duplicate control
- Outcome: **0 genuinely new tracer findings**

## Inventory and method

I reset to the current HEAD and indexed all 2,252 tracked paths: 1,156 active
non-context paths and 1,096 `.context` plan/review paths. Active inventory
covered `apps/web` (167 paths), `packages/core` (39), `packages/parser` (86),
`packages/rules` (733), `packages/viz` (14), `packages/cli` (28),
`tools/scraper` (35), scripts (19), E2E (16), and root/config/workflow
surfaces (19). Authored rules, generated catalog artifacts, fixtures, tests,
and every current Cycle 10 report were included.

The trace followed values rather than filenames:

1. upload bytes and file metadata through admission, worker parsing,
   normalization, categorization, calculation, optimization, coherence
   validation, replacement, persistence, reoptimization, disclosures, and UI;
2. scraped URL and document provenance through network policy, extraction,
   quarantine, atomic YAML writing, generated JSON, publication shards,
   source-hash pinning, catalog loading, and card-detail rendering;
3. malformed, omitted, reordered, duplicated, cancelled, stale, truncated,
   unsupported, and model-authored values through the same boundaries.

For duplicate control, every candidate was searched against the full
`.context` corpus, including archived plans and reviews under older naming
schemes. A behavior was not counted when its causal root was already recorded,
even if the current trace supplied a different example.

## End-to-end causal trace

### Parser → analysis → optimizer → persistence → UI

- Upload admission bounds files before analysis; parsing happens behind the
  parser worker settlement boundary, and parsed rows are normalized before
  categorization. Transaction facts needed by rules (`paymentType`, channel,
  fuel quantity/type, tags, source provenance) survive the analyzer mapping
  into optimization rather than being reconstructed by the UI.
- Analysis context derives one explicit previous-spending basis and the
  optimizer consumes the resulting facts. The main greedy path canonically
  sorts reward facts, while the separately constructed alternative path does
  not. That divergence is the already-reported C10-CR-002, not a second
  tracer finding (`packages/core/src/optimizer/greedy.ts:103-167,337-368,
  479-485`).
- Fresh analysis is exhaustively checked in the analyzer and then checked
  again at the replacement boundary. This is the already-reported
  RPF10-PERF-001 (`apps/web/src/lib/analyzer.ts:448-452`;
  `apps/web/src/lib/analysis-replacement-runtime.ts:168-191`).
- Full and truncated persistence preserve aggregate coherence, but current
  payloads can omit previous-spending provenance. Reload then changes the
  basis used by the next edit. This is the same root as C10-CR-003
  (`apps/web/src/lib/analysis-result.ts:536-565,650-684`;
  `apps/web/src/lib/persistence.ts:749-806`;
  `apps/web/src/lib/store.svelte.ts:356-366`).
- Store replacement clears the previous result before a new analysis by
  design; edit-time reoptimization retains all statement months, recomputes
  the latest analysis month, and derives the exact preceding calendar month.
  No stale-result or month-selection hypothesis survived the current guards.
- Category inference reaches category-only rewards without a merchant
  allowlist, so unrestricted short ASCII substring matches have a real
  financial consequence. This independently confirms C10-CR-001
  (`packages/core/src/categorizer/matcher.ts:160-167,239-255`;
  `packages/core/src/calculator/reward.ts:418-433`).
- UI projections are otherwise downstream of coherent results, but the card
  detail table deliberately narrows supported rewards too far. Stable reward
  identity and structured conditions are lost before rendering; this confirms
  C10-CT-001 (`apps/web/src/components/cards/CardDetail.svelte:105-137,
  312-395`).

### Scraper → publication → catalog UI

- The CLI validates the requested target before the fetcher follows redirects.
  Extraction then applies issuer/date/source overrides and reward-support
  quarantine, and the writer uses a temporary file plus rename. Generated
  summary/detail/optimizer artifacts carry one source hash, and the web loader
  pins that identity for the session.
- The trusted extraction boundary does not replace the model-authored card
  URL with fetched provenance. Publication retains the value, and the UI calls
  a syntax-only external URL guard before labeling it an official page. This
  is exactly RPF10-SEC-001 (`tools/scraper/src/extractor.ts:170-213`;
  `scripts/catalog-publication.ts:195-223`;
  `apps/web/src/components/cards/CardDetail.svelte:265-277`).
- Unsupported rewards remain browseable but cannot enter optimization. That
  containment works for reward semantics; it does not contain the external
  URL trust issue above.
- Runtime catalog source-hash pinning fails closed on mixed-generation
  artifacts. Parallel requests can race to establish the first accepted hash,
  but a later mismatched artifact is rejected rather than merged. No new
  publication-coherence issue was reproduced.

## Independent verdicts on current Cycle 10 claims

| Claim | Severity | Confidence | Tracer verdict |
| --- | --- | --- | --- |
| C10-CR-001 — short ASCII category aliases | Medium | High | **Confirmed** through categorizer → category reward |
| C10-CR-002 — unsorted alternative counterfactuals | Medium | High | **Confirmed** through the two optimizer input builders |
| C10-CR-003 — missing previous-spending provenance | Medium | High | **Confirmed** through deserialize → disclose → edit |
| C10-CT-001 — supported detail rows lose identity/conditions | Medium | High | **Confirmed** through detail projection → rendered rows |
| C10-CT-002 — malformed ordinary optimizer message does not settle | Low | High | **Confirmed**; parser has the missing guarded decode pattern |
| RPF10-DOC-001 — unitless mileage enters Won results | Medium | High | **Confirmed**, retaining the verifier's prior-history qualification |
| RPF10-PERF-001 — duplicate full coherence validation | Medium | High | **Confirmed** on the normal replacement path |
| RPF10-SEC-001 — model-owned URL becomes “official” | Medium | High | **Confirmed** through extraction → publication → href |
| C10-DBG-001 — canonical dotted IDs fail card navigation | Medium | High | **Confirmed** through click and direct-query paths |

C10-CT-002 remains distinct from the Cycle 9 `messageerror` fix: an ordinary
cloneable `message` reaches an unchecked `event.data.ok` access
(`apps/web/src/lib/optimizer/worker-runner.ts:66-110`), while the parser runner
wraps and decodes the equivalent boundary
(`apps/web/src/lib/parser/worker-runner.ts:83-132`).

RPF10-DOC-001 is also causally intact: an omitted unit becomes a percentage
value, the calculator aggregates the result into the scalar called Won, and
the optimizer ranks it alongside money
(`packages/rules/src/schema.ts:62-110`;
`packages/core/src/calculator/reward.ts:812-847`;
`packages/core/src/models/result.ts:1-6`).

For the late debugger claim, the canonical rule grammar accepts dots
(`packages/rules/src/security.ts:18-28`) while navigation uses a private
hyphen-only grammar (`apps/web/src/lib/card-navigation-state.ts:1-2,21-29,
41-47`). `CardPage.selectCard()` builds history before selecting the detail
(`apps/web/src/components/cards/CardPage.svelte:60-68`), and direct-query
resolution rejects the same ID before catalog lookup
(`apps/web/src/components/cards/CardPage.svelte:88-116`). An independent
production-summary probe found the same eight affected IDs, returned `null`
for `?card=hana-wonder-2.0`, and reproduced the synchronous
`TypeError: Invalid card selection ID`.

The architect and test-engineer reports each contain zero additional claims;
their outcomes are consistent with this trace. The verifier confirmed the
eight claims available when it ran. The later C10-DBG-001 claim was therefore
validated separately above.

## Competing hypotheses rejected or deduplicated

- **Renamed or partially overlapping uploads can double-count rows:** the
  scenario remains reachable because admission identity is not content
  identity, but its causal root is already recorded in
  `.context/reviews/2026-04-18-deep-code-quality-security-review.md:334-340`
  and `.context/reviews/2026-04-22-critic-multi-perspective.md:304`; it is not
  new.
- **An explicit bank/format selection corrupts only one file in a multi-file
  batch:** the override intentionally applies to the selected batch, while
  automatic mode detects each file independently. No competing per-file UI
  promise or wrong-result path was found.
- **Timezone-bearing ISO timestamps are silently shifted:** the strict date
  parser rejects timezone-bearing values rather than constructing a local
  date, and focused tests encode that rejection. Accepting such timestamps
  would be a product-contract expansion, not a demonstrated current bug.
- **A reset/new analysis is overwritten by an older result:** generation and
  abort ownership around replacement and worker settlement prevent the traced
  stale commits. Historical reset/reoptimization variants were already
  recorded and were not revived without a current reproduction.
- **Truncated persistence introduces a separate aggregate mismatch:** the
  retained totals, category breakdown, and month summaries are cross-checked.
  The surviving semantic loss is previous-spending provenance and belongs to
  C10-CR-003.
- **Mixed catalog generations can be combined under concurrent loads:** the
  first validated source hash is pinned and later mismatches reject. Failure
  does not silently swap the active hash.
- **Dotted IDs are merely malformed external input:** falsified. They are
  canonical and present in the published production summary, so this is
  C10-DBG-001 rather than a rejected-input edge case.

## Final missed-issue sweep and integrity

The final sweep revisited private ID/date/hash validators, worker terminal
events and ordinary messages, upload identity, month/provenance derivation,
optimizer stateful ordering and cap paths, full/truncated persistence,
card-detail projections, external links, scraper retry/redirect/quarantine
cleanup, publication identity, suppression markers, and high-risk comments.
The only additional inconsistency found was the dotted-ID navigation split,
already reported concurrently as C10-DBG-001. No second candidate survived
reachability, materiality, reproduction, and full-history duplicate control.

No source, test, plan, generated artifact, browser/E2E state, staging state,
commit, branch, remote, or deployment was changed. The six protected Cycle 42
artifacts retained their pre-review SHA-256 hashes:

- plan: `596dc91904a642bbfe5a5f5c338025023a1e5d0c2c92d9842353233c4fc0ac7a`
- aggregate: `272a70771bc14dbe131a8aef65907402c5f07f12fc0c798d535a5ef4a67ee4d1`
- code reviewer: `1dbdd1bdf8e2d672075e73e34b5b2043b33f74a36b938085b8efeafd03f03266`
- debugger: `6c6aa0d14a9129109341ac285de900bff8af8c38425a03f09e012206266c3df0`
- security reviewer: `c7909307ce1387d617e9d7f51180a6eb8d7b12e1bfffe30bf5fe5dafdbd9a6a5`
- test engineer: `c3fbf7a4ec5628902bce36af73f9d7c6b223c82e6d1360bac44e80d7612a3e9f`

Final count: **0 new tracer findings; all 9 current Cycle 10 findings
independently confirmed (8 Medium, 1 Low).**
