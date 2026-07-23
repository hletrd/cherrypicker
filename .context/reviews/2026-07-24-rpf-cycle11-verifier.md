# Review-plan-fix Cycle 11 — verifier

## Baseline and outcome

- Review date: 2026-07-24
- Exact revision: `5a8e636c0c66136ed3fff0396de226f77758a1bd`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Role: report-only independent verifier
- Raw concrete candidates: **4**
- Unique retained findings: **4**
- Rejected concrete candidates: **0**
- Final severity count: **3 Medium, 1 Low**

The four retained findings are:

| ID | Final severity | Confidence | Verifier disposition |
|---|---:|---:|---|
| `C11-CR-001` | Low | High | Confirmed; distinct remaining sign-composition case, with severity reduced from the code report's Medium rating |
| `RPF11-PERF-001` | Medium | High | Confirmed; new constant-factor regression inside, but not identical to, deferred full-scan work `D-C1-041` |
| `C11-CT-001` | Medium | High | Confirmed; valid plural rule-cap state is rejected by the singular core-to-web aggregate contract |
| `RPF11-DOC-001` | Medium | High | Confirmed; reviewed source provenance is incorrectly presented as issuer-official destination authority |

No source, test, plan, generated artifact, staging, commit, push,
deployment, browser, E2E, server, or external system was changed. The only
path written by this verifier is this report.

## Review coverage

All ten Cycle 11 role reports available before verifier close were read in
full:

- architect;
- code reviewer;
- critic;
- debugger;
- designer;
- document specialist;
- performance reviewer;
- security reviewer; and
- test engineer; and
- tracer.

Candidate-specific history was then checked against the exact current tree,
including:

- Cycle 40/41/42 parenthesized-negative reports and Plan 66;
- Plan 69's shared parser/CLI amount grammar;
- Plan 72 and Cycle 9/10 performance reports for `D-C1-041`;
- Cycle 9 verifier `VER-02` and archived Plan 115's cap-coherence work;
- archived Plan 71's safe external-URL contract;
- Cycle 10 security/verifier reports and Plan 122's model-URL trust repair; and
- current tests and current production catalog data at each affected
  boundary.

The verification used production modules and current authored data. It did not
start a browser or server.

## `C11-CR-001` — redundant negative markers can become positive spending

- **Final severity:** Low
- **Confidence:** High
- **Status:** Confirmed; unique current case
- **Canonical kernel:** `packages/parser/src/shared/amount.ts:7-54`
- **Generic CSV reach:** `packages/parser/src/csv/generic.ts:109-220`;
  `packages/parser/src/csv/shared.ts:47-72`
- **Server/CLI dispatch:** `packages/parser/src/statement.ts:48-138`;
  `tools/cli/src/parse-statement.ts:43-83`
- **Browser reach:** `apps/web/src/lib/parser/amount.ts:1-7`;
  `apps/web/src/lib/parser/csv.ts:125-142,439-469`;
  `apps/web/src/lib/parser/index.ts:25-137`

### Independent reproduction

The current shared helper returned:

```text
"-1000-"          =>  1000
"-1,234-"         =>  1234
"마이너스-1000"    =>  1000
"마이너스-1,234"   =>  1234
"－1000-"          =>  1000
"-1000－"          =>  1000
"－1000－"          =>  1000
"마이너스－1000"    =>  1000
"－１，０００－"    =>  1000

"-1000"           => -1000
"1000-"           => -1000
"마이너스1000"     => -1000
"(-1000)"         => -1000
"（－１０００）"   => -1000
```

The exact generic CSV:

```csv
date,merchant,amount
2026-01-15,REFUND,-1000-
```

produced:

```json
{
  "transactions": [
    {
      "date": "2026-01-15",
      "merchant": "REFUND",
      "amount": 1000
    }
  ],
  "errors": []
}
```

The refund is therefore not contained by downstream non-spending filters:
they receive a valid-looking positive safe integer.

### Root cause

`parseAmountString()` normalizes full-width minus to ASCII minus. Korean or
trailing negative decorators set `isNegative` and remove that decorator, but
they leave a native leading `-` in the numeric token. `Number()` first parses
the payload as negative; the final `isNegative ? -parsed : parsed` negates it
again. Parentheses have a form-specific already-negative exception, while the
Korean and trailing decorators do not.

