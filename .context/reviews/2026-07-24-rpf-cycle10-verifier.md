# Review-plan-fix Cycle 10 — verifier

## Baseline and outcome

- Review date: 2026-07-24.
- Exact revision: `56c0f1fcd5b670b20cd972556199f37e3f382d8d`.
- Branch: `codex/review-plan-fix-no-deploy-20260723`.
- Role: report-only independent verifier.
- New verifier findings: **0**.
- Same-cycle candidate verdicts: **8 confirmed, 0 rejected**.
- Qualification: C10-CR-001 is a real current defect in a distinct categorizer
  path, but its novelty should be described as incomplete cross-surface closure
  because Cycle 9's acceptance text stated the broader behavior.
- Qualification: RPF10-DOC-001 is a real current monetary-contract defect with
  stronger production evidence, but it reopens the underlying C14-09 mileage
  valuation question rather than being wholly unprecedented.

No source, test, plan, generated artifact, browser/E2E state, commit, push, or
deployment was changed.

## Inventory and contract coverage

The exact-HEAD inventory contains 2,252 tracked paths, including 1,096
historical `.context` paths and 1,156 active paths. The sorted manifest hashes
are:

- all tracked paths:
  `9bc49df85b00827a14ffb7916e5a964abc7d4d72c921359803418ec264538598`;
- active paths excluding `.context`:
  `1c030d6f0f2323e7dd779d02655cbf942528de24c66dd0de4d3e95cec252bf06`.

The active inventory was partitioned as follows: `apps/web` 167,
`packages/core` 39, `packages/parser` 86, `packages/rules` 733,
`packages/viz` 14, `tools/cli` 28, `tools/scraper` 35, `scripts` 19, `e2e`
16, and 19 root/config/other paths.

For the five live candidates, the relevant cross-file contracts were traced
end to end:

| Contract | Files checked |
| --- | --- |
| Merchant text → category → financial reward | `packages/core/src/categorizer/{keywords,matcher,taxonomy}.ts`, `packages/core/src/calculator/reward.ts`, BC catalog YAML, categorizer/calculator tests |
| Canonical reward facts → optimizer assignment → alternative counterfactual | `packages/core/src/optimizer/greedy.ts`, calculator stateful-rule behavior, Cycle 6 alternative tests, Cycle 9 determinism tests |
| Analysis context → result provenance → current v4 persistence → disclosure/reoptimization | `packages/core/src/analysis/context.ts`, `apps/web/src/lib/{analyzer,analysis-result,persistence,analysis-disclosures}.ts`, `store.svelte.ts`, persistence/result tests |
| Admitted input → worker result → main-thread validation → state commit | `upload-admission.ts`, `analyzer.ts`, `analysis-result.ts`, `analysis-replacement-runtime.ts`, `store.svelte.ts` |
| Trusted fetch target → untrusted model output → quarantine/publication → “official” link | scraper prompt schema/system prompt, CLI, fetcher, extractor, rules URL guard, publication script, `external-url.ts`, `CardDetail.svelte`, scraper/publication/URL tests |
| Canonical supported reward → detail publication → visible eligibility claim | `packages/rules/src/types.ts`, Lotte production YAML, publication script, `CardDetail.svelte`, `CardGrid.svelte`, card-detail/catalog tests |
| Optimizer worker response → runtime decode → promise settlement/worker ownership | optimizer protocol/runner, parser-runner contrast, optimizer/parser worker tests |
| Mileage authoring → canonical value → calculation/optimization → Won renderers | Samsung production YAML, rules schema/semantic validation, calculator/result/optimizer contracts, web/terminal/HTML renderers |

The current code-, performance-, security-, critic-, document-, test-, and
architect-role reports were read in full. Candidate-specific searches covered
all 1,096 tracked `.context` files. The closing repository sweep also revisited
parser admission, date/month ownership, calculation limits and ordering,
worker settlement, storage migration/truncation, generated catalog identity,
scraper trust boundaries, external URLs, output units, workflow/config
boundaries, disabled tests, and suppression markers.

## Same-cycle verdicts

