# Overall verdict

**Do not trust the current system for precise financial recommendations.** The repo has multiple system-level contract breaks across parser -> categorizer -> optimizer -> reporting, and several of them can silently produce materially wrong card recommendations rather than obvious failures.

## Scope reviewed

Repo-wide read-only systems/design review across:
- `apps/web`
- `packages/core`
- `packages/parser`
- `packages/rules`
- `packages/viz`
- `tools/cli`

Focus areas: ingest -> detection -> parsing -> categorization -> optimization -> reporting/UI, with extra attention to parser/XLSX changes, boundary contracts, invariants, and silent wrong-answer paths.

---

## Critical

### 1) The optimizer throws away transaction-level facts, so many card rules cannot be evaluated correctly

The core optimizer reduces the input to **category totals** and then rebuilds **synthetic one-row transactions** per category. That destroys the exact facts that many rule types need: per-transaction amount, merchant, online/offline, installment structure, and the original distribution of spend.

**Evidence**
- `packages/core/src/optimizer/constraints.ts:3-25` aggregates into `categorySpending: Map<string, number>` only.
- `packages/core/src/optimizer/greedy.ts:59-78` creates synthetic transactions with just category + amount.
- `packages/core/src/optimizer/greedy.ts:83-113` scores cards using those synthetic transactions.
- `packages/core/src/optimizer/greedy.ts:183-191` rebuilds synthetic transactions again for per-card results.
- `packages/core/src/calculator/reward.ts:132-151` applies transaction-sensitive logic (`minTransaction`, `excludeOnline`, `specificMerchants`, `perTransactionCap`) that the optimizer has already erased.

**Why this is systemic**
- `minTransaction` rules can be overstated or understated depending on transaction splitting.
- `perTransactionCap` is wrong when many small purchases are collapsed into one large synthetic purchase.
- `specificMerchants` cannot be evaluated once merchant names are replaced with category ids.
- `excludeOnline` cannot be evaluated once online/offline is lost.
- Category assignment itself becomes the optimization boundary, even though card rules are often transaction-level.

**Impact**
This is not a small approximation error. It invalidates the core objective function that all web and CLI recommendations depend on.

---

### 2) Reward-rule semantics are inconsistent with the data: percentage rates are treated like multipliers, and fixed-amount/unit rewards are effectively unsupported

The calculator code documents rates as decimals (`0.05` for 5%), but the rule data uses values like `1.0`, `5.0`, `10.0` to mean percentages. The calculator multiplies directly by `rate`, which produces 100x/10x errors on uncapped or lightly capped rewards.

At the same time, real rule data includes `fixedAmount` and `unit` reward modes (for example fuel benefits), but the calculation path only consumes `rate`, `monthlyCap`, and `perTransactionCap`.

**Evidence**
- Decimal-rate assumption: `packages/core/src/calculator/discount.ts:11-25`, `packages/core/src/calculator/points.ts:11-25`, `packages/core/src/calculator/cashback.ts:11-25`
- Reward calculation only uses `tierRate.rate`: `packages/core/src/calculator/reward.ts:123-176`
- Rule types omit fixed-amount semantics: `packages/rules/src/schema.ts:14-32`
- Build pipeline also models tiers around `rate` only: `scripts/build-json.ts:22-40`
- Example percentage data: `packages/rules/data/cards/shinhan/simple-plan.yaml:27-43`, `packages/rules/data/cards/shinhan/mr-life.yaml:39-150`
- Example fixed-amount fuel data: `packages/rules/data/cards/shinhan/mr-life.yaml:152-173`

**Concrete runtime symptom**
- A direct runtime check on the current calculator returns **100,000원 reward on 100,000원 spend** for `shinhan-simple-plan`'s "1%" uncapped rule.
- A direct runtime check against the current `cards.json` returns **0 reward** for `shinhan-mr-life` transportation/fuel benefit because the tier has `rate: null` and the calculator has no fixed-amount path.

**Repo-scale blast radius**
A quick data scan found:
- **2,703** `rate` entries greater than `1`
- **164** `fixedAmount` entries
- **48** `unit` entries
- **78** card files using `fixedAmount`/`unit`

This means the contract mismatch is not edge-case data; it is a dominant property of the dataset.

---

### 3) Web optimization loses parser-enriched facts before calling core, so web and CLI can disagree on the same statement

