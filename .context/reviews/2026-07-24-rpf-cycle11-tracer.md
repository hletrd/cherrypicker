# Review-plan-fix Cycle 11 — tracer

- Date: 2026-07-24
- Reviewed revision: `5a8e636c0c66136ed3fff0396de226f77758a1bd`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Lens: producer-to-consumer causality, executable consequence, competing
  hypotheses, historical provenance, and raw-to-unique reconciliation
- Scope: review and this report only; no source, test, plan, generated
  artifact, staging, commit, push, deployment, browser, E2E, server, or
  external-system mutation

## Outcome and raw-to-unique disposition

All four current raw candidates survive independent tracing. They represent
four distinct root causes and four unique findings; none is a duplicate of
another current candidate.

| Raw candidate | Unique disposition | Severity | Confidence | Tracer result |
|---|---|---:|---:|---|
| `C11-CR-001` | Preserve as one parser-sign finding | Medium | High | Confirmed from accepted amount text through a validated, persistable false reward |
| `RPF11-PERF-001` | Preserve as one new constant-factor matcher regression | Medium | High | Confirmed with real-corpus counts, same-result differential, and main-thread timer delay |
| `RPF11-DOC-001` | Preserve as one provenance/label contract finding | Medium | High | Confirmed across canonical YAML, schema, publication, loader, href guard, and UI copy |
| `C11-CT-001` | Preserve as one core-to-web cap-contract finding | Medium | High | Confirmed through a supported JSON producer and the default all-card browser analysis shape |

`C11-CR-001` has a lower-likelihood trigger because two negative notations
must be redundantly composed. The tracer nevertheless retains Medium rather
than the critic's and verifier's proposed Low: the accepted row is silently
reclassified as positive spending, earns a real reward, passes the exhaustive
coherence boundary, and is eligible for browser persistence. This consequence
is more than a parse diagnostic or cosmetic error. The trigger caveat rules
out High and should remain explicit in aggregation.

There are **0 tracer-new findings**. The Cycle 11 security and designer
zero-finding conclusions survived targeted checks. The architect's broad
zero-finding conclusion remains qualified by `C11-CT-001`, as both the critic
and debugger observed.

## Inventory, reports, and trace boundary

The pinned tree contains **2,274 tracked paths**. Its sorted filename-manifest
SHA-256 is
`8b15dbfc1093940063f141c9fb28442f628d4a333579a31b71aba87b93201ac5`.
Excluding the 1,113 tracked `.context` paths leaves **1,161 active paths**, with
manifest SHA-256
`bfa6a661e70aca250527b7efe58e91a4c655521dc861b076d6333e5af1b03b41`.

The inventory covered every application, package, tool, script,
workflow/configuration, E2E, test, authored-rule, and generated/public
artifact family. High-volume card and public data were traced through their
canonical schema, semantic validation, generator identity, and consumer
boundaries.

All ten available Cycle 11 reports were read before close: code, performance,
security, critic, architect, designer, document specialist, test engineer,
debugger, and verifier. Current and archived aggregates/plans were indexed
before classification. Candidate-specific history included protected Cycle
42 sign reports, archived Plan 115's cap-coherence work, Plan 72's deferred
`D-C1-041`, Cycle 10 URL-trust reviews and Plan 122, and current generated
artifact provenance. The verifier independently confirms all four candidates
and differs from this tracer only on whether the redundant-sign candidate's
low input likelihood outweighs its validated financial consequence.

## Trace 1 — `C11-CR-001`: redundant negative markers become validated spending

- **Canonical kernel:** `packages/parser/src/shared/amount.ts:7-63`
- **CSV admission:** `packages/parser/src/csv/shared.ts:47-72`;
  `packages/parser/src/csv/generic.ts:109-219`
- **Other producers:** `packages/parser/src/shared/json.ts:216-237`;
  server/browser JSON, XLSX, HTML, PDF, and OFX adapters
- **Server/CLI dispatch:** `packages/parser/src/statement.ts:48-138`;
  `tools/cli/src/parse-statement.ts:43-83`
- **Browser dispatch:** `apps/web/src/lib/parser/index.ts:25-137`;
  `apps/web/src/lib/analyzer.ts:78-109,143-188`
- **Financial consumers:** `packages/core/src/calculator/reward.ts:729-748`;
  `packages/core/src/optimizer/greedy.ts:454-520`
- **Validation/state reach:** `apps/web/src/lib/analysis-result.ts:725-824`;
  `apps/web/src/lib/analysis-replacement-runtime.ts:168-189`

### Causal trace