| Candidate | Severity | Confidence | Verifier status |
| --- | --- | --- | --- |
| C10-CR-001 — short ASCII category aliases | Medium | High | **Confirmed; novelty qualified** |
| C10-CR-002 — unsorted alternative counterfactuals | Medium | High | **Confirmed** |
| C10-CR-003 — missing previous-spending provenance | Medium | High | **Confirmed** |
| RPF10-PERF-001 — duplicate full coherence validation | Medium | High | **Confirmed** |
| RPF10-SEC-001 — model-owned “official” card URL | Medium | High | **Confirmed** |
| C10-CT-001 — supported detail rows lose identity/conditions | Medium | High | **Confirmed** |
| C10-CT-002 — cloneable malformed optimizer response does not settle | Low | High | **Confirmed** |
| RPF10-DOC-001 — unitless mileage enters Won results | Medium | High | **Confirmed; prior-history qualified** |

The test-engineer and architect reports each found no additional candidate.
That outcome agrees with this verifier sweep; there is no claim in either
report to reject.

### C10-CR-001 — confirmed, with novelty qualification

`MerchantMatcher` places every normalized keyword of length at least two into
the substring index (`packages/core/src/categorizer/matcher.ts:160-167`) and
accepts unrestricted forward or reverse containment
(`packages/core/src/categorizer/matcher.ts:239-255`). The independent taxonomy
lookup repeats unrestricted forward containment
(`packages/core/src/categorizer/taxonomy.ts:143-189`). The production corpus
contains `cu`, `skt`, and `kt`
(`packages/core/src/categorizer/keywords.ts:431-433,1047-1051`).

The reward boundary trusts the inferred category whenever a rule has no
specific-merchant allowlist
(`packages/core/src/calculator/reward.ts:418-433`). BC 바로 클리어 플러스
has supported 10% convenience-store and telecom tiers
(`packages/rules/data/cards/bc/baro-clear-plus.yaml:108-133,135-148`).

Independent production-path reproduction with a ₩10,000 transaction and
₩300,000 prior spending returned:

```text
SECURITY SERVICE -> convenience_store, confidence 0.8, reward 1000
CULTURE CENTER   -> convenience_store, confidence 0.8, reward 1000
SKTECH           -> telecom,           confidence 0.8, reward 1000
BOOKTOWN         -> telecom,           confidence 0.8, reward 1000
```

This confirms the behavior, reachability, and financial consequence. Existing
Cycle 9 tests only prove boundaries inside `merchantAllowlistMatches`
(`packages/core/__tests__/calculator.test.ts:1705-1729`); direct categorizer
tests prove intended exact/ordinary substring matches but do not carry these
near-collisions through category-based reward calculation.

Novelty qualification: Plan 114's acceptance text already said that `CU`
must not match `SECURITY SERVICE`, `CULTURE CENTER`, or `CUBAN RESTAURANT`
(`.context/plans/114-cycle9-calculation-determinism.md:44-51`). The Cycle 9
implementation closed that scenario only for `specificMerchants`; it did not
change either categorizer substring path. The current issue should therefore
remain in the aggregate as an incomplete cross-surface closure, not be merged
away as a regression in the already-fixed allowlist predicate and not be
described as wholly unprecedented.

Recommended fix: use one normalized merchant-term predicate with boundaries
for short ASCII terms across static categorization, taxonomy categorization,
and merchant allowlists while preserving intended Korean substring behavior.
Add category-plus-reward negative tests for every short ASCII alias and
positive tests for realistic branded statement variants.

### C10-CR-002 — confirmed

The optimizer defines the canonical reward-fact comparator at
`packages/core/src/optimizer/greedy.ts:103-167` and applies it to the main
eligible transaction input at `packages/core/src/optimizer/greedy.ts:479-485`.
Alternative construction instead appends the proposed group after the
candidate card's already-won transactions without sorting
(`packages/core/src/optimizer/greedy.ts:337-368`).

An independent stateful-rule reproduction used:

- winner: 20% dining;
- candidate: 10% wildcard, one use per month;
- same-date rows: ₩10,000 dining and ₩5,000 telecom.

The current optimizer gave the candidate the telecom row for ₩500, then
evaluated the dining counterfactual as `[telecom, dining]` and omitted it:

```text
current appended counterfactual total = 500; incremental alternative = 0
canonical [dining, telecom] total     = 1000; incremental alternative = 500
```

The existing Cycle 6 alternative coverage does not place a hypothetical group
canonically before an already-won candidate transaction, while the Cycle 9
determinism suite covers the main sorted path. Historical candidate-specific
searches found no earlier report of this counterfactual path.

