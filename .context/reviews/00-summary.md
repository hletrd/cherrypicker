# Comprehensive repo review summary

## Overall verdict

**REQUEST CHANGES.** After a fresh repo-wide pass with six specialist review lanes plus local verification, the repo is **not currently trustworthy for precise financial recommendations or for high-stakes statement handling**.

The biggest problems are not style issues. They are **systemic correctness, trust-boundary, and release-discipline failures**.

## Review files

- `./.context/reviews/00-summary.md` — synthesized master summary
- `./.context/reviews/code-reviewer.md`
- `./.context/reviews/architect.md`
- `./.context/reviews/critic.md`
- `./.context/reviews/security-reviewer.md`
- `./.context/reviews/test-engineer.md`
- `./.context/reviews/dependency-expert.md`

## Top blockers

### 1) The reward engine cannot faithfully represent a large chunk of the actual card dataset

**Severity:** CRITICAL

**Evidence**
- Rule model only carries `rate`, `monthlyCap`, `perTransactionCap`: `packages/rules/src/types.ts:12-30`, `packages/rules/src/schema.ts:14-32`
- Reward calculation only uses `tierRate.rate`: `packages/core/src/calculator/reward.ts:123-176`
- Build pipeline uses the same reduced model: `scripts/build-json.ts:22-40`
- Real data contains unsupported rule shapes like `fixedAmount` and `unit`: e.g. `packages/rules/data/cards/shinhan/mr-life.yaml:152-173`, `packages/rules/data/cards/lotte/digiloca-auto.yaml:35-56`

**Why this blocks release**
The engine silently discards rule semantics that exist in the YAML. Local repo scan results:
- **80 / 683** card YAML files use `fixedAmount` and/or `unit`
- **128 / 683** card YAML files contain duplicate reward categories that the current matching logic cannot disambiguate safely

That means the repo is not "slightly inaccurate" — it is structurally unable to evaluate a large portion of its own rule corpus.

---

### 2) The optimizer destroys transaction-level facts before scoring cards

**Severity:** CRITICAL

**Evidence**
- Constraints collapse input to category totals only: `packages/core/src/optimizer/constraints.ts:3-25`
- Greedy optimizer rebuilds synthetic one-row transactions per category: `packages/core/src/optimizer/greedy.ts:59-78`, `83-113`, `183-191`
- Reward engine later relies on transaction-sensitive facts like `minTransaction`, `specificMerchants`, `excludeOnline`, and `perTransactionCap`: `packages/core/src/calculator/reward.ts:132-151`

**Why this blocks release**
Any rule sensitive to transaction shape, merchant, online/offline, or per-transaction caps is evaluated on fake data. The UI can still produce polished recommendations — but they can be wrong for fundamental reasons.

---

### 3) Web and CLI/parser behavior have forked; the same statement can produce different outputs

**Severity:** HIGH

**Evidence**
- Duplicated parser stacks: `apps/web/src/lib/parser/*` vs `packages/parser/src/*`
- Browser and backend XLSX configs differ for newer banks: `apps/web/src/lib/parser/xlsx.ts:89-172` vs `packages/parser/src/xlsx/adapters/index.ts:83-163`
- Backend XLSX parser handles parenthesized negatives: `packages/parser/src/xlsx/index.ts:74-85`; browser parser does not: `apps/web/src/lib/parser/xlsx.ts:230-238`
- Web optimizer hardcodes parser facts away with `installments: 0` and `isOnline: false`: `apps/web/src/lib/analyzer.ts:68-82`
- CLI preserves parser-provided `installments` / `isOnline`: `tools/cli/src/commands/optimize.ts:75-90`, `tools/cli/src/commands/report.ts:81-96`

**Why this blocks release**
Users can get different answers depending on whether they use the browser or CLI. That is a product-level trust failure.

---

### 4) Parser correctness regressed in ways that can silently lose transactions

**Severity:** HIGH

**Evidence**
- Generic CSV and XLSX paths now skip any row where parsed amount becomes `0`: `packages/parser/src/csv/generic.ts:181-185`, `packages/parser/src/xlsx/index.ts:228-230`
- The same change exists in the browser XLSX path: `apps/web/src/lib/parser/xlsx.ts:382-395`
- Over-broad bank signatures were added: `packages/parser/src/detect.ts:51-106`, mirrored in `apps/web/src/lib/parser/detect.ts:49-104`