The helper strips a Korean-minus or trailing-minus decorator and records
negative polarity in `isNegative`, but it leaves a native/full-width leading
minus in the numeric payload. `Number()` therefore returns a negative number,
and the final polarity application negates it again. The parentheses path has
a one-off already-negative exception; Korean/trailing decorators do not.

The generic CSV amount gate sees the resulting positive safe integer and
accepts it. Categorization and optimization have no remaining fact from which
to infer that it was a refund. Coherence validation then proves that all
derived positive-spending totals agree with that already-corrupted source
fact, brands the result, and allows replacement state to commit and persist
it.

An executable current-HEAD trace used:

```csv
date,merchant,amount
2026-07-01,Amazon,-100000-
```

with the real taxonomy and current `kb-all` tier 1 rule:

```text
parseAmountString("-100000-") => 100000
generic CSV errors             => 0
parsed/categorized amount      => 100000
optimization total spending   => 100000
optimization reward           => 10000
isAnalysisResultCoherent       => true
validateAnalysisResult         => branded result
```

Thus parser refund filters do not contain the defect; the false purchase is
accepted through the strongest current web state boundary. JSON string
amounts and all shared-kernel adapters have the same root behavior.

### Severity, history, and repair

Status is **Confirmed, Medium / High confidence**. The redundant syntax makes
likelihood lower than an ordinary negative form, but silent financial
misclassification and recommendation impact justify retaining Medium.

Protected Cycle 42 and Cycle 40 history covers the exact parenthesized
`(-1234)` composition, which the current one-off branch fixes. Searches found
no previous `-1000-`, `마이너스-1000`, or equivalent full-width composition.
This is a distinct surviving grammar case, not a relabel of the fixed
parenthesized input.

Root repair: parse sign grammar into one polarity, strip/validate all outer
decorators, and apply that polarity once to an absolute magnitude. Redundant
negative encodings may remain negative or be rejected, but must never become
positive. Add a canonical composition matrix and CSV/JSON boundary cases.

## Trace 2 — `RPF11-PERF-001`: immutable boundary work multiplies the hot miss path

- **Predicate:** `packages/core/src/categorizer/normalize.ts:16-58`
- **Stored keyword shape:** `packages/core/src/categorizer/matcher.ts:54-120`;
  `packages/core/src/categorizer/taxonomy.ts:51-90`
- **Repeated scans:** `packages/core/src/categorizer/matcher.ts:187-285`;
  `packages/core/src/categorizer/taxonomy.ts:146-244`
- **Synchronous browser consumer:** `apps/web/src/lib/analyzer.ts:78-109,
  143-180,286-337`
- **CLI consumers:** `tools/cli/src/commands/analyze.ts:63`;
  `tools/cli/src/commands/optimize.ts:66`;
  `tools/cli/src/commands/report.ts:71`
- **Admitted input bound:** `apps/web/src/lib/upload-admission.ts:3-5`

### Causal trace

Matcher/taxonomy construction stores normalized term strings but not their
immutable leading/trailing ASCII-boundary flags. A complete unique miss scans
324 taxonomy terms, 12,047 static substring entries in both directions, then
re-enters taxonomy substring and reverse-fuzzy scans. This yields about
25,066 helper calls and 50,132 up-front boundary-regex tests per uncached
complete miss before considering neighbor checks after real hits.

Parsing may happen in workers, but `parseAndCategorize()` synchronously maps
the parsed transaction array through `MerchantMatcher` before optimizer
worker dispatch. The two-lane queue cannot yield inside that map, and the
500-entry LRU does not help a statement with many distinct descriptions.

Independent current-host evidence:

```text
real matcher corpus: 12,047 static substring entries, 324 taxonomy terms

Real MerchantMatcher, three-sample medians
  100 unique misses:   74.4 ms
  500 unique misses:  376.1 ms
1,000 unique misses:  743.3 ms

12,047 terms × 500 unique no-hit merchants, both directions
current repeated predicate:       543.4 ms
compiled flags + index-first:     170.2 ms
ratio:                              3.19x
hit counts:                         0 / 0

categorizeParsedTransactions, 1,000 unique misses
synchronous call:                 805.5 ms
zero-delay timer observed:        805.6 ms
```

The differential preserves current boundary semantics and has equal zero-hit
results. The timer trace demonstrates the user-visible main-thread
consequence rather than inferring it from an isolated loop alone.

### Severity, history, and repair

Status is **Confirmed, Medium / High confidence**. The report is correctly
scoped to a new Cycle 10 constant-factor regression. Plan 72's
`D-C1-041` already owns eliminating the underlying all-keyword scans and
retains its separate High/High provenance; it is not counted again.