Recommended fix: centralize canonical reward-input construction and use it for
both final totals and every counterfactual. Compute a signed safe-integer
delta, discard values at or below zero before constructing alternatives, and
cover hypothetical insertion on both sides of existing transactions for
max-use, fixed-per-day, category-cap, and global-cap rules.

### C10-CR-003 — confirmed

Every current producer creates a basis
(`packages/core/src/analysis/context.ts:124-143,169-179`) and the analyzer
stores it (`apps/web/src/lib/analyzer.ts:430-447`). Nevertheless the result
field remains optional (`apps/web/src/lib/analysis-result.ts:76-82`), the full
coherence path validates only a present basis
(`apps/web/src/lib/analysis-result.ts:650-684`), and the truncated path returns
before any basis check (`apps/web/src/lib/analysis-result.ts:536-565`).

The current payload shape omits the field from its requirements
(`apps/web/src/lib/persistence.ts:413-436`). Deserialization rejects a malformed
present value but accepts absence, reconstructs `undefined`, and then treats
the current-version result as coherent
(`apps/web/src/lib/persistence.ts:749-806`).

An independent production serializer/deserializer reproduction started with a
coherent two-month `_v: 4` result using a `user-total` basis of ₩300,000,
deleted both provenance fields, and returned:

```text
originalCoherent=true
accepted=true, warningKind=null, shouldRemove=false
restored previousSpendingBasis=undefined
reoptimization fallback basis=statement-month:2026-01
```

The disclosure also vanishes for an absent basis
(`apps/web/src/lib/analysis-disclosures.ts:50-53`), while the next edit falls
back from the missing user basis to statement-derived input
(`apps/web/src/lib/store.svelte.ts:356-366`). Historical candidate-specific
searches found no prior report of this current-schema provenance deletion.

Recommended fix: require `previousSpendingBasis` in both full and truncated
current results and v4 payloads. Require `previousMonthSpendingOption` to
exactly agree with `user-total` and be absent for other basis kinds. Add
coordinated-deletion and reload-then-reoptimize regressions.

### RPF10-PERF-001 — confirmed

The normal analyzer synchronously runs the exhaustive validator after its
worker result (`apps/web/src/lib/analyzer.ts:448-452`). The replacement runtime
then calls the same validator on the same object before committing it
(`apps/web/src/lib/analysis-replacement-runtime.ts:168-191`). The validator
allocates transaction ID arrays/sets, filters, maps, sorts date/month arrays,
and rebuilds category/month derivations
(`apps/web/src/lib/analysis-result.ts:490-648`). Reoptimization performs one
equivalent validation (`apps/web/src/lib/store.svelte.ts:406-430`), not the
normal path's duplicate.

After warm-up, an independent valid 100,000-transaction probe measured three
samples containing the two sequential calls:

```text
296.0 ms, 381.8 ms, 386.2 ms; median 381.8 ms
```

The admission boundary permits 10 MiB per file, 50 MiB total, and 50 files
without a transaction-count cap
(`apps/web/src/lib/upload-admission.ts:1-5`), so a six-figure compact CSV input
is reachable. Historical searches found no prior duplicate post-worker
full-coherence report.

Recommended fix: retain exhaustive validation at untrusted deserialization,
but validate freshly produced analysis once, carry a branded/opaque validated
result across the replacement boundary, and consolidate remaining full scans
into one pass or worker/yieldable work. Add an operation-count assertion and a
large synthetic performance guard.

### RPF10-SEC-001 — confirmed

The model tool schema and prompt explicitly let the model author `card.url`
(`tools/scraper/src/prompts/schemas.ts:24-68`;
`tools/scraper/src/prompts/system.ts:23-30`). The CLI knows the policy-validated
target URL but passes only cleaned text and issuer to extraction
(`tools/scraper/src/cli.ts:127-169`). The fetcher follows validated redirects
but returns only a string body, not final-URL provenance
(`tools/scraper/src/fetcher.ts:215-228,237-306`).

The trusted extraction boundary stamps issuer, date, source, and reward
quarantine without replacing the URL
(`tools/scraper/src/extractor.ts:68-116,170-213`). The canonical URL guard
proves only absolute credential-free HTTP(S) syntax
(`packages/rules/src/security.ts:30-55`). Publication carries the full card
into a public detail shard (`scripts/catalog-publication.ts:195-223`), and the
UI renders every syntactically safe value with the label “공식 카드 페이지”
(`apps/web/src/lib/external-url.ts:1-10`;
`apps/web/src/components/cards/CardDetail.svelte:140-145,265-277`).

