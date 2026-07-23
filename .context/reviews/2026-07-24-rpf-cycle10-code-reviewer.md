# Cycle 10 Code Reviewer Report

- Date: 2026-07-24
- Reviewed commit: `56c0f1f`
- Role: code quality, logic, SOLID, correctness, and maintainability
- Outcome: three new confirmed correctness findings; no source or test files changed

## Review inventory and method

I indexed all 2,252 tracked files with `git ls-files`, classified every implementation, configuration, test, fixture, generated-data, documentation, and review-provenance surface, and then traced the executable paths and cross-package contracts. The review inventory was:

| Surface | Tracked inventory | Examination |
| --- | ---: | --- |
| Root policy/build/deploy | root manifests and TypeScript/Bun config, `.claude/**`, `.github/workflows/deploy.yml`, `README.md`, `VENDOR.md` | Read for repository contracts, commands, publication rules, and deployment assumptions. |
| `apps/web` | 167 files; 136 code/template/style files; 54 test/fixture files | Traced upload → analysis → optimization → persistence → reoptimization → disclosure/UI paths, including worker/runtime cancellation and public-catalog consumers. |
| `packages/core` | 39 files; 37 TypeScript files; 11 tests | Read categorization, normalization, analysis context/performance, reward calculation, caps, constraints, greedy optimization, result models, and numeric invariants. |
| `packages/parser` | 86 files; 64 code files; 49 test/fixture files | Reviewed shared validation/detection boundaries and every parser family through its implementation, fixtures, and format-specific regression coverage. |
| `packages/rules` | 733 files; 20 TypeScript files; 6 tests | Read schema/loaders/semantic and catalog validation. Treated the 685 YAML records, 2 generated JSON catalogs, and 24 generated/readme artifacts as one pipeline-owned corpus: checked generators, schemas, validators, aggregate searches, and representative rule records rather than assuming generated output was inert. |
| `packages/viz` | 14 files; 12 code files; 3 tests | Reviewed chart/model transformations, escaping, and renderer boundaries. |
| `tools/cli` | 28 files; 26 code files; 10 tests | Traced argument validation, file parsing, selection, compiled-catalog loading, and report output. |
| `tools/scraper` | 35 files; 23 code files; 11 test/fixture files | Reviewed fetch/parse/quarantine/publication behavior and artifact boundaries. |
| `scripts` | 19 code files; 8 tests | Reviewed all catalog generation, synchronization, validation, and documentation publication scripts. |
| `e2e` | 16 files; 12 code files; 14 spec/fixture/config files | Checked browser-level coverage against the reviewed web flows. |
| Historical provenance | 1,096 tracked `.context` files | Indexed all provenance for duplicate/rejected-topic searches; fully read the Cycle 9 aggregate and Plans 114–119, then opened relevant historical hits when a candidate overlapped an older topic. |

The duplicate ledger excluded all closed Cycle 9 findings. In particular, this review does **not** revive the rejected prefixed/leading-NUL XLSX inflation hypothesis: the non-PK input still follows the plaintext/PRN path and the earlier reproduction did not yield ZIP expansion. Historical acknowledged performance-only topics were also not promoted without a new correctness failure.

## Findings

### C10-CR-001 — Short ASCII category aliases match inside unrelated merchant words and can award real card benefits

- Severity: Medium
- Confidence: High
- Status: Confirmed; new at `56c0f1f`

`MerchantMatcher` adds every normalized keyword of length two or greater to its substring index at `packages/core/src/categorizer/matcher.ts:160` and accepts either `lower.includes(kw)` or the reverse containment at `packages/core/src/categorizer/matcher.ts:239`. The independent taxonomy matcher repeats unrestricted containment at `packages/core/src/categorizer/taxonomy.ts:166`. The production keyword corpus contains short Latin aliases such as `cu`, `skt`, and `kt` at `packages/core/src/categorizer/keywords.ts:432`, `packages/core/src/categorizer/keywords.ts:1048`, and `packages/core/src/categorizer/keywords.ts:1050`.

This is not Cycle 9's fixed merchant-allowlist issue. Cycle 9 added boundaries to the reward allowlist matcher, while the canonical category matcher still has the same lexical defect. Generic category rules then trust the inferred category at `packages/core/src/calculator/reward.ts:418`; they do not pass through an allowlist. For example, BC 바로 클리어 플러스 has a generic 10% `convenience_store` rule at `packages/rules/data/cards/bc/baro-clear-plus.yaml:108`.

Concrete reproduction:

- `"SECURITY SERVICE"` is classified as `convenience_store` with confidence `0.8` because `security` contains `cu`.
- With BC 바로 클리어 플러스, a ₩10,000 transaction and ₩300,000 prior spending, `calculateRewards` returns ₩1,000 for that unrelated merchant.
- The same probe classified `"CULTURE CENTER"` as `convenience_store`, and `"SKTECH"` / `"BOOKTOWN"` as `telecom`.

This can turn an innocent substring collision into a false card recommendation and a displayed reward amount.

Recommended fix: extract one shared normalized merchant-term predicate with token/character boundaries for short ASCII terms, and use it in the static matcher, taxonomy matcher, and merchant allowlists. Preserve exact matches and the intended Korean substring behavior. Add end-to-end categorization-plus-calculation tests for every short ASCII keyword against near-collision words, not only direct matcher tests.