Root repair: compile each normalized term with boundary flags at matcher and
taxonomy construction, compile merchant edge flags once for reverse matching,
and inspect boundary neighbors only after `indexOf` finds a candidate. Preserve
the short-ASCII-alias semantic suite and add an operation-count or
compiled-metadata guard. This does not close `D-C1-041`.

## Trace 3 — `RPF11-DOC-001`: reviewed source provenance becomes an “official” claim

- **Canonical example:** `packages/rules/data/cards/kb/need-edu.yaml:1-12`
- **Schema:** `packages/rules/src/schema.ts:262-285`
- **Syntax guard:** `packages/rules/src/security.ts:30-55`
- **Publication:** `scripts/catalog-publication.ts:144-170,190-223`
- **Published consumer:** `apps/web/public/data/card-details/kb.json:1`
- **Runtime loader:** `apps/web/src/lib/cards.ts:362-379,482-506`
- **Last-mile guard:** `apps/web/src/lib/external-url.ts:1-10`
- **Unconditional label:** `apps/web/src/components/cards/CardDetail.svelte:
  143-147,163-169,268-280`

### Causal trace

`card.source` describes curation provenance, not destination ownership.
Nevertheless, the schema rejects a non-empty URL only while source remains
`llm-scrape`; `manual` and `web` accept any syntactically safe HTTP(S) host.
Publication copies that value into the issuer detail shard. The loader copies
it into `CardDetail`, and `safeExternalHref()` checks only scheme,
credentials, whitespace, controls, and parseability. The component calls the
result `officialCardUrl` and always labels it “공식 카드 페이지.”

Executable schema/publication evidence:

```text
https://attacker.example/phish
  source=manual      schema accepts
  source=web         schema accepts
  source=llm-scrape  schema rejects

Current reviewed corpus on conservative third-party/news/wiki hosts:
  26 URLs = 25 manual + 1 web

kb-need-edu:
  canonical URL  = Financial Post news article
  published URL  = same Financial Post article
  runtime href   = same Financial Post article
  UI label       = "공식 카드 페이지"
```

The 26-record query reproduced 15 Banksalad, five Card Gorilla, two Namu Wiki,
and four news-site destinations. It deliberately excluded ambiguous
partner/co-brand hosts. Safe navigation syntax and human review do not prove
issuer control, so a user seeking authoritative terms or an application page
receives a false source-identity claim.

### Severity, history, and repair

Status is **Confirmed, Medium / High confidence**. This is distinct from
Cycle 10 `RPF10-SEC-001` and completed Plan 122. That work removed an
untrusted model's authority to author the URL before review. Every example
here begins after that boundary with canonical `manual`/`web` provenance; the
remaining failure is field/label semantics and issuer-host authority.

Root repair: separate issuer-bound `officialUrl` from neutrally labeled
`sourceUrl`, migrate existing third-party records, show destination identity
for source links, and validate official hosts against the issuer registry plus
explicit reviewed aliases during publication.

## Trace 4 — `C11-CT-001`: correct plural caps cannot satisfy singular web state

- **Current card rules:** `packages/rules/data/cards/kb/kb-all.yaml:36-59,
  109-136`
- **Typed statement fact producer:** `packages/parser/src/shared/transaction-facts.ts:
  54-70,192-206`; `packages/parser/src/json/index.ts:17-112`
- **Rule selection/fallback:** `packages/core/src/calculator/reward.ts:248-280,
  450-502`
- **Plural producer state:** `packages/core/src/calculator/reward.ts:709-720,
  929-962`
- **Singular DTO:** `packages/core/src/models/result.ts:13-29`
- **Rejecting validator:** `apps/web/src/lib/analysis-result.ts:284-350`
- **Analyzer failure:** `apps/web/src/lib/analyzer.ts:432-461`
- **Browser state conversion:** `apps/web/src/lib/analysis-replacement-runtime.ts:
  163-202`; `apps/web/src/components/upload/FileDropzone.svelte:345-380`

### Causal trace

At tier 1, `kb-all` has a supported 5% overseas online-shopping rule with a
5,000 Won monthly cap and a supported general 10% online-shopping rule with a
10,000 Won monthly cap. The conditional rule is more specific. Once its
rule-scoped tracker is exhausted, `previewRuleAvailability()` correctly skips
it and the exclusive selection loop falls back to the general rule.