An independent probe used the production extraction, publication, and final
href guards with a valid model response containing an attacker URL:

```text
extractedUrl=https://attacker.example/phish
publishedUrl=https://attacker.example/phish
renderedHref=https://attacker.example/phish
rewardSupport=unsupported:pending_source_review
```

Unsupported-only active cards remain browseable even when they cannot enter
optimization (`packages/rules/src/card-availability.ts:13-26`), so reward
quarantine does not contain this trust failure. Historical candidate-specific
searches found no earlier model-owned official-link finding.

Recommended fix: remove URL from model authority; thread the exact
policy-validated fetched/final URL through the extraction boundary or omit it
until explicit review; fail closed during publication when LLM-scraped URL
provenance is absent. Add an off-policy HTTP(S) adversarial test spanning
extraction, detail publication, and final link rendering.

### C10-CT-001 — confirmed

The canonical reward carries a stable ID, optional label, and structured
conditions (`packages/rules/src/types.ts:43-60`), and the detail publication
retains complete cards (`scripts/catalog-publication.ts:211-223`). The
supported-table projection reduces every reward tier to only `category` and
`tier` (`apps/web/src/components/cards/CardDetail.svelte:105-137`), then
renders only category, numeric benefit, cap, and performance label
(`apps/web/src/components/cards/CardDetail.svelte:312-359`). In contrast, the
unsupported disclosure preserves `reward.label`
(`apps/web/src/components/cards/CardDetail.svelte:364-395`).

The production `lotte-likit-eat` card authors three supported 60% dining rules
with distinct IDs, labels, and merchant scopes
(`packages/rules/data/cards/lotte/likit-eat.yaml:28-99`). An independent
production-loader projection reproduced three identical visible rows:

```text
dining | 60% | unlimited | tier1
dining | 60% | unlimited | tier1
dining | 60% | unlimited | tier1
```

The values discarded from those rows were respectively `음식점 60% 결제일
할인` scoped to 음식점, `배달앱 60% 결제일 할인` scoped to three delivery
apps, and `카페 60% 결제일 할인` scoped to four cafe brands. Thus the page
cannot tell a user which otherwise identical 60% row applies. Historical
searches found prior CardDetail label/race/localization topics but no prior
supported-condition/identity loss finding.

Recommended fix: carry reward ID, label, and conditions through the row model;
render the label as the benefit identity, category as secondary context, and
human-readable structured conditions. Fall back to an explicit
additional-conditions disclosure when a condition cannot be rendered. Add a
production-shaped LOCA LIKIT Eat component regression.

### C10-CT-002 — confirmed

The optimizer protocol is a TypeScript-only union
(`apps/web/src/lib/optimizer/worker-protocol.ts:7-14`). Its message handler
reads `event.data.ok` without runtime decoding or `try/catch`
(`apps/web/src/lib/optimizer/worker-runner.ts:66-110`). The parser runner
already protects the equivalent access and decoder so exceptions enter the
common settlement path
(`apps/web/src/lib/parser/worker-runner.ts:83-132`).

An independent fake-worker probe delivered cloneable `null` as an ordinary
message:

```json
{
  "thrown": "TypeError: null is not an object (evaluating 'event.data.ok')",
  "outcome": "pending",
  "terminations": 0,
  "listeners": { "message": 1, "error": 1, "messageerror": 1 }
}
```

The current fake helper only accepts the compile-time response union, and its
terminal-event coverage exercises `messageerror`, not invalid ordinary
messages (`apps/web/__tests__/optimizer-worker.test.ts:16-85,155-191`). This is
distinct from Cycle 9 RPF9-DBG-002: that fix covers failed structured-clone
delivery, whereas the reproduced value clones and reaches `message`.

Recommended fix: receive `MessageEvent<unknown>`, runtime-decode both union
arms and the success result, and wrap the entire handler so every invalid
payload uses the one fail/cleanup path. Test null, undefined, missing/invalid
discriminants, malformed success results, and malformed error messages for one
rejection, listener removal, and one termination.

### RPF10-DOC-001 — confirmed, with prior-history qualification

The Samsung & MILEAGE PLATINUM base rule says “1 mile per 1,000 won,” declares
`type: mileage`, authors `rate: 0.1` with no unit, and is supported; adjacent
two-mile rules carry `unit: miles` and are unsupported because mileage
valuation is not modeled
(`packages/rules/data/cards/samsung/and-mileage-platinum.yaml:27-59`).

