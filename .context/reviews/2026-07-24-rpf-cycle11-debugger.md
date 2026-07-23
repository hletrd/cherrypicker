# Review-plan-fix Cycle 11 — debugger

- Date: 2026-07-24
- Reviewed revision: `5a8e636c0c66136ed3fff0396de226f77758a1bd`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Lens: executable reproduction, failure-path reachability, root cause,
  cross-boundary consequences, regression gaps, and historical duplicate
  control
- Outcome: **all four currently reported concrete candidates reproduced; no
  additional debugger-new finding**
- Scope: review and this report only; no source, test, plan, generated
  artifact, staging, commit, push, deployment, browser, E2E, or server run

## Inventory and method

The exact tracked tree contains **2,274 paths**. Its sorted filename-manifest
SHA-256 is
`8b15dbfc1093940063f141c9fb28442f628d4a333579a31b71aba87b93201ac5`.
Excluding the **1,113** tracked `.context` paths leaves **1,161 active paths**,
with manifest SHA-256
`bfa6a661e70aca250527b7efe58e91a4c655521dc861b076d6333e5af1b03b41`.

The debugger inventory covered every application, package, tool, script,
workflow/configuration, E2E, test, authored-rule, and generated/public
artifact family. High-volume data was traced through its schema, semantic
validator, publication, identity, and consumer boundaries. Success,
malformed, redundant-sign, no-hit, exact-cap, multi-cap, worker, persistence,
trust, and output paths were followed across parser → categorizer →
calculator/optimizer → web/CLI/report, and scraper → canonical publication →
card detail.

Every current Cycle 11 report available before close was read. Current and
archived plans/reviews were indexed before classification, then
candidate-specific histories were opened to distinguish fixed, deferred,
rejected, and genuinely current behavior.

## Candidate disposition

| Candidate | Debugger disposition |
|---|---|
| `C11-CR-001` | **Confirmed.** Redundant negative markers are applied twice and silently become positive spending on server and browser paths. |
| `RPF11-PERF-001` | **Confirmed, Medium / High.** Immutable boundary metadata is recomputed in the hottest full-scan loop and blocks the application thread. |
| `C11-CT-001` | **Confirmed, Medium / High.** Correct plural rule-cap telemetry cannot satisfy the web validator's singular category-cap model. |
| `RPF11-DOC-001` | **Confirmed, Medium / High.** Reviewed source provenance is treated as proof that an arbitrary safe HTTP(S) destination is issuer-official. |
| Cycle 11 security and designer passes | Accepted after targeted failure-boundary checks; no competing defect was established. |
| Cycle 11 architect zero-finding conclusion | Qualified by confirmed `C11-CT-001`, which is a real core-to-web contract failure missed by the broader boundary pass. |

The parser candidate's impact is financial misclassification, but its trigger
uses a redundant combination of two negative notations. The executable
evidence confirms the mechanism and consequence; it does not establish
real-world frequency sufficient to resolve the code review's Medium rating
against the critic's Low recommendation. That severity choice should be made
explicitly during aggregation rather than inferred from parser fan-out alone.

## `C11-CR-001` — redundant negative markers are double-negated

- **Kernel:** `packages/parser/src/shared/amount.ts:7-54`
- **Server reach:** `packages/parser/src/csv/shared.ts:47-72`;
  `packages/parser/src/shared/json.ts:216-237`;
  `packages/parser/src/statement.ts:48-138`;
  `tools/cli/src/parse-statement.ts:43-83`
- **Browser reach:** `apps/web/src/lib/parser/amount.ts:1-7`;
  `apps/web/src/lib/parser/csv.ts:125-142,439-469`;
  `apps/web/src/lib/parser/index.ts:25-137`;
  `apps/web/src/lib/analyzer.ts:78-109,143-188`
- **Other shared consumers:** server/browser XLSX, HTML, PDF, and OFX amount
  adapters

Direct kernel controls and failures at current HEAD were:

```text
-1000                 -> -1000
1000-                 -> -1000
마이너스1000          -> -1000
(-1000)               -> -1000
-1000-                ->  1000
마이너스-1000         ->  1000
마이너스-1000-        ->  1000
마이너스－１０００    ->  1000
－１０００－          ->  1000
```

An independently executed two-row generic CSV returned the `-1000-` refund as
`{ merchant: "REFUND", amount: 1000 }` on both the package parser and the web
parser, with **zero diagnostics**. A JSON input containing
`"마이너스-1000"` did the same on both paths. The second positive control row
was preserved normally.