The calculator legitimately records two `monthly_category` `CapInfo` values
for the same category. `CategoryReward`, however, exposes only one
`capAmount`, and line 947 overwrites it with the last contributing rule's cap.
The web validator requires every monthly-category `CapInfo.capAmount` for the
bucket to equal that single surviving field. Correct plural state is therefore
unrepresentable.

The minimal selected-card executable control used two supported JSON rows:

```json
{"date":"2026-07-01","merchant":"Amazon","amount":100000,"paymentType":"overseas"}
{"date":"2026-07-02","merchant":"Amazon","amount":100000,"paymentType":"overseas"}
```

The JSON parser attached statement provenance to `paymentType`, the real
taxonomy resolved `Amazon` to `online_shopping`, and `kb-all` at 500,000 Won
previous spending produced:

```text
category reward:     15000
category capAmount:  10000
capsHit:              5000, 10000
isAnalysisResultCoherent: false
validateAnalysisResult:   null

one-row control:
capsHit:              5000
isAnalysisResultCoherent: true
validateAnalysisResult:   branded result
```

The defect also reaches the default all-card path without a private card
filter. A deterministic current-catalog trace with 58 valid 100,000 Won
overseas `online_shopping` JSON rows and 500,000 Won prior spending assigned
all 58 transactions across the normal catalog. Two rows landed on `kb-all`,
which again emitted the valid 5,000 and 10,000 Won caps. The complete analysis
failed coherence and returned `null` from validation.

`analyzeMultipleFiles()` consequently throws its generic sum-mismatch error
before returning a branded result. `AnalysisReplacementRuntime` catches it,
commits `error`, keeps `result` null, and the upload component displays the
error state and focuses retry. The user sees no recommendation even though
parsing, categorization, reward arithmetic, and optimization all succeeded.

### Severity, history, and repair

Status is **Confirmed, Medium / High confidence**. Fifty-eight rows are far
inside the admitted input envelope, and the default optimizer reproduction
removes dependence on an unexposed UI card filter.

Cycle 8 exact-cap work concerns whether individual rule/global exhaustion
events are emitted. Cycle 9 Plan 115 added rejection of contradictory cap
telemetry but assumed a category has one monthly cap. No prior report found
the valid multi-rule producer shape being rejected by that singular
cross-layer contract, so this is genuinely new.

Root repair: make cap telemetry rule-scoped end to end with stable `ruleId` or
`capGroup`, and make the aggregate explicitly plural or remove the ambiguous
singular field. Validate each cap against its producer while retaining
safe-integer, actual/applied, category, and `capReached` invariants. Update
worker/persistence decoders and add both the minimal `kb-all` control and
default-catalog producer-to-state regression.

## Competing hypotheses and duplicate control

- Parser fan-out alone does not establish common occurrence; the composed
  negative trigger remains explicitly qualified. It does establish that every
  shared consumer receives the same silent positive value.
- The matcher finding is not a relabel of linear scans. Equal-result
  measurements isolate repeated boundary metadata/index ordering introduced
  after the deferred architecture was recorded.
- The URL finding is not a reopened model-phishing path. Current examples have
  reviewed canonical provenance, and the false statement is the unconditional
  issuer-official label.
- Differently capped rules do not automatically imply a cap failure when
  transactions land in different subcategory buckets. Both reported
  reproductions use the real same-key taxonomy result and actual rule fallback.
- The rejected leading-NUL/prefixed-XLSX inflation hypothesis remains rejected
  and was not revived.
- No fifth candidate survived concrete execution, consumer reach, materiality,
  and historical deduplication.

## Verification and closing sweep

- Four independent executable probes reproduced the four candidates and their
  downstream consequences.
- A focused non-browser matrix passed **266 tests, 1,549 expectations, 0
  failures** across parser amount/CSV/JSON, categorizer, analysis coherence,
  card-detail presentation, rules security, and catalog publication. These
  green suites are consistent with the missing cross-composition,
  performance-cost, issuer-authority, and plural-cap cases.
- The final sweep revisited sign grammars and refund gates, parser/worker
  parity, categorizer scan/cache behavior, rule specificity and cap fallback,
  optimizer assignment, worker DTOs, analysis validation/replacement/
  persistence, catalog provenance and public shards, href/output sinks,
  admission/resource bounds, UI error state, and current/archived provenance.
  No additional issue met the tracer threshold.
- HEAD and branch remained unchanged. No tracked or staged change was made.

Final result: **4 raw candidates → 4 unique confirmed findings; 0 rejected,
0 deduplicated into one another, and 0 tracer-new findings.**

The only path written by this tracer is
`.context/reviews/2026-07-24-rpf-cycle11-tracer.md`.
