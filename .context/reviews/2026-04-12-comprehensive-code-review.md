# Comprehensive code review — 2026-04-12

## Recommendation

**REQUEST CHANGES**

The repository has several high-severity correctness issues in the scoring pipeline and web runtime, plus multiple cross-file taxonomy/model mismatches that make whole classes of card benefits unreachable or mispriced.

---

## Scope and inventory

I built an explicit inventory first and reviewed all review-relevant source/config/test/doc surfaces:

- **Root/docs/config**: `README.md`, `package.json`, `tsconfig.base.json`, `turbo.json`, `.gitignore`, `.github/workflows/deploy.yml`, `playwright.config.ts`
- **Web app** (`apps/web`): Astro config, 5 pages, layout, public scripts, parser/analyzer/store/libs, Svelte components
- **Core engine** (`packages/core`): calculator, optimizer, categorizer, models, tests
- **Backend parser** (`packages/parser`): CSV/XLSX/PDF parsers, detection, tests
- **Rules package** (`packages/rules`): loader/schema/types, `categories.yaml`, `issuers.yaml`, **all 683 card YAML files**, issuer READMEs, tests
- **Visualization** (`packages/viz`): terminal/report generation + tests
- **CLI** (`tools/cli`): commands + tests
- **Scraper** (`tools/scraper`): CLI/fetch/extract/validate/write/targets + tests
- **E2E**: 2 Playwright specs + fixture

Excluded from line-by-line review as generated/vendor/state artifacts: `node_modules`, `dist` bundles, `.turbo`, `.omx`, `.omc`, etc. I **did** inspect `apps/web/dist/index.html` specifically to validate the CSP/hydration interaction.

---

## Verification and sweeps performed

- Ran **`bun run verify`** — passes
- Ran **`cd apps/web && bun run build`** — passes
- Ran **direct `bun test` at repo root** — fails because Bun discovers Playwright specs
- Ran custom full-dataset sweeps over all 683 YAML files for:
  - duplicate reward keys / ambiguous overlaps
  - taxonomy/category/subcategory mismatches
  - unsupported reward units
  - rate-shape anomalies across reward types
  - manual-editor vs taxonomy drift
- Compared browser vs backend parser surfaces for drift
- Did a final missed-issues sweep focused on CSP, swallowed errors, date inference, multi-file state consistency, unsupported reward modeling, and test/discovery overlap

---

## Detailed findings

### 1) Confirmed — High — CSP blocks Astro/Svelte hydration in production builds
**Files / regions**
- `apps/web/src/layouts/Layout.astro:38-43`
- `apps/web/dist/index.html:1,10`
- `e2e/web-regressions.spec.js:7-11`

**Why this is a problem**
The layout sets `Content-Security-Policy` to `script-src 'self'`, but the built Astro page contains inline bootstrap scripts for island hydration. Those inline scripts are not allowed by that CSP.

**Concrete failure scenario**
Open the deployed site in a real browser without CSP bypass: the static shell renders, but client islands like `FileDropzone`, dashboard widgets, and results/report Svelte components do not hydrate. The e2e suite already hints at this by forcing `bypassCSP: true` just to exercise the app.

**Suggested fix**
Either:
- add a nonce/hash-based CSP that covers Astro’s emitted inline bootstraps, or
- move CSP to headers with proper nonce injection, or
- relax `script-src` enough for Astro’s runtime and then tighten it once a compatible build/runtime path exists.

Remove the Playwright `bypassCSP` workaround after fixing this.

**Confidence**: High

---

### 2) Confirmed — High — points/mileage rates are treated as raw multipliers instead of percentages
**Files / regions**
- `packages/core/src/calculator/reward.ts:99-105,210-214`
- Example data: `packages/rules/data/cards/shinhan/point-plan-plus.yaml:31-71`
- Example data: `packages/rules/data/cards/nh/goodgame-check.yaml:31-78`

**Why this is a problem**
`normalizeRate()` divides only `discount` and `cashback` by 100. `points` and `mileage` are passed through unchanged. But the dataset stores many points/mileage rates as percentage-style values (`1.0`, `5.0`, `10.0`, etc.), not decimal fractions.

My full-dataset sweep found **633 `points` tiers** and **15 `mileage` tiers** with `rate > 1`.

**Concrete failure scenario**
For `nh-goodgame-check`, the cafe rule is `rate: 1.0` (intended 1%). On a ₩10,000 Starbucks transaction, the calculator returns **10,000 points** (100%) instead of **100 points**.

For `shinhan-point-plan-plus`, a ₩50,000 uncategorized transaction returns **35,000 points** because `0.7` is interpreted as 70%, not 0.7%.

**Suggested fix**
Unify rate semantics across the entire repo:
- either normalize `points`/`mileage` exactly like `discount`/`cashback`, or
- add an explicit schema field for rate scale/unit and migrate all rules/tests/prompt docs to match.