### Historical ownership and severity

This is not a duplicate of the fixed `(-1234)` case. Plan 66 and the Cycle
40–42 reports specifically owned accounting parentheses around an already
negative token, and current controls prove that exact form remains fixed.
Plan 69 added and tested native/full-width leading minus, Korean-minus, and
trailing-minus individually; it did not cover their composition. No prior
candidate-specific history contained `-1000-`, `마이너스-1000`, or their
full-width equivalents.

The finding is retained because the exact current syntax and missing
composition invariant were not previously reported. Its final severity is
**Low**, not Medium: every reproduced failure redundantly encodes negativity
twice, so practical input likelihood is low and matches the historical
severity precedent for `(-1234)`. Confidence remains High because the
financial sign flip and product reach are deterministic.

The late tracer retained Medium after carrying the false purchase through
reward calculation, coherence, and persistence. That confirms downstream
impact but does not change this verifier's severity judgment: those consumers
all deterministically amplify the same low-likelihood redundant input, while
the directly comparable historical sign-composition case was Low.

### Root repair

Parse polarity once. Strip and validate the accepted outer sign grammar, then
apply one negative polarity to an absolute magnitude, or reject redundant
negative encodings. Do not add another decorator-specific double-negative
exception.

Add a canonical table covering ASCII/full-width leading minus composed with
Korean and trailing decorators. State the invariant directly: an accepted
combination of negative markers may remain negative, or it may be rejected,
but it must never become positive. Add generic CSV/JSON boundary tests that
require the same invariant through parser diagnostics and transaction
admission.

## `RPF11-PERF-001` — boundary metadata is recomputed in the full-scan hot loop

- **Final severity:** Medium
- **Confidence:** High
- **Status:** Confirmed; unique incremental regression
- **Predicate:** `packages/core/src/categorizer/normalize.ts:16-58`
- **Static matcher scans:** `packages/core/src/categorizer/matcher.ts:187-259`
- **Taxonomy scans:** `packages/core/src/categorizer/taxonomy.ts:146-244`
- **Synchronous application reach:** `apps/web/src/lib/analyzer.ts:78-109,143-188`

### Trace and operation count

The production matcher contained:

```text
static substring entries: 12,047
taxonomy keywords:            324
```

For one uncached complete miss with a merchant name of at least three
characters, the current control flow calls
`normalizedMerchantTermMatches()` approximately:

```text
initial taxonomy substring scan                 324
static forward and reverse scans             24,094
fallback taxonomy substring and reverse scans   648
total                                         25,066
```

Every invocation computes the normalized term's immutable leading and
trailing ASCII-boundary flags with two regular-expression tests before the
first `indexOf`. That is about **50,132 up-front edge regex tests per unique
complete miss**, excluding neighbor checks after actual occurrences.

Commit `6cbafb3d1f652e1b30fef30f37f47e913226cc55` introduced this exact
predicate in place of `includes()` across matcher and taxonomy paths. This
isolates the new work from the older scan topology.

### Independent benchmark

Three post-construction samples per size through the real
`MerchantMatcher.match()` produced:

```text
  100 unique misses: samples 67.3, 58.6, 59.4 ms; median  59.4 ms
  500 unique misses: samples 304.1, 294.0, 302.2 ms; median 302.2 ms
1,000 unique misses: samples 598.6, 603.1, 611.5 ms; median 603.1 ms
```

A separate five-sample zero-hit differential used all 12,047 static terms,
300 unique merchants, and both forward and reverse directions:

```text
pairs:                         7,228,200
current predicate median:          207.7 ms
precompiled/index-first median:     95.6 ms
ratio:                               2.17x
matches:                        0 versus 0
```

The precompiled comparison stored each term's two edge flags once, compiled
each merchant's reverse-match flags once, and inspected neighboring
characters only after `indexOf` found an occurrence. Direct parity controls
agreed for intended and rejected boundary cases including `cu 강남`, `scuba`,
`acu`, `cu2`, `kt-대리점`, `sktstore`, Korean terms, and repeated ASCII
occurrences.

Wall-clock values are host-specific. The operation ownership and equal-output
differential are the decisive evidence.

### Distinction from deferred `D-C1-041`

