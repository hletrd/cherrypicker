# Remediation plan

## Goal

Turn the review findings into a practical recovery sequence that restores:
1. **correctness** of financial recommendations,
2. **safety/privacy** for statement handling,
3. **parity** between web and CLI,
4. **release confidence** via real verification gates.

---

## Progress tracker

- Phase 0 — Stop-ship guardrails: **in progress** (automatic remote PDF fallback disabled by default, browser AI runtime disabled, README/license baseline corrected)
- Phase 1 — Repair the rule/data contract: **in progress** (runtime schema preserves `fixedAmount` / `unit` / `subcategory`, accepts current `web` / `prepaid` metadata, and `build-json` runs under Node; category taxonomy cleanup is still pending)
- Phase 2 — Make the calculator correct on real rules: **in progress** (discount/cashback percentage rates normalize correctly, explicit fixed rewards are preserved, and unsupported unit semantics stay explicit instead of silently collapsing)
- Phase 3 — Replace category-total optimization with transaction-aware optimization: **in progress** (optimizer constraints now preserve real transactions and greedy scoring is moving to marginal per-transaction assignment)
- Phase 4 — Unify parser logic and restore web/CLI parity: **in progress** (bank signatures tightened, browser/backend XLSX configs aligned for newer banks, malformed amounts surface as errors instead of silently dropping rows)
- Phase 5 — Security hardening: **pending**
- Phase 6 — Release discipline / tooling cleanup: **in progress** (deploy now gates on repo verification; npm lint/typecheck pass locally, Bun-backed test execution still needs full runtime verification)

## Executive recommendation

**Do not ship recommendation-critical or parser-heavy changes until Phases 0-3 are complete.**

The repo currently has two classes of failures:
- **wrong-answer risk**: the engine can produce confident but incorrect recommendations
- **trust-boundary risk**: sensitive statement data can leave the machine or be exposed to third-party runtime code

That means the correct order is:
1. stop the unsafe/wrong behavior,
2. repair the contracts,
3. unify duplicated logic,
4. only then expand parser coverage and feature scope.

---

## Phase 0 — Stop-ship guardrails

**Priority:** immediate

### Actions

1. **Add a clear stop-ship note to the project tracker / release checklist**
   - Recommendation outputs should be treated as **experimental** until Phase 3 completes.

2. **Disable or hard-gate remote PDF fallback**
   - Files:
     - `packages/parser/src/pdf/index.ts`
     - `packages/parser/src/pdf/llm-fallback.ts`
   - Change behavior from automatic fallback to one of:
     - explicit opt-in CLI flag, or
     - fully disabled by default.

3. **Temporarily remove or disable browser AI categorizer runtime imports if they cannot be bundled safely**
   - Files:
     - `apps/web/src/lib/categorizer-ai.ts`
     - `apps/web/src/layouts/Layout.astro`
   - If that is too large for one step, hide it behind a feature flag and default it off.

4. **Fix the README/license mismatch immediately**
   - Files:
     - `README.md`
     - `LICENSE`

### Exit criteria
- No automatic statement-text exfiltration path remains.
- Public docs do not make privacy/licensing claims known to be false.

---

## Phase 1 — Repair the rule/data contract

**Priority:** highest

This is the foundation. Do this before trying to “improve the optimizer” or “fix parser accuracy.”

### Problems being fixed
- `rate` semantics are inconsistent with the dataset.
- `fixedAmount` / `unit` rewards are not modeled correctly.
- `subcategory` is missing from the runtime contract.
- duplicate reward-category rules cannot be resolved correctly.

### Actions

1. **Define one canonical reward contract**
   - Files:
     - `packages/rules/src/types.ts`
     - `packages/rules/src/schema.ts`
     - `scripts/build-json.ts`
     - `apps/web/src/lib/cards.ts`
   - Decide and encode support for:
     - percentage rewards,
     - fixed-amount rewards,
     - unit-based rewards,
     - subcategory-specific rules,
     - merchant-conditional rules.