Right now the repo has no single consistent interpretation.

**Confidence**: High

---

### 3) Confirmed — High — ambiguous duplicate reward rules are collapsed to the first matching rule
**Files / regions**
- `packages/core/src/calculator/reward.ts:32-34,53-73,205-225`
- Example: `packages/rules/data/cards/shinhan/point-plan-plus.yaml:31-71`
- Example: `packages/rules/data/cards/hana/daltal-sweet.yaml:31-79`
- Example: `packages/rules/data/cards/shinhan/simple-plan.yaml:27-43`

**Why this is a problem**
`findRule()` picks a **single** candidate based only on structural specificity (category/subcategory/specificMerchants/excludeOnline/minTransaction). When multiple rules share the same category key and lack machine-readable distinguishing conditions, later rules become unreachable.

My dataset sweep found:
- **91 cards** with duplicate `(category, subcategory)` reward keys
- **44 cards** where those duplicates are **ambiguous** under the current matching model

**Concrete failure scenarios**
- `shinhan-point-plan-plus` has **five** `uncategorized` point bands for different amount ranges, but no machine-readable amount-range condition. Every uncategorized transaction uses the first `0.7` rule.
- `hana-daltal-sweet` has four separate `dining` rules (restaurant/daytime, delivery, coffee, bakery) without subcategories or conditions. The engine cannot distinguish them and just picks the first rule.
- `shinhan-simple-plan` has two `uncategorized` rules for domestic 1% vs overseas 2%, but nothing in the transaction model or rule conditions distinguishes them.

**Suggested fix**
Extend the schema and matching engine with machine-readable conditions for:
- min/max transaction bands
- time-of-day / weekday / weekend
- domestic vs overseas
- channel / merchant subsets / service-specific flags

Then fail validation/build on ambiguous overlapping rules instead of accepting them silently.

**Confidence**: High

---

### 4) Confirmed — High — previous-month spending ignores `performanceExclusions`, so tiers are overqualified
**Files / regions**
- `apps/web/src/lib/analyzer.ts:93-99,137-162`
- `packages/core/src/calculator/reward.ts:155-161`
- Example card: `packages/rules/data/cards/ibk/i-green.yaml:30-34`

**Why this is a problem**
The analyzer computes prior-month spend as a raw monthly total and passes that directly into the calculator. But card rules explicitly define `performanceExclusions`, and the calculator never uses them.

So excluded spend still upgrades the user into higher benefit tiers.

**Concrete failure scenario**
If the user’s previous month was mostly apartment management fees, taxes, or gift-card purchases, `ibk-i-green` (and many other cards) will still be scored at tier1/tier2 even though those categories are supposed to be excluded from qualifying spend.

**Suggested fix**
Compute **per-card qualifying previous-month spend** from prior-month transactions after applying each card’s exclusion list. If historical transaction detail is unavailable, the UI/CLI input should explicitly ask for *qualifying* spend, not total spend.

**Confidence**: High

---

### 5) Confirmed — High — upload flow shows success and redirects even when analysis failed
**Files / regions**
- `apps/web/src/components/upload/FileDropzone.svelte:169-188`
- `apps/web/src/lib/store.svelte.ts:190-205`

**Why this is a problem**
`analysisStore.analyze()` catches its own errors, sets `error` in store state, and does **not rethrow**. `FileDropzone.handleUpload()` awaits it inside `try`, then unconditionally marks the upload as success and redirects.

**Concrete failure scenario**
Upload an empty/invalid statement. `analysisStore.analyze()` sets `result = null` and records the error internally, but `handleUpload()` still sets `uploadStatus = 'success'` and navigates to `/dashboard`. The user gets a success animation followed by a broken/no-result dashboard instead of the actual parsing error.

**Suggested fix**
Make `analyze()` either:
- rethrow after updating the store, or
- return an explicit `{ ok, error, result }` outcome.

Only show success and redirect when a non-null result exists.

**Confidence**: High

---

### 6) Confirmed — Medium — manual recategorization writes subcategory IDs into `category`, breaking reward matching
**Files / regions**
- `apps/web/src/components/dashboard/TransactionReview.svelte:9-50,151-156,263-273`
- `packages/core/src/calculator/reward.ts:63-69`

**Why this is a problem**
The manual editor dropdown mixes top-level IDs (`dining`) and subcategory IDs (`cafe`, `taxi`, `hotel`, etc.) in one list. But `changeCategory()` only sets `tx.category = newCategory`; it never updates `tx.subcategory`.

The optimizer/calculator expect canonical pairs like `{ category: 'dining', subcategory: 'cafe' }`, not `{ category: 'cafe' }`.