The web pipeline converts parsed transactions into `CategorizedTransaction`, but hardcodes `installments: 0` and `isOnline: false` for every row before optimization.

**Evidence**
- `apps/web/src/lib/analyzer.ts:68-82`

The CLI preserves parser-provided fields:
- `tools/cli/src/commands/optimize.ts:75-90`
- `tools/cli/src/commands/report.ts:81-96`

**Why this matters**
- Any rule using `excludeOnline` will be evaluated differently in web vs CLI.
- Any future installment-sensitive rule will already be broken in web.
- Edited/reoptimized transactions in web cannot round-trip original parse facts, so manual recategorization can silently change reward eligibility.

This is a hard parity break between the two user-facing products.

---

## High

### 4) Parser/web XLSX logic has already forked; recent XLSX changes are not implemented against one shared contract

The browser and backend XLSX parsers are now parallel implementations with materially different bank column configs and slightly different field normalization behavior.

**Evidence**
- Backend configs: `packages/parser/src/xlsx/adapters/index.ts:18-164`
- Browser configs: `apps/web/src/lib/parser/xlsx.ts:18-173`
- Backend amount parser handles parenthesized negatives: `packages/parser/src/xlsx/index.ts:74-85`
- Browser amount parser does not: `apps/web/src/lib/parser/xlsx.ts:230-238`

**Examples of config drift**
- Backend `kakao`: `merchant: '이용처', amount: '이용금액'` (`packages/parser/src/xlsx/adapters/index.ts:83-87`)
- Web `kakao`: `merchant: '가맹점명', amount: '거래금액', installments: '할부'` (`apps/web/src/lib/parser/xlsx.ts:89-94`)
- Similar drift exists for `toss`, `kbank`, `bnk`, `dgb`, `suhyup`, `jb`, `kwangju`, `jeju`, `sc`, `mg`, `cu`, `kdb`, `epost`.

**Impact**
The same XLS/XLSX export can parse into different transactions depending on whether the user uses browser or CLI. That is an architectural contract failure, not just a parser bug.

---

### 5) Raw-category fallback can emit non-canonical category ids that downstream reward rules do not understand

When keyword/taxonomy matching fails, the matcher emits a normalized bank-provided raw category string directly as the canonical category id, without checking whether it exists in the taxonomy/rules universe.

**Evidence**
- `packages/core/src/categorizer/matcher.ts:66-70`
- The test suite explicitly locks this behavior in: `packages/core/__tests__/categorizer.test.ts:180-185`

**Why this is dangerous**
If a bank category is `카페`, `대형마트`, `생활`, etc., the optimizer can receive category ids that do not correspond to rule categories such as `dining`, `grocery`, `online_shopping`, etc. That silently turns eligible spend into zero-reward spend.

---

### 6) Partial parse / fallback behavior is treated as “good enough” and still flows into recommendations

The system generally proceeds as long as it extracted *some* transactions, even when parsing emitted warnings or used degraded fallback paths.

**Evidence**
- Web only fails when transaction count is zero: `apps/web/src/lib/analyzer.ts:26-29`
- Web carries parse warnings forward but still returns `success: true`: `apps/web/src/lib/analyzer.ts:55-61`, `166-170`
- CLI optimize continues after parse warnings: `tools/cli/src/commands/optimize.ts:61-68`, `101-109`
- CLI report continues after parse warnings: `tools/cli/src/commands/report.ts:67-74`, `99-121`
- PDF parser explicitly drops from structured parse to fallback/LLM paths: `packages/parser/src/pdf/index.ts:90-125`

**Impact**
A partially parsed statement can still produce a polished optimization result with no system-level signal that the recommendation quality is degraded.

---

### 7) Important rule invariants are present in the rule model but not enforced in the reward engine

`performanceExclusions` and `minimumAnnualSpending` are loaded and displayed, but there is no evidence they are enforced in calculation/optimization.

**Evidence**
- Defined in rule types: `packages/rules/src/types.ts:39-57`
- Validated in schema: `packages/rules/src/schema.ts:49-60`
- Built into JSON/web card DTOs: `scripts/build-json.ts:64-75`, `apps/web/src/lib/cards.ts:17-35`, `77-85`
- No usage in core calculation/optimization source: repo search across `packages/core/src`, `apps/web/src`, `tools/cli/src` only finds definitions/display, not enforcement.