### C10-CR-002 — Alternative counterfactuals bypass canonical transaction ordering under stateful reward rules

- Severity: Medium
- Confidence: High
- Status: Confirmed; new cross-fix interaction at `56c0f1f`

Cycle 9 correctly introduced the reward-fact comparator at `packages/core/src/optimizer/greedy.ts:108` and applies it to the main optimizer input at `packages/core/src/optimizer/greedy.ts:483`. However, grouped alternative construction calls `calculateCardOutput([...actualTransactions, ...groupTransactions], ...)` without re-sorting at `packages/core/src/optimizer/greedy.ts:337`. That makes the hypothetical calculation use “all transactions already won by the candidate, then the proposed group” rather than the canonical order required by the calculator's stateful semantics.

Confirmed scenario:

- Winner card: 20% dining.
- Candidate card: 10% wildcard with `maxUses: 1` per month.
- Same-date transactions: ₩10,000 dining and ₩5,000 telecom.
- The main canonical run assigns dining to the winner for ₩2,000 and telecom to the candidate for ₩500.
- While building dining's alternatives, the current append order evaluates candidate transactions as `[telecom, dining]`; the use is already consumed, so `after - before` is zero and the candidate is omitted.
- Sorting the merged hypothetical input with `compareRewardRelevantTransactions` produces `[dining, telecom]`; candidate reward changes from ₩500 to ₩1,000, so the real incremental alternative is ₩500.

The existing Cycle 6 alternative tests all pass because they check whole-group state but do not insert a hypothetical group before a candidate's already-won transactions. The Cycle 9 determinism tests cover the main path, not this counterfactual path. Similar errors are possible with fixed-per-day rewards, category/global caps, and other order-sensitive limits. A canonical insertion can also make a signed delta non-positive, so simply sorting while retaining the nonnegative assertion at `packages/core/src/optimizer/greedy.ts:353` is not sufficient.

Recommended fix: centralize canonical reward-input construction and use it for both final card totals and every alternative counterfactual. Compute the signed safe-integer delta, discard deltas `<= 0`, and only then construct a displayed alternative. Add tests with a candidate's existing transactions on both sides of the hypothetical group for `maxUses`, fixed-per-day rewards, monthly-category caps, and global caps.

### C10-CR-003 — Current-version persistence accepts snapshots with no previous-spending provenance

- Severity: Medium
- Confidence: High
- Status: Confirmed; new at `56c0f1f`

Every current analysis producer constructs a basis: `buildAnalysisContext` always selects `user-total`, `statement-month`, or `missing-calendar-month` at `packages/core/src/analysis/context.ts:101`; the analyzer stores it at `apps/web/src/lib/analyzer.ts:430`; and reoptimization stores the refreshed value at `apps/web/src/lib/store.svelte.ts:406`. Nevertheless, `AnalysisResult.previousSpendingBasis` remains optional at `apps/web/src/lib/analysis-result.ts:80`, and coherence only checks the basis when it happens to exist at `apps/web/src/lib/analysis-result.ts:650`.

The current payload shape does not require this field at `apps/web/src/lib/persistence.ts:413`. Deserialization rejects a malformed present basis but accepts an absent one at `apps/web/src/lib/persistence.ts:749`, then reconstructs `previousSpendingBasis: undefined` at `apps/web/src/lib/persistence.ts:759`. This is not needed for legacy compatibility: migrated versions are deliberately rejected after semantic validation at `apps/web/src/lib/persistence.ts:797`.

A coherent `_v: 4` payload with the basis removed deserializes successfully with:

```text
accepted=true, warningKind=null, shouldRemove=false, previousSpendingBasis=undefined
```

If both `previousSpendingBasis` and its redundant `previousMonthSpendingOption` are lost from a user-total snapshot, all reward totals still pass coherence, the disclosure disappears because `describePreviousSpendingBasis` returns `null` at `apps/web/src/lib/analysis-disclosures.ts:50`, and the next edit/reoptimization falls back to statement-derived spending at `apps/web/src/lib/store.svelte.ts:356`. Thus one accepted current-version snapshot can silently change the performance tier used for later recommendations.

Recommended fix: make `previousSpendingBasis` mandatory for a coherent current `AnalysisResult` and current persisted payload. Require `previousMonthSpendingOption` to agree exactly with `user-total` (and be absent for the other basis kinds), while leaving any legacy conversion strictly inside migrations. Add deletion tests for the basis alone and for coordinated deletion of both provenance fields, plus a reload-then-reoptimize regression test.

## Verification and final missed-case sweep

Focused existing regressions remained green:

```text
bun test packages/core/__tests__/cycle6-optimizer-alternatives.test.ts \
  packages/core/__tests__/cycle9-calculation-determinism.test.ts \
  apps/web/__tests__/analysis-result.test.ts \
  apps/web/__tests__/store-persistence.test.ts

154 pass, 0 fail
```

I then repeated repository-wide searches and cross-file checks for unsafe numeric accumulation, order-sensitive state, ambiguous category/card identity, date/month derivation, parser detection and decompression boundaries, async worker lifecycle, persistence schema/provenance, generated catalog drift, CLI/web catalog divergence, escaping, stale documentation claims, and missing integration coverage. No other candidate met the bar for a new, reproducible finding after comparison with the historical review ledger.