**Concrete failure scenario**
A user fixes Starbucks from `uncategorized` to `cafe`. The transaction becomes `{ category: 'cafe', subcategory: undefined }`. A rule like `{ category: 'dining', subcategory: 'cafe' }` no longer matches, so the corrected transaction can still get zero reward.

**Suggested fix**
Drive the editor from the taxonomy and write canonical `(category, subcategory)` pairs. The UI should expose top-level/subcategory structure explicitly instead of stuffing both into one raw ID field.

**Confidence**: High

---

### 7) Confirmed — Medium — taxonomy drift makes many rule entries unreachable at runtime
**Files / regions**
- `tools/scraper/src/prompts/system.ts:46-84`
- `packages/rules/data/categories.yaml:1-220+`
- `apps/web/src/components/dashboard/TransactionReview.svelte:9-50`
- Example rules:
  - `packages/rules/data/cards/samsung/id-ev.yaml:35-47`
  - `packages/rules/data/cards/kbank/alpha-youth-check.yaml:36-48`
  - `packages/rules/data/cards/woori/hyundai-rental.yaml:34-53`
  - `packages/rules/data/cards/ibk/i-green.yaml:36-77`
  - `packages/rules/data/cards/nh/goodgame-check.yaml:31-50`

**Why this is a problem**
The scraper prompt/taxonomy/editor are not aligned with the runtime taxonomy. The repo already contains many rewards using categories/subcategories that the matcher and manual editor can never emit.

My sweep found:
- **31 rewards** using unknown categories
- **35 rewards** using invalid subcategory pairs
- **57 affected card files** total

Examples include `ev_charging`, `health.beauty`, `rental`, `entertainment.gaming`, `travel.overseas`, `transportation.shared_mobility`.

**Concrete failure scenario**
EV charging rewards on `samsung-id-ev` or gaming rewards on `nh-goodgame-check` can never be matched from parsed transactions or selected manually in the dashboard, so those benefits are effectively dead code in the recommendation engine.

**Suggested fix**
Establish one canonical taxonomy source and validate all card rules against it at build time. The manual editor should be generated from that taxonomy, not hardcoded.

**Confidence**: High

---

### 8) Confirmed — Medium — dashboard mixes all-month metadata with latest-month optimization data, and refunds inflate qualifying spend
**Files / regions**
- `apps/web/src/lib/analyzer.ts:117-183`
- `apps/web/src/components/dashboard/SpendingSummary.svelte:49-60,71-100`
- `apps/web/src/components/dashboard/CategoryBreakdown.svelte:65-72`

**Why this is a problem**
`analyzeMultipleFiles()` merges all uploaded transactions, but optimization only uses the **latest month**. The dashboard then mixes:
- `transactionCount` / `statementPeriod` from **all months**
- `optimization.totalSpending` / `assignments` from **latest month only**

On top of that, monthly spend is aggregated with `Math.abs(tx.amount)`, so refunds/charge reversals increase spend instead of reducing it.

**Concrete failure scenario**
Upload January and February statements. The dashboard says “200건, 2026-01 ~ 2026-02”, but “총 지출” and category breakdown only reflect February. A -₩100,000 refund in January is counted as +₩100,000 toward previous-month qualification.

**Suggested fix**
Make all dashboard cards use the same scope, or explicitly separate “uploaded period summary” vs “optimized month summary”. Stop using `Math.abs()` for qualifying spend unless the card’s rules explicitly justify it.

**Confidence**: High

---

### 9) Confirmed — Medium — short date parsing assumes the current year and corrupts year-boundary statements
**Files / regions**
- `packages/parser/src/csv/generic.ts:56-67`
- `packages/parser/src/xlsx/index.ts:62-67`
- `apps/web/src/lib/parser/csv.ts:40-56`
- `apps/web/src/lib/parser/xlsx.ts:215-220`

**Why this is a problem**
For dates like `12/31` or `1월 15일`, the parser uses `new Date().getFullYear()` instead of inferring the statement year.

**Concrete failure scenario**
If a user parses a December 2025 statement on April 12, 2026, `12/31` becomes `2026-12-31`. That breaks chronological ordering, monthly breakdowns, and prior-month qualification.

**Suggested fix**
Infer the year from statement headers, neighboring full dates, or file context. Only use the current year as a last resort, and surface a warning when doing so.

**Confidence**: High

---

### 10) Confirmed — Medium — `ilp` optimization is advertised but silently falls back to greedy
**Files / regions**
- `packages/core/src/optimizer/index.ts:12-35`
- `packages/core/src/optimizer/ilp.ts:1-49`

**Why this is a problem**
The public API exposes `method: 'ilp'`, and comments describe an “optimal ILP optimizer”, but the implementation simply returns `greedyOptimize()`.