**Impact**
Cards whose previous-month spend should exclude tax/gift-card/loan categories can be incorrectly qualified. Annual-spend gates can also be ignored entirely.

---

## Medium

### 8) Shared contracts are being bypassed with casts instead of enforced at package boundaries

The web app relies on local hand-rolled DTOs and then casts them into rules/core types using `unknown as`, rather than sharing one canonical contract.

**Evidence**
- `apps/web/src/lib/analyzer.ts:31-36`
- `apps/web/src/lib/analyzer.ts:97-99`
- `apps/web/src/lib/cards.ts` redefines a large parallel card/rule model instead of importing the canonical one.

**Impact**
This is exactly how the XLSX drift and reward-contract drift become possible: the compiler is no longer protecting package boundaries.

---

### 9) Multi-file analysis has weak invariants and silently overwrites source metadata

When multiple files are analyzed together, the web flow merges transactions and errors but only keeps the **last non-null bank** and **last format**. It then optimizes only the latest month without checking for mixed issuers, duplicate uploads, or overlapping statement periods.

**Evidence**
- `apps/web/src/lib/analyzer.ts:113-124`
- `apps/web/src/lib/analyzer.ts:140-158`

**Impact**
Users can accidentally combine heterogeneous statements and still get one coherent-looking answer.

---

## Silent wrong-answer risks

These are the highest-probability ways the current system can produce confident-but-wrong financial advice:

1. **Uncapped percentage rewards become absurdly inflated**
   - Example: a `1.0` rule intended as 1% is computed as 100%.
   - Relevant refs: `packages/core/src/calculator/discount.ts:16-25`, `packages/rules/data/cards/shinhan/simple-plan.yaml:27-43`

2. **Fixed-amount/unit benefits score as zero**
   - Fuel / won-per-liter / flat discount programs are effectively invisible to optimization.
   - Relevant refs: `packages/core/src/calculator/reward.ts:123-176`, `packages/rules/data/cards/shinhan/mr-life.yaml:152-173`

3. **Optimizer recommends a card based on category totals that no real transaction sequence would earn**
   - Per-transaction caps and minimum-transaction thresholds are broken by category collapsing.
   - Relevant refs: `packages/core/src/optimizer/constraints.ts:8-25`, `packages/core/src/optimizer/greedy.ts:59-98`

4. **Web can recommend online-excluded cards for online spend**
   - Web hardcodes `isOnline: false` before optimization.
   - Relevant refs: `apps/web/src/lib/analyzer.ts:69-82`, `packages/core/src/calculator/reward.ts:137-139`

5. **Unknown raw bank categories silently become zero-reward categories**
   - Relevant refs: `packages/core/src/categorizer/matcher.ts:66-70`

6. **Browser and CLI can disagree on the same XLS/XLSX file**
   - Relevant refs: `packages/parser/src/xlsx/adapters/index.ts:83-163`, `apps/web/src/lib/parser/xlsx.ts:89-172`

7. **Partial/failed parses still produce final-looking recommendations**
   - Relevant refs: `apps/web/src/lib/analyzer.ts:26-29`, `tools/cli/src/commands/optimize.ts:63-68`, `tools/cli/src/commands/report.ts:69-74`

---

## What is structurally sound

A few things are directionally good:
- The repo has a clear stage decomposition (parser/core/rules/viz/web/cli).
- Categories, cards, and optimization are conceptually separated.
- The parser already records warnings/errors instead of only throwing.
- There is real test coverage for individual modules.

But the current package boundaries are **not strong enough** to guarantee correctness across the full pipeline.

---

## Recommended architectural direction

1. **Make transaction-level facts the optimizer input, not category totals.**
2. **Define one canonical reward-rule contract** that explicitly models:
   - percentage rewards
   - fixed-amount rewards
   - unit-based rewards
   - merchant constraints
   - online/offline constraints
   - exclusion logic for performance spending
3. **Unify browser and backend parsers behind shared fixtures and shared config sources**, especially XLSX.
4. **Introduce quality gates for degraded parses** so recommendations can be marked untrusted instead of silently accepted.
5. **Remove `unknown as` contract bridges** and import shared types/validators directly.

If those are not addressed, new parser/XLSX work will keep landing on top of unstable system boundaries.
