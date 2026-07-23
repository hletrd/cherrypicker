# Review-plan-fix Cycle 11 — critic

- Date: 2026-07-24
- Reviewed revision: `5a8e636c0c66136ed3fff0396de226f77758a1bd`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Mode: review only; no source, test, plan, generated-artifact, staging,
  commit, push, deployment, browser, E2E, or external-system mutation

## Outcome

The critic found **one genuinely new current-HEAD issue**:

| ID | Severity | Confidence | Status | Summary |
|---|---|---|---|---|
| C11-CT-001 | Medium | High | Confirmed | Two valid rule-level monthly caps in one category make the web coherence validator reject the optimizer's own result |

Candidate disposition:

| Candidate | Critic disposition |
|---|---|
| `C11-CR-001` | Mechanics and silent sign flip confirmed; retain as a finding, but downgrade Medium to **Low** because reach requires a redundant/malformed combination of two negative notations |
| `RPF11-PERF-001` | Confirmed at **Medium / High**; an independent same-output probe measured a **4.48x** boundary-predicate slowdown |
| Cycle 11 security pass | Accepted: no competing current security failure survived the critic's trust-boundary spot checks |

The late Cycle 11 architect and designer zero-finding reports were also read.
The designer's no-new-UI conclusion is consistent with this review. The
architect's broad boundary conclusion is qualified by C11-CT-001: its focused
coherence tests pass, but they never pass a real multi-rule cap result from the
core producer through the web validator.

## Repository inventory and duplicate control

The pinned tree contains **2,274 tracked paths**, with sorted filename-manifest
SHA-256
`8b15dbfc1093940063f141c9fb28442f628d4a333579a31b71aba87b93201ac5`.
Excluding the 1,113 tracked `.context` paths leaves **1,161 active paths**, with
manifest SHA-256
`bfa6a661e70aca250527b7efe58e91a4c655521dc861b076d6333e5af1b03b41`.

The inventory covered every application/package/tool/script/E2E/root-config
family, all current and archived plan/review families, the 683 authored card
files, and generated/public artifact families through their canonical
generation and validation boundaries. The adversarial trace revisited parser
input and diagnostics, categorization, rule selection and cap state,
optimizer aggregation, worker decoding, analysis coherence and persistence,
scraper/source trust, publication identity, CLI/report sinks, UI state and
accessibility contracts, resource bounds, and test coverage.

Historical searches found no prior report for the multi-rule-cap rejection
below. It is distinct from prior exact-cap and global-cap fixes: those preserve
individual cap arithmetic, while this failure occurs when correct per-rule
telemetry is compressed into one category field and then rejected at a
cross-package boundary. The rejected leading-NUL/prefixed-XLSX inflation
hypothesis remains rejected and was not revived.

## Candidate assessment

### `C11-CR-001` — confirmed mechanics, severity qualified

The critic independently reproduced:

```text
parseAmountString("-1000-")        => 1000
parseAmountString("마이너스-1000") => 1000
```

and a generic CSV row containing `-1000-` became a positive `1000`
transaction without a diagnostic. The root cause in
`packages/parser/src/shared/amount.ts:25-54` is correctly described: the
decorator sets negative polarity while the retained native `-` already makes
the numeric payload negative, and the final negation flips it positive.

The code report overstates practical severity. Each constituent notation is
supported, but the failing strings redundantly encode negativity twice and are
not ordinary statement amounts. This is analogous in impact and likelihood to
the previously fixed parenthesized sign-composition family, which historical
review treated as Low. Preserve the candidate as a distinct surviving syntax
case at **Low / High / Confirmed**, and fix sign normalization once in the
shared kernel rather than adding another form-specific branch.

### `RPF11-PERF-001` — confirmed

The critic verified that
`packages/core/src/categorizer/normalize.ts:16-58` recomputes immutable
first/last-character boundary metadata before attempting `indexOf` on every
term comparison. A separate 12,065-term by 1,000-merchant no-hit corpus
returned the same zero matches in both implementations:

```text
plain includes predicates:     225.1 ms median
current boundary predicates: 1,009.6 ms median
ratio:                           4.48x
```

This isolates the new constant-factor regression without relabeling the
already deferred full-scan architecture `D-C1-041`. The report's
**Medium / High / Confirmed** rating and compile-once root repair survive.

### Security pass — accepted

Spot checks found no contradiction in the security report's zero-finding
conclusion. Current scraper URL authority, SSRF redirect/DNS checks, output
writer containment, report escaping/CSP, worker decoding, upload/archive
bounds, publication validation, workflow permissions, and credential handling
remain fail closed. Known CSP/storage/PDF-LLM limitations keep their existing
provenance and were not relabeled.

## C11-CT-001 — valid multi-rule cap telemetry is rejected as incoherent

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed; genuinely new current-HEAD cross-layer failure
- **Aggregate model:** `packages/core/src/models/result.ts:13-29`
- **Rule selection and fallback:** `packages/core/src/calculator/reward.ts:248-280,450-502`
- **Lossy category aggregation:** `packages/core/src/calculator/reward.ts:719-720,930-962`
- **Rejecting validator:** `apps/web/src/lib/analysis-result.ts:288-350`
- **User-visible failure:** `apps/web/src/lib/analyzer.ts:455-459`
- **Current catalog exemplar:** `packages/rules/data/cards/kb/kb-all.yaml:36-59,109-136`
- **Missing cross-layer test:** `apps/web/__tests__/analysis-result.test.ts:435-488`