Plan 72's `D-C1-041` owns the pre-existing algorithmic problem: a complete
miss scans the full approximately 12,740-term corpus, including repeated
taxonomy passes. Its exit criteria require a compiled multi-pattern matcher
and bounded reverse candidate index so the hot miss path no longer scans the
whole corpus.

This finding does not relabel that debt. It owns the narrower Cycle 10
regression that performs two regex-derived edge computations inside each of
those already-known comparisons. Precomputing edge metadata and delaying
boundary inspection removes this incremental cost while leaving the
`O(transactions × terms)` architecture—and therefore `D-C1-041`—open.

### Root repair

Compile every normalized authored term with leading/trailing ASCII-boundary
flags during taxonomy/matcher construction. Compile the normalized merchant's
reverse-match flags once per `match()` call. Use character-code checks for
neighbors only after a candidate occurrence exists.

Protect Cycle 10 semantics with a differential corpus covering every authored
term plus prefixes, suffixes, punctuation, case/NFKC variants, and the CU/KT/
SKT near-collisions. Prefer deterministic assertions about compiled metadata
and operation ownership, plus one generous public-boundary benchmark. Keep
Plan 72's multi-pattern/reverse-index work as a separate open item.

## `C11-CT-001` — valid two-rule cap telemetry is rejected as incoherent

- **Final severity:** Medium
- **Confidence:** High
- **Status:** Confirmed; unique current cross-layer failure
- **Plural producer state:** `packages/core/src/calculator/reward.ts:709-720,929-962`
- **Singular aggregate contract:** `packages/core/src/models/result.ts:13-29`
- **Optimizer projection:** `packages/core/src/optimizer/greedy.ts:408-452`
- **Rejecting validator:** `apps/web/src/lib/analysis-result.ts:288-350`
- **Reachable current rule:** `packages/rules/data/cards/kb/kb-all.yaml:36-59,109-136`
- **User-visible failure boundary:** `apps/web/src/lib/analyzer.ts:455-459`

### Independent reproduction

The probe loaded the current `categories.yaml` and real `kb-all` card rule.
The production matcher resolved `Amazon` to:

```json
{
  "category": "online_shopping",
  "confidence": 1
}
```

The card received ₩500,000 previous-month spending, and each Amazon
transaction was a ₩100,000 online overseas purchase with statement
provenance.

The one-transaction control produced:

```text
total reward:                    5,000
category capAmount:              5,000
monthly_category capsHit:       [5,000]
isAnalysisResultCoherent():       true
```

Two transactions produced:

```text
total/category reward:          15,000
category spending:             200,000
category capAmount:             10,000
monthly_category capsHit:       [5,000, 10,000]
isAnalysisResultCoherent():       false
```

The first purchase uses and exhausts the more-specific 5% overseas rule. The
second correctly falls back to the general 10% online-shopping rule and
exhausts that rule's cap. The optimizer result is financially correct and
internally balanced before web coherence rejects it.

### Root cause

Rule usage and `capsHit` are correctly rule-scoped, so several legitimate
`monthly_category` entries can share one reported category. `CategoryReward`
has only one optional `capAmount`, however, and the calculator overwrites that
field whenever another contributing rule is processed. The web validator then
requires every monthly-category cap for the category to equal that one
last-written value. Correct plural state cannot satisfy this lossy singular
contract.

### Historical ownership

Cycle 9 verifier `VER-02` and archived Plan 115 owned the opposite failure:
impossible or corrupted cap telemetry was accepted without semantic
reconciliation. The plan correctly required safe reward ordering, known
categories, `capReached` agreement, and amount/type relationships. Neither
that report nor the prior exact rule/global-cap work described two valid
rule-scoped caps in one aggregate category.

`C11-CT-001` is therefore not a duplicate of prior cap arithmetic or
coherence work. It is a current false rejection created by applying the
singular amount relationship to a plural producer result.

### Root repair

Make monthly-cap telemetry rule-scoped end to end. Carry stable `ruleId` or
`capGroup` identity in each relevant `CapInfo`, and replace or remove the
ambiguous singular `CategoryReward.capAmount` in favor of explicitly plural
semantics. Validate each cap against its producing rule rather than deleting
cap validation.