The root cause is exact. Korean/trailing decorators are removed and recorded
in `isNegative`, but a native leading minus remains in `cleaned`.
`Number(match[0])` therefore produces `-1000`; the final
`isNegative ? -parsed : parsed` negates it again. Parentheses have a
form-specific “already negative” exception at lines 36–40, while the other
supported decorators do not.

Because the wrong result is positive, the parsers' `amount <= 0` refund gate
does not contain it. The row reaches categorization, month/category spending,
optimization, persistence, terminal summaries, and reports as a purchase.

Root repair: represent polarity once. Strip and validate the accepted outer
sign grammar, then apply one negative polarity to an absolute magnitude (or
reject redundant encodings). Do not add a third notation-specific
double-negative branch. Add kernel plus generic CSV/JSON regressions for ASCII
and full-width compositions, with the invariant that no accepted combination
of negative markers can yield a positive amount.

## `RPF11-PERF-001` — boundary predicates multiply the full-scan miss path

- **Predicate:** `packages/core/src/categorizer/normalize.ts:16-58`
- **Taxonomy scans:** `packages/core/src/categorizer/taxonomy.ts:146-193,
  195-244`
- **Static and reverse scans:** `packages/core/src/categorizer/matcher.ts:
  187-259,282-305`
- **Synchronous web reach:** `apps/web/src/lib/analyzer.ts:78-109,143-188`;
  `apps/web/src/lib/file-parse-queue.ts:110-141`
- **Admission envelope:** `apps/web/src/lib/upload-admission.ts:3-5`

The live matcher contains 324 taxonomy keywords, 12,065 exact static keywords,
and 12,047 static substring entries. Instrumenting
`RegExp.prototype.test()` only for the predicate's `[a-z0-9]` expression
showed that **one uncached no-hit merchant performs 50,132 boundary regex
tests**.

A five-sample, zero-hit isolated probe over 12,047 terms and 1,000 unique
private-use-character merchants produced:

```text
12,047,000 merchant/term pairs, both directions
plain includes predicates:       171.7 ms median
current boundary predicates:     652.2 ms median
precompiled flags/index-first:   169.8 ms median
current / plain ratio:             3.80x
```

All variants returned zero hits. The precompiled comparison retained the
current boundary semantics but stored each term's edge flags once and did not
inspect a boundary until `indexOf` found a candidate.

Independent end-to-end `MerchantMatcher` medians after warm-up were:

```text
  100 unique misses:    59.2 ms
  500 unique misses:   300.5 ms
1,000 unique misses:   618.9 ms
2,000 unique misses: 1,196.0 ms
```

An application-level probe passed 2,000 parsed transactions through
`categorizeParsedTransactions()`. It produced 2,000 uncategorized rows in
1,513.8 ms, while a zero-delay timer scheduled immediately before the call
was delayed 1,513.9 ms. Parsing can occur in workers, but categorization maps
synchronously after each worker result and the queue yields only after the
whole `parseAndCategorize()` call settles. The current cache is capped at 500,
so unique descriptions do not contain this path.

The root cause is not merely the already deferred linear matcher. The Cycle
10 correctness change computes two immutable term-edge regex predicates
before its first `indexOf`, for every forward and reverse comparison, and
taxonomy no-hit work is entered again through `findCategory()`. This is a new
constant-factor regression inside the known `D-C1-041` scan.

Root repair: compile normalized terms with leading/trailing boundary flags,
compile the merchant flags once, and evaluate neighbor character codes only
after a candidate occurrence exists. Preserve the short-alias differential
suite. The eventual `D-C1-041` multi-pattern and reverse-candidate indexes
remain separate deferred work.

## `C11-CT-001` — a correct two-rule cap result is rejected by web coherence

- **Plural producer state:** `packages/core/src/calculator/reward.ts:
  709-720,929-962`
- **Singular aggregate contract:** `packages/core/src/models/result.ts:13-29`
- **Rejecting check:** `apps/web/src/lib/analysis-result.ts:284-350`
- **Reachable product rule:** `packages/rules/data/cards/kb/kb-all.yaml:
  36-59,109-133`
- **Visible failure:** `apps/web/src/lib/analyzer.ts:455-459`

The independent probe loaded the real `kb-all` card and taxonomy. `Amazon`
resolved to `online_shopping`; transactions carried verified
`paymentType: "overseas"`, and the card received 500,000 Won previous-month
spending.

One 100,000 Won purchase used the specific overseas rule, produced a 5,000
Won reward and one 5,000 Won `monthly_category` cap, and
`isAnalysisResultCoherent()` returned `true`. Two purchases correctly
exhausted that rule, fell back to the general rule, and produced:

```text
category reward: 15,000
category capAmount: 10,000
capsHit: monthly_category 5,000
         monthly_category 10,000
isAnalysisResultCoherent: false
```

The calculator tracks usage by rule and legitimately emits multiple
`CapInfo` entries for one category. `CategoryReward`, however, exposes one
`capAmount`, and line 947 overwrites it with the last contributing rule's cap.
The validator then requires every monthly-category cap for that category to
equal the one surviving value. Correct plural state cannot satisfy the lossy
aggregate contract, so `analyzeMultipleFiles()` throws its generic
analysis-coherence error instead of committing the result.

Root repair: carry stable rule/cap-group identity with cap telemetry and make
the aggregate representation explicitly plural (or remove the ambiguous
singular field). Validate each cap against its producer; do not simply delete
the mismatch check. Update worker/persistence decoders with the DTO and add
the real `kb-all` one- versus two-transaction producer-to-validator
regression.

## `RPF11-DOC-001` — source provenance is mislabeled as issuer authority

- **Unconditional label:** `apps/web/src/components/cards/CardDetail.svelte:
  143-147,268-280`
- **Syntax-only href guard:** `apps/web/src/lib/external-url.ts:1-10`;
  `packages/rules/src/security.ts:30-55`
- **Provenance rule:** `packages/rules/src/schema.ts:262-285`

A complete read-only catalog query loaded all 683 current cards and reproduced
the document report's conservative **26** third-party reviewed URLs:
15 `www.banksalad.com`, five `m.card-gorilla.com`, two `namu.wiki`, and one
each on four news sites. Provenance was 25 `manual` and one `web`. Confirmed
examples include `kb-need-edu` pointing to Financial Post,
`lotte-loca-for-auto` and `ibk-ceo` pointing to Card Gorilla, and
`samsung-and-point` pointing to Banksalad.

A schema/href probe using the Financial Post URL returned:

```text
source=manual      schemaAccepts=true   href retained
source=web         schemaAccepts=true   href retained
source=llm-scrape  schemaAccepts=false  href retained by syntax guard
```

The UI calls every retained value `officialCardUrl` and renders “공식 카드
페이지.” The schema proves only reviewed provenance for `manual`/`web`; the
last-mile guard proves only safe absolute HTTP(S) syntax. Neither proves that
the destination belongs to the issuer. This is distinct from the fixed Cycle
10 model-authority defect: these records are already canonical and reviewed.

Root repair: separate `officialUrl` from neutral `sourceUrl`, bind official
destinations to issuer-owned or explicitly approved hosts, migrate current
third-party records, and label/show their destination as an information
source rather than issuer-official.

## Duplicate control, verification, and closing sweep

- Protected Cycle 42 and archived history cover `(-1234)`, not the
  non-parenthesized overlapping sign forms. No earlier `-1000-` or
  `마이너스-1000` regression was found.
- `D-C1-041` owns the full-scan matcher architecture, but not the Cycle 10
  boundary predicate's independently measured 3.80× constant-factor cost.
- Prior exact rule/global cap findings concern missing exhaustion telemetry.
  No prior report described valid plural rule caps being rejected by a
  singular cross-layer validator.
- Cycle 10 URL work concerns model authority. The 26 already-reviewed
  third-party records and false issuer-official label are a different
  provenance/meaning failure.
- The prefixed-XLSX/ZIP-inflation hypothesis remains rejected and was not
  revived.

Focused verification passed **390 tests, 0 failures** in two commands: 119
parser/non-spending/categorizer/boundary tests and 271 recent
calculator/optimizer/analysis/worker/navigation/card-detail/rules/scraper
tests. Their green state is consistent with the identified gaps: none supplies
redundant sign compositions, a no-hit performance guard, a real plural-cap
producer result to web coherence, or issuer-host semantics for reviewed URLs.

The final sweep revisited amount/sign grammars, parser refund gates,
categorizer forward/reverse scans and cache churn, rule selection and cap
fallback, global/occurrence state, optimizer aggregation, worker settlement,
analysis coherence/persistence, catalog identity, scraper trust, URL
publication/rendering, output sinks, admission/resource bounds, and every
recent Cycle 10 production change. No fifth current candidate and no
additional genuinely new debugger finding survived reproduction,
reachability, materiality, and duplicate checks.

No browser, server, E2E, external lookup, source/test/plan/generated edit,
staging, commit, push, or deployment was performed.

Final count: **0 additional debugger-new findings; 4 current Cycle 11
candidates independently confirmed**.