### Concrete product scenario

`kb-all` tier 1 has a supported 5% overseas online-shopping rule capped at
5,000 Won and a supported general 10% online-shopping rule capped at 10,000
Won. The conditional rule is more specific. Once it is exhausted,
`previewRuleAvailability()` skips it and the exclusive-group loop correctly
falls back to the general rule.

A read-only producer-to-validator probe used the real current taxonomy match
for `Amazon` (`online_shopping`, no subcategory), selected `kb-all`, supplied
500,000 Won previous-month spending, and analyzed two 100,000 Won overseas
Amazon purchases. The optimizer correctly produced:

```text
category reward: 15,000
category capAmount: 10,000
capsHit:
  monthly_category 5,000
  monthly_category 10,000
isAnalysisResultCoherent(...) => false
```

The first purchase exhausts the specific 5,000 Won cap. The second falls back
to and exhausts the general 10,000 Won cap. A one-purchase control produces
only the 5,000 Won cap and validates successfully.

The two-purchase optimizer result is financially and internally correct, but
`analyzeMultipleFiles()` rejects it and throws the generic “analysis totals do
not match” error before the result can be committed or shown. This is not
corrupt persisted input or a custom-rule-only edge: both rules and the card are
active, supported current catalog data, and `Amazon` is a current production
taxonomy keyword.

### Root cause

Cap tracking is correctly rule-scoped through `rewardKey`, and `capsHit` can
contain several monthly-category caps. `CategoryReward`, however, has only one
optional `capAmount`. Line 947 overwrites that field whenever another selected
rule contributes to the same category bucket. The web validator then requires
*every* monthly-category `CapInfo.capAmount` for that bucket to equal the one
last-written aggregate value. Two distinct legitimate caps cannot satisfy that
contract.

The existing web test constructs one category and one fabricated mismatching
cap, so it verifies rejection of corruption but accidentally encodes the false
assumption that a category has at most one rule cap. The focused 57-test core
cap/coherence run passed, confirming that the cross-layer producer shape is the
missing case rather than an already-covered arithmetic failure.

### Root-cause repair

Make monthly-cap telemetry rule-scoped end to end. Add stable `ruleId` or
`capGroup` identity to each relevant `CapInfo`, and either remove the singular
`CategoryReward.capAmount` or replace it with an explicit collection whose
semantics support several rules. Validate each cap against its producing rule
and retain the existing safe-integer, actual/applied, category-allocation, and
`capReached` invariants; do not merely stop validating cap amounts.

Update worker and persistence decoders if the DTO changes. Add a cross-layer
regression that feeds the current `kb-all` conditional-cap exhaustion and
general-rule fallback through `greedyOptimize()` and
`isAnalysisResultCoherent()`, plus serialization/reoptimization coverage for
multiple caps in one category.

## Rejected competing hypotheses

- The sign bug is real, but broad parser fan-out does not make redundant
  double-marker input common enough for Medium severity.
- The matcher performance result is not the pre-existing `O(N*K)` finding:
  equal-output timings isolate newly repeated boundary work. Conversely, the
  full-scan architecture remains deferred and is not counted again.
- Differently capped rules in one authored category are not alone sufficient
  to trigger C11-CT-001; transactions may land in distinct subcategory
  buckets. The reported `kb-all` case avoids that overclaim by using the real
  same-key taxonomy result and cap-exhaustion fallback.
- A possible inconsistency between singular category cap display and plural
  telemetry was not split into a second UI finding. The direct current failure
  is the validator rejecting the producer result; presentation semantics belong
  in the same root repair.
- No new evidence changes the prior prefixed-XLSX rejection.

## Verification and final missed-issue sweep

- Independently reproduced both parser sign flips and the positive generic CSV
  transaction.
- Independently reproduced the matcher's 4.48x same-output predicate
  regression.
- Reproduced C11-CT-001 through current catalog loading, real taxonomy
  matching, greedy optimization, and web coherence validation; the
  one-transaction control validated.
- `bun test apps/web/__tests__/analysis-result.test.ts
  packages/core/__tests__/cycle7-exact-reward-cap-state.test.ts` passed:
  **57 tests, 141 expectations, 0 failures**. This demonstrates the current
  producer/validator integration gap.
- The closing sweep revisited numeric/sign composition, rule/cap/global state,
  assignment and category reconciliation, worker settlement and cancellation,
  persistence provenance, catalog/trust boundaries, output sinks, resource
  bounds, UI/accessibility context, and current/archived provenance. No second
  critic-new issue cleared the evidence and deduplication threshold.

Final count: **1 new critic finding — 1 Medium (High confidence, Confirmed).**

The only path written by this critic is
`.context/reviews/2026-07-24-rpf-cycle11-critic.md`.