Update worker and persistence decoders if the DTO changes. Add the real
`kb-all` one- and two-transaction producer-to-validator regression, plus
serialization and reoptimization coverage for multiple caps in one category.

## `RPF11-DOC-001` — reviewed source URLs are labeled issuer-official

- **Final severity:** Medium
- **Confidence:** High
- **Status:** Confirmed; unique current copy/data-contract mismatch
- **Unconditional label:** `apps/web/src/components/cards/CardDetail.svelte:143-147,268-280`
- **Syntax-only click guard:** `apps/web/src/lib/external-url.ts:1-10`;
  `packages/rules/src/security.ts:30-55`
- **Canonical provenance rule:** `packages/rules/src/schema.ts:262-285`
- **Acceptance tests:** `packages/rules/__tests__/security.test.ts:105-145`;
  `scripts/__tests__/catalog-publication.test.ts:57-88`

### Independent corpus and contract reproduction

A complete current catalog load found **26** conservative, plainly
third-party destinations that have `source: manual|web` and are rendered
under “공식 카드 페이지”:

| Destination host | Count |
|---|---:|
| `www.banksalad.com` | 15 |
| `m.card-gorilla.com` | 5 |
| `namu.wiki` | 2 |
| `www.etoday.co.kr` | 1 |
| `www.financialpost.co.kr` | 1 |
| `www.hidomin.com` | 1 |
| `www.industrynews.co.kr` | 1 |

The provenance split is **25 `manual` and one `web`**. The exact conservative
inventory is:

```text
bnk/bnk-cheongchun-check                  manual  namu.wiki
bnk/bnk-daily1-check                      manual  namu.wiki
dgb/dgb-im-skypass-silver                 manual  www.hidomin.com
ibk/ibk-ceo                               manual  m.card-gorilla.com
ibk/ibk-chamjoheun-chingu                 manual  www.banksalad.com
ibk/ibk-chamjoheun-chingu-check           manual  www.banksalad.com
ibk/ibk-daiso-chamjoheun                  manual  www.banksalad.com
ibk/ibk-easy-cashback-check               manual  www.banksalad.com
ibk/ibk-i-gihoo-donghaeng-credit          web     www.banksalad.com
ibk/ibk-i-heroes-check                    manual  www.etoday.co.kr
ibk/ibk-oil-and-life                      manual  www.banksalad.com
jb/jb-1st-link-on                         manual  m.card-gorilla.com
kb/kb-need-edu                            manual  www.financialpost.co.kr
kbank/kbank-alpha-youth-check             manual  www.industrynews.co.kr
kdb/kdb-choice-hybrid                     manual  m.card-gorilla.com
lotte/lotte-loca-for-auto                 manual  m.card-gorilla.com
lotte/lotte-loca-for-health               manual  www.banksalad.com
lotte/lotte-weekly-check                  manual  m.card-gorilla.com
nh/nh-byeoldajul                          manual  www.banksalad.com
nh/nh-olbareun-hanaro                     manual  www.banksalad.com
nh/nh-zgm-living                          manual  www.banksalad.com
samsung/samsung-and-point                 manual  www.banksalad.com
sc/sc-samsung-life                        manual  www.banksalad.com
woori/woori-d4                            manual  www.banksalad.com
woori/woori-damoa-discount-plus           manual  www.banksalad.com
woori/woori-new-woori-v                   manual  www.banksalad.com
```

The real `kb-need-edu` URL points to Financial Post. Reusing that exact card
and URL, the current canonical contract returned:

```text
source=manual      schema accepted=true   safe href retained
source=web         schema accepted=true   safe href retained
source=llm-scrape  schema accepted=false  safe href retained by syntax guard
```

`CardDetail` names the derived value `officialCardUrl` and unconditionally
labels every retained value “공식 카드 페이지.” The schema proves reviewed
provenance for `manual`/`web`; the final href guard proves only unchanged,
credential-free absolute HTTP(S) syntax. Neither proves issuer ownership.

### Historical ownership

Archived Plan 71's `C1-036` intentionally owned safe URL syntax and click-time
scheme defense. It did not establish issuer-host authenticity.

Cycle 10 `RPF10-SEC-001` proved that an untrusted model could author an
attacker HTTPS URL. Plan 122 removed `card.url` from model authority and now
rejects a non-empty URL while provenance remains `llm-scrape`. That repair is
closed at current HEAD.