**Why this blocks release**
`parseAmount()` now conflates malformed values with real zero-valued rows, then callers silently discard them. Combined with overly broad bank signatures like `/토스/`, `/MG/`, `/JB/`, and `/cu\b/i`, this creates a nasty failure mode: the wrong bank is detected, the wrong columns are read, amounts fall to `0`, and rows disappear with no hard failure.

---

### 5) Sensitive statement data can leave the machine or become accessible to third-party/runtime code

**Severity:** CRITICAL / HIGH

**Evidence**
- Automatic PDF-to-Anthropic fallback: `packages/parser/src/pdf/index.ts:119-123`, `packages/parser/src/pdf/llm-fallback.ts:33-52`
- Browser dynamically imports remote runtime code: `apps/web/src/lib/categorizer-ai.ts:80-87`
- Browser PDF worker is loaded from CDN: `apps/web/src/lib/parser/pdf.ts:226-232`
- Full analysis results are persisted in `sessionStorage`: `apps/web/src/lib/store.svelte.ts:83-91`, `95-109`, `161-175`, `184-191`
- CSP explicitly allows risky execution patterns: `apps/web/src/layouts/Layout.astro:38`

**Why this blocks release**
For a statement analyzer, these are not theoretical concerns. The current trust model allows remote code or remote fallback services into the same data-handling path as sensitive financial records.

---

### 6) Basic static verification is already failing, and CI does not gate releases on quality checks

**Severity:** HIGH

**Local verification**
- Package-level TypeScript diagnostics fail on duplicate object keys and unresolved remote imports:
  - duplicate keys in `packages/core/src/categorizer/keywords-niche.ts:640`, `888`
  - unresolved CDN import in `apps/web/src/lib/categorizer-ai.ts:81`
- Root `lint` is effectively broken because no workspace defines a `lint` script: root `package.json:9-19` vs workspace manifests
- GitHub Actions deploy workflow only builds the web app; it does **not** run repo-wide tests/lint/typecheck: `.github/workflows/deploy.yml:17-40`

**Why this blocks release**
The repo can ship parser/data/logic regressions without a failing gate.

---

### 7) Docs, generated artifacts, and legal metadata are drifting out of sync

**Severity:** MEDIUM

**Evidence**
- README still says MIT: `README.md:169-171`
- `LICENSE` is Apache 2.0: `LICENSE:1-15`
- README and UI still mention stale card counts in places, while generated JSON reports 683 cards / 24 issuers
- `packages/rules/data/cards-compact.json` is stale relative to `packages/rules/data/cards.json`
- Tests still assert stale catalog counts: `packages/rules/__tests__/schema.test.ts:191-217`

**Why this matters**
It is now unclear which repo artifacts are authoritative. That undermines trust in both the data pipeline and the documentation.

## Additional noteworthy findings

- Reward-cap reporting logic appears wrong: `packages/core/src/calculator/reward.ts:179-188` computes `actualReward` after updating the tracked cap usage, so the over-cap delta is effectively lost.
- The browser and CLI disagree on default previous-month-spending behavior (`apps/web/src/lib/analyzer.ts:89-95` vs CLI optimize/report using zero/default maps), which means qualification assumptions differ by surface.
- The scraper/tooling path has its own security and reproducibility concerns; see `security-reviewer.md` and `dependency-expert.md`.

## What I verified locally

- Read the repo structure, manifests, workflows, parser/core/rules/tooling code, and current git diff
- Ran package-level TypeScript diagnostics via code-intel
- Confirmed current typecheck failures in `apps/web`, `packages/core`, `packages/viz`, and `tools/cli`
- Confirmed `bun` is not available in this environment, and Turbo build/lint entrypoints are brittle without it
- Ran local repo scans showing:
  - **80** card YAML files with `fixedAmount` / `unit`
  - **128** card YAML files with duplicate reward categories

## Recommended immediate action order

1. **Stop trusting current optimization outputs** for exact recommendations until transaction-level scoring and rule semantics are fixed.
2. **Unify the rule contract** (`rate` vs percentage vs fixed/unit rewards, subcategory support, duplicate-category handling).
3. **Delete the parser fork or extract a shared parser core** so web and CLI cannot drift.
4. **Remove automatic remote PDF fallback** and eliminate remote runtime code from the browser path.
5. **Add real release gates**: repo-wide typecheck, tests, data validation, and generated-artifact consistency checks.
6. **Repair docs/artifact/legal drift** so the repo has one clear source of truth again.