2. **Normalize rate semantics explicitly**
   - Decide whether stored percentages are:
     - `10` meaning `10%`, or
     - `0.10` meaning `10%`
   - Enforce one representation in schema and generator.
   - Add migration/normalization for existing YAML.

3. **Add `subcategory` to reward rules and matching**
   - Files:
     - `packages/rules/src/types.ts`
     - `packages/rules/src/schema.ts`
     - `packages/core/src/calculator/reward.ts`
     - `packages/core/src/optimizer/constraints.ts`
     - `packages/core/src/categorizer/matcher.ts`

4. **Decide how duplicate category rules should be represented**
   - Replace ambiguous “same category twice” patterns with explicit structure:
     - category + subcategory,
     - category + merchant constraints,
     - category + time/channel constraints,
     - or structured priority rules.

5. **Make unknown category IDs a hard validation failure**
   - Files:
     - `tools/scraper/src/validators.ts`
     - `packages/rules/src/schema.ts`
     - `scripts/build-json.ts`
   - Stop warning-only acceptance of semantically invalid category IDs.

### Verification
- Add schema tests proving:
  - fixed/unit rewards survive parsing,
  - subcategory survives parsing,
  - invalid category IDs fail,
  - rate semantics are deterministic.

### Progress notes
- 2026-04-12: `packages/rules` now preserves `fixedAmount`, `unit`, `subcategory`, reward labels, and notes instead of stripping or coercing them away.
- 2026-04-12: `scripts/build-json.ts` now runs via `node --experimental-strip-types`, which removes the Bun-only runtime dependency for this data-generation lane.
- 2026-04-12: rule loading / generated JSON now accept the repo's current `card.source=web` data and the single `prepaid` card instead of silently dropping most of the catalog.
- 2026-04-12: runtime schema no longer diverges from the generated catalog over optional/blank card URLs.
- 2026-04-12: calculator/optimizer correctness is **not fixed yet**; the current calculation path still treats `rate ?? 0` as a temporary compatibility fallback until Phase 2 lands.

### Exit criteria
- A card rule loaded from YAML preserves all benefit semantics needed for calculation.
- `cards.json` faithfully represents the source YAML without silent semantic loss.

---

## Phase 2 — Make the calculator correct on real rules

**Priority:** highest

### Progress notes
- 2026-04-12: calculator now normalizes percentage-style discount/cashback rates instead of treating them as raw multipliers.
- 2026-04-12: fixed-amount rewards and subcategory-specific rules are evaluated before falling back to broader category logic.
- 2026-04-12: unsupported unit semantics remain explicit rather than silently fabricating quantity data.

### Problems being fixed
- reward calculator ignores parts of the rule model,
- cap reporting is questionable,
- current tests protect existing behavior, not correct behavior.

### Actions

1. **Rewrite calculator paths around the new reward contract**
   - Files:
     - `packages/core/src/calculator/reward.ts`
     - `packages/core/src/calculator/discount.ts`
     - `packages/core/src/calculator/points.ts`
     - `packages/core/src/calculator/cashback.ts`
     - possibly add new calculators / reward-mode helpers

2. **Implement support for**
   - percentage rules,
   - fixed-amount rules,
   - unit-based rules,
   - per-transaction caps,
   - category caps,
   - global caps,
   - merchant constraints,
   - online/offline constraints,
   - subcategory-specific matching.

3. **Fix cap accounting / reporting**
   - Validate `capsHit` semantics against expected over-cap behavior.

4. **Replace ambiguous calculator tests with business-truth tests**
   - Files:
     - `packages/core/__tests__/calculator.test.ts`
   - Add golden tests using real YAML cards that currently fail under the old contract.

### Verification
Minimum regression set should include:
- `shinhan/simple-plan`
- `shinhan/mr-life`
- one unit-based fuel card
- one fixed-amount card
- one card with duplicate-category semantics today that must become explicit after migration

### Exit criteria
- The calculator gives correct rewards for representative real cards across all supported reward modes.

### Progress notes
- 2026-04-12: discount/cashback rates now treat `1`, `5`, `10` as percentages instead of raw multipliers.
- 2026-04-12: calculator now applies flat fixed-amount rewards and subcategory-aware rule matching on real transactions.
- 2026-04-12: unsupported unit semantics (notably `won_per_liter`) still need explicit treatment before Phase 2 can be considered complete.