This finding begins after the fixed boundary. All 26 examples are reviewed
canonical `manual`/`web` records, and current contract tests deliberately
accept arbitrary HTTP(S) hosts for those provenance values. `manual|web`
describes how facts were curated; it does not establish that `card.url` is an
issuer page. The current mismatch therefore requires a field/meaning or
issuer-host repair, not another model-quarantine change.

### Root repair

Separate issuer-verified `officialUrl` from neutral `sourceUrl`. Bind official
destinations to issuer-owned or explicitly reviewed alias hosts derived from
the issuer registry. Migrate third-party records to the neutral field and
render copy such as “상품 정보 출처,” including the destination host before
navigation.

Add complete-corpus publication validation plus component/contract tests
proving that a source URL cannot receive the official-page label and that an
official URL cannot publish without issuer-bound provenance.

## Complete raw-to-unique disposition

| Raw submission | Independent disposition | Unique aggregate treatment |
|---|---|---|
| Code reviewer `C11-CR-001` | Reproduced at helper and generic CSV boundaries | Retain once as `C11-CR-001`; adjust Medium to Low |
| Performance reviewer `RPF11-PERF-001` | Trace, operation count, real matcher timing, and equal-output differential reproduced | Retain once as Medium |
| Document specialist `RPF11-DOC-001` | Exact 26-record corpus and schema/href/UI contract reproduced | Retain once as Medium |
| Critic `C11-CT-001` | Real taxonomy/card/optimizer/web-validator scenario and one-transaction control reproduced | Retain once as Medium |
| Critic repeats of parser and matcher candidates | Confirmed but not separately counted | Merge into the owning IDs above |
| Test-engineer repeats of parser and matcher candidates | Confirmed but not separately counted | Merge into the owning IDs above |
| Debugger repeats of all four candidates | Confirmed but not separately counted | Evidence only; no fifth ID |
| Tracer repeats of all four candidates | Confirmed through downstream consumer traces but not separately counted | Evidence only; parser Medium recommendation considered and independently reduced to Low |
| Architect report | Zero new findings; cap conclusion qualified by `C11-CT-001` | No raw candidate |
| Designer report | Zero new findings | No raw candidate |
| Security report | Zero new findings; targeted trust checks remained closed | No raw candidate |

Thus the four concrete raw IDs map one-to-one to four unique retained
findings. No concrete raw ID is rejected, and repeated same-cycle
confirmations do not inflate the count.

## Focused verification

Four non-browser commands passed:

```text
parser amount/field/CSV plus web amount:       150 passed, 0 failed
categorizer plus Cycle 10 merchant boundaries: 52 passed, 0 failed
analysis coherence plus exact cap state:        57 passed, 0 failed
URL/publication/card-detail contracts:           35 passed, 0 failed
total:                                          294 passed, 0 failed
```

The green result is compatible with the four findings:

- amount tests cover each sign notation and `(-1234)`, not redundant
  Korean/trailing/full-width compositions;
- merchant tests protect boundary correctness, not edge-metadata ownership or
  cost;
- cap tests cover exact individual events and one fabricated mismatch, not a
  real producer result with two rule caps in one category; and
- URL tests intentionally accept arbitrary reviewed `manual`/`web` hosts and
  do not distinguish a source destination from an issuer-official destination.

## Closing missed-issue sweep

The closing sweep revisited:

- parser amount normalization, format dispatch, diagnostics, and refund
  admission;
- categorizer exact/substring/reverse paths, taxonomy repetition, cache churn,
  and main-thread reach;
- rule selection, cap fallback, rule/global usage, optimizer aggregation,
  worker DTOs, coherence, and persistence;
- catalog provenance, scraper quarantine, publication, external href guards,
  and card-detail copy; and
- current/archived ownership for every candidate and the previously rejected
  prefixed-XLSX hypothesis.

No fifth current defect met the combined reproduction, materiality, and
non-duplicate threshold. The Cycle 11 architect/designer/security zero-finding
reports otherwise survive this targeted verification.

Final result: **4 of 4 concrete Cycle 11 candidates confirmed, 0 rejected;
4 unique retained findings (3 Medium, 1 Low).**