Missing unit causes the schema to derive a generic percentage value
(`packages/rules/src/schema.ts:62-90,102-110`), and semantic validation treats
a positive rate as executable precisely when its unit is null
(`packages/rules/src/catalog-validation.ts:325-341`). The calculator then
computes `floor(amount * rate / 100)` and aggregates it into the same scalar as
monetary rewards (`packages/core/src/calculator/reward.ts:812-847,943-1011`).
The result contract explicitly calls that scalar total Won
(`packages/core/src/models/result.ts:1-6`), and the optimizer compares and
combines it directly (`packages/core/src/optimizer/greedy.ts:550-603`).

An independent production-rule reproduction with one eligible ₩100,000 row
returned:

```text
label="국내외 가맹점 기본 적립 (1000원당 1마일)"
type=mileage, rate=0.1, unit=null
totalReward=100, unsupportedRules=[]
```

The authored result is 100 miles, but web, terminal, and HTML consumers append
Won and derive a monetary rate
(`apps/web/src/lib/formatters.ts:7-11`;
`apps/web/src/components/dashboard/SavingsComparison.svelte:192-216`;
`packages/viz/src/terminal/comparison.ts:10-70`;
`packages/viz/src/report/generator.ts:117-121,252-290`). This confirms the
current unit/valuation and ranking defect.

Novelty qualification: historical C14-09 already questioned treating mileage
rates as percentages and requested an intentional representation/documentation
decision (`.context/reviews/2026-04-19-cycle14-comprehensive.md:108-115`).
Cycle 15 closed it only because a then-present comment claimed a
Won-equivalent convention
(`.context/reviews/2026-04-19-cycle15-comprehensive.md:11-17`). That rationale
is absent now, is contradicted by adjacent unsupported unit-tagged rules, and
does not explain the reproduced implicit ₩1-per-mile valuation. The current
finding should remain because the defect is concrete and current, but be
classified as a reopened/strengthened C14-09 contract failure rather than
wholly new history.

Recommended fix: preserve raw mileage and an explicit program-specific
monetary valuation separately, allowing only the valued monetary component
into optimizer/Won outputs. Until that contract exists, make every mileage
rule fail closed regardless of a missing unit. Add cross-unit optimizer and
renderer tests.

## Verification, deduplication, and missed-issue sweep

The independent focused suite covered all five affected contracts:

```text
bun test packages/core/__tests__/categorizer.test.ts \
  packages/core/__tests__/cycle6-optimizer-alternatives.test.ts \
  packages/core/__tests__/cycle9-calculation-determinism.test.ts \
  apps/web/__tests__/analysis-result.test.ts \
  apps/web/__tests__/store-persistence.test.ts \
  apps/web/__tests__/analysis-replacement-runtime.test.ts \
  tools/scraper/__tests__/extractor.test.ts \
  tools/scraper/__tests__/writer.test.ts \
  scripts/__tests__/catalog-publication.test.ts \
  apps/web/__tests__/external-url.test.ts

257 pass, 0 fail, 10 files, 1,371 expect() calls
```

These green tests are compatible with the reproductions because none asserts
the missing cross-path scenarios above. The same exact-HEAD non-browser gate
recorded by the test-engineer was also green: 2,952 tests in 125 files, plus
clean lint and typecheck.

The three candidates that arrived concurrently during the final report
integrity check were separately exercised with production modules after their
reports were read. The combined probes reproduced the three indistinguishable
LOCA rows, the pending malformed-worker promise with zero cleanup, and the
unitless mileage scalar shown above.

The historical sweep found:

- the Plan 114 wording overlap described under C10-CR-001, but a different
  implemented/fixed owner path;
- the C14-09 history described under RPF10-DOC-001, but no still-valid
  valuation contract at current HEAD;
- no pre-Cycle-10 match for the alternative-order, absent-basis,
  duplicate-coherence, model-URL, supported-detail-condition, or cloneable
  optimizer-message candidates;
- no new evidence for the rejected prefixed/leading-NUL XLSX inflation
  hypothesis, whose established route is plaintext/PRN rather than ZIP;
- no disabled `.only`/`.skip` tests or actionable unexplained production
  suppression marker;
- no additional candidate that had both a reachable current failure and
  non-duplicate provenance.

Final count: **0 new verifier findings; 8 of 8 same-cycle findings confirmed,
0 rejected.**