---

## Phase 3 — Replace category-total optimization with transaction-aware optimization

**Priority:** highest

### Progress notes
- 2026-04-12: optimizer constraints now preserve the original transaction list so scoring can use merchant/subcategory/channel facts instead of synthetic category totals.
- 2026-04-12: greedy scoring is being shifted to marginal per-transaction assignment; reporting still needs final cleanup once the full lane lands.

### Problems being fixed
- optimizer currently destroys transaction-level facts,
- rules depending on per-transaction or merchant/channel facts are impossible to optimize correctly.

### Actions

1. **Redefine optimizer input around real transactions, not category totals**
   - Files:
     - `packages/core/src/optimizer/constraints.ts`
     - `packages/core/src/optimizer/greedy.ts`
     - `packages/core/src/optimizer/index.ts`
     - `packages/core/src/models/*`

2. **Preserve and use transaction-level fields**
   - category
   - subcategory
   - merchant
   - amount
   - online/offline
   - installments
   - date/time if needed for time-window benefits

3. **Be explicit about optimizer scope**
   - If `greedy` is approximate, document that clearly.
   - If `ilp` is still a stub, stop marketing it as a real alternative.

4. **Add optimizer-vs-ground-truth tests**
   - Cases where category-total collapse used to be wrong:
     - per-transaction cap,
     - merchant allowlist,
     - online exclusion,
     - minimum transaction thresholds.

### Verification
- A fixture set where the old optimizer and new optimizer differ should now match the real calculator outcome.

### Exit criteria
- Optimization is performed on data rich enough to respect the supported rule model.
- “Best card” output is no longer built on fake synthetic transactions.

---

## Phase 4 — Unify parser logic and restore web/CLI parity

**Priority:** high

### Progress notes
- 2026-04-12: parser hardening now rejects the noisiest bank-signature false positives (`토스`, `CU`, `MG`, `JB`-style merchant text) instead of treating them as bank headers.
- 2026-04-12: browser/backend XLSX configs for the newer banks have been realigned, and malformed amount cells are surfaced as errors instead of being silently dropped as zero-value rows.

### Problems being fixed
- browser and package parsers have forked,
- bank detection is duplicated,
- XLSX configs drifted,
- parser fixes must be applied twice.

### Actions

1. **Choose one authoritative parser core**
   - Preferred: shared pure parsing modules in `packages/parser` with thin wrappers for:
     - Node/Bun file I/O
     - browser `File` / `ArrayBuffer`

2. **Delete duplicated bank signature / type / adapter definitions from web**
   - Files likely affected:
     - `apps/web/src/lib/parser/detect.ts`
     - `apps/web/src/lib/parser/types.ts`
     - `apps/web/src/lib/parser/xlsx.ts`
     - `apps/web/src/lib/parser/csv.ts`
     - `apps/web/src/lib/parser/pdf.ts`

3. **Narrow bank signatures**
   - Remove weak abbreviations unless paired with statement-only context.
   - Add confidence thresholds and validation against headers.

4. **Fix row-dropping semantics**
   - Distinguish:
     - parse failure,
     - legitimate zero amount,
     - fee column / alternate amount column,
     - summary rows.
   - Do not silently skip malformed rows.

5. **Preserve parser-enriched facts end-to-end**
   - `isOnline`
   - `installments`
   - parser warnings/errors
   - statement metadata

### Verification
- Golden parity tests: same fixture, same output in browser wrapper and package parser.
- Bank detection tests for every supported bank signature.
- HTML-as-XLS tests.

### Exit criteria
- One parser logic path feeds both web and CLI.
- Web and CLI no longer disagree because of code drift.

---

## Phase 5 — Security hardening

**Priority:** high

### Actions

1. **Bundle or self-host browser runtime dependencies**
   - Replace CDN JS/worker execution where practical.

2. **Reduce browser attack surface**
   - Tighten CSP.
   - Remove `'unsafe-inline'` / `'unsafe-eval'` if possible.