**Concrete failure scenario**
A caller requests ILP expecting an exact optimum for comparison or auditability. The system silently returns the heuristic path and can still miss the optimal assignment.

**Suggested fix**
Until ILP exists, either throw an unsupported-method error or remove/rename the option so callers are not misled.

**Confidence**: High

---

### 11) Likely issue — Medium — browser CSV support is overstated relative to the implemented/tested adapter set
**Files / regions**
- `apps/web/src/components/upload/FileDropzone.svelte:71-96`
- `apps/web/src/lib/parser/types.ts:1-41`
- `apps/web/src/lib/parser/csv.ts:216-880`
- `packages/parser/src/csv/index.ts:16-27`
- `packages/parser/__tests__/csv.test.ts`

**Why this is a problem**
The product surface advertises/accepts 24 bank IDs, but dedicated CSV adapters and regression tests exist for only about 10 issuers. The rest silently fall back to the generic parser.

**Concrete failure scenario**
A BNK/KDB/우체국 CSV export with issuer-specific column ordering or quoting quirks appears supported in the UI, but the browser parser uses the generic inference path and may silently misparse merchant/amount/date columns.

**Suggested fix**
Either narrow the claimed CSV support matrix or add dedicated browser/CLI fixtures and parsers for the remaining issuers.

**Confidence**: Medium

---

### 12) Confirmed limitation with user-visible impact — Medium — unit-based fuel/mileage rewards are loaded but mostly ignored
**Files / regions**
- `packages/core/src/calculator/reward.ts:125-152`
- Example: `packages/rules/data/cards/lotte/digiloca-auto.yaml:34-60`

**Why this is a problem**
The calculator only implements `won_per_day` and `mile_per_1500won`. Rewards with units like `won_per_liter` and `miles` return 0 because the transaction model lacks liters/accrual basis.

My sweep found **18 affected cards / 39 affected tiers**.

**Concrete failure scenario**
`lotte-digiloca-auto` has fuel cashback of `100~150 won_per_liter`, but the optimizer scores those rewards as zero. Fuel-focused cards are therefore systematically undervalued or never recommended.

**Suggested fix**
Either:
- add the missing transaction metadata/modeling needed to price those rewards, or
- explicitly mark those rewards/cards as unsupported and exclude them from rankings instead of silently zeroing them.

**Confidence**: High

---

### 13) Confirmed — Low — documentation and repository state are inconsistent
**Files / regions**
- `README.md:12,27,37,79,82,96-99`
- `package.json:18-23`
- `packages/rules/data/cards/**` (683 YAML files)

**Why this is a problem**
The README simultaneously claims:
- 683 cards
- 561 card rules
- TypeScript 6

But the repo currently contains **683 YAML card files** and `package.json` pins **TypeScript `^5.9.3`**.

**Concrete failure scenario**
Contributors relying on the README will audit the wrong dataset size and toolchain assumptions.

**Suggested fix**
Generate or validate README stats from `cards.json` / workspace manifests in CI so docs drift is caught automatically.

**Confidence**: High

---

### 14) Confirmed — Low — direct `bun test` at repo root is broken because Bun discovers Playwright specs
**Files / regions**
- `e2e/core-regressions.spec.js:15-25`
- `e2e/web-regressions.spec.js:7-11`
- root direct `bun test` behavior

**Why this is a problem**
Bun’s default test discovery picks up the Playwright specs and runs them outside Playwright, causing top-level hook/config errors.

**Concrete failure scenario**
A developer runs `bun test` from the repo root and gets failures like “Playwright Test did not expect test.beforeAll()/test.describe.configure() to be called here”, even though the actual verified path (`bun run verify`) passes.

**Suggested fix**
Separate unit/e2e discovery patterns (rename e2e specs, configure Bun exclusions, or only place Playwright specs under a Playwright-specific glob).

**Confidence**: High

---

## Final missed-issues sweep

After the main review, I ran a final sweep specifically for commonly missed classes of issues:

- **Cross-file model drift**: taxonomy vs scraper prompt vs UI editor vs rule dataset
- **Silent failure paths**: swallowed exceptions and fallback behavior
- **Temporal bugs**: current-year date assumptions
- **State-consistency bugs**: multi-file analysis scope mixing, refund handling, redirect-on-failure
- **Algorithmic correctness**: duplicate reward-key ambiguity, fake ILP mode, reward-type normalization
- **Coverage gaps**: advertised bank support vs tested/implemented parser adapters
- **Deployment/runtime mismatches**: CSP vs emitted inline scripts
- **Docs/tests drift**: README stats, root `bun test` behavior

I did **not** find evidence that relevant source/config/test/doc areas were skipped from the inventory above. Generated/vendor/state artifacts were excluded deliberately, except where a generated build artifact (`apps/web/dist/index.html`) was necessary to confirm a source-level runtime bug.