3. **Stop persisting full statement data in `sessionStorage`**
   - Keep it in memory, or store only non-sensitive derived data.

4. **Review file parsing limits**
   - add file size caps,
   - resource/time limits,
   - parser fail-fast behavior.

5. **Audit scraper path handling and remote fetch controls**
   - constrain output paths,
   - validate/sandbox fetch targets,
   - review SSRF-like risks.

### Verification
- Manual threat checklist plus targeted tests for storage, remote fallback, and runtime asset loading.

### Exit criteria
- No automatic remote exfil path remains.
- Statement data does not sit unnecessarily in origin-readable storage.

---

## Phase 6 — Release discipline / tooling cleanup

**Priority:** high

### Progress notes
- 2026-04-12: GitHub Pages deploy now runs repo verification before build, and repo-level npm lint/typecheck succeed after aligning scraper validation with the preserved rule contract.
- 2026-04-12: installed Bun locally and ran targeted Bun suites for core/parser/rules; they now pass after matcher false-positive and schema-alignment fixes.
- 2026-04-12: Full `verify` still depends on Bun for the test lane, so end-to-end release confidence remains blocked on source fixes plus Bun-backed execution.

### Actions

1. **Make CI actually gate releases**
   - Add repo-wide:
     - typecheck
     - tests
     - data validation
     - generated-artifact consistency checks
   - Update `.github/workflows/deploy.yml`

2. **Fix or remove root `lint`**
   - Either add real workspace lint commands or stop advertising lint.

3. **Reconcile dependency/toolchain drift**
   - TypeScript version mismatch
   - Zod major-version split
   - dual `xlsx` sources/versions
   - Bun/Turbo assumptions

4. **Decide artifact policy**
   - either commit generated JSON deterministically and validate it,
   - or stop committing it and generate in CI.

5. **Repair stale docs/tests/counts**
   - README counts
   - UI counts
   - stale test expectations
   - legal/license text

### Verification
- Clean CI run from fresh checkout.
- Clean typecheck across all packages.
- Reproducible generated artifact behavior.

### Exit criteria
- A fresh checkout can verify the repo without tribal knowledge.

---

## Suggested milestone breakdown

### Milestone A — Stop unsafe behavior
- Phase 0
- highest-priority security gates from Phase 5

### Milestone B — Make the model truthful
- Phase 1
- Phase 2

### Milestone C — Make optimization trustworthy
- Phase 3

### Milestone D — Make parser outputs consistent
- Phase 4

### Milestone E — Make shipping disciplined
- Phase 6

---

## Recommended first concrete PRs

1. **PR 1: Safety hotfixes**
   - disable auto PDF LLM fallback
   - update privacy claims
   - fix README/license mismatch

2. **PR 2: Rule contract redesign**
   - reward schema/types overhaul
   - build-json alignment
   - failing tests for fixed/unit/subcategory rules

3. **PR 3: Calculator rewrite**
   - implement actual supported reward modes
   - replace ambiguous calculator tests with truth-based tests

4. **PR 4: Transaction-aware optimizer**
   - redesign constraints + greedy optimizer
   - document or remove fake ILP option

5. **PR 5: Shared parser core**
   - unify web/package parser logic
   - parity tests
   - narrower bank signatures

6. **PR 6: CI/tooling cleanup**
   - repo-wide typecheck/test gates
   - dependency reconciliation
   - artifact policy cleanup

---

## Non-goals until the above is done

Do **not** spend time first on:
- new issuers,
- more keyword expansion,
- UX polish,
- more scraper sophistication,
- new optimization methods,
- feature marketing copy.

Those all sit on top of broken foundations.

---

## Definition of “safe to trust again”

The repo is ready to earn trust again only when all of these are true:
- real card-rule semantics survive YAML -> runtime -> calculator,
- optimizer uses transaction-level facts,
- web and CLI parse the same file consistently,
- no automatic remote statement exfiltration path exists,
- CI blocks releases on typecheck/tests/data validation,
- docs and generated artifacts reflect current reality.
