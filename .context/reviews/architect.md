# Cycle 5 — Architect

**Review target:** `e3aa4241bbdc9c9b1dc3abff0df78e0cc9f8d715`
**Lens:** canonical contracts, capability ownership, runtime/build parity, authoring boundaries, and failure containment

## Inventory and boundary map

The review began with all 2,133 tracked paths and traced these current cross-package contracts:

1. Statement input → server/browser parser → facts and calendar scope → calculator/optimizer → persistence and reports.
2. Rule YAML/scraper output → canonical schema → semantic validation → generated runtime artifacts → web and CLI consumers.
3. UI events → parse/analysis workers → operation ownership → result replacement and navigation.
4. Workspace manifests/exports → root gates → build/E2E/deploy workflow.

All current source and test files in the web, core, parser, rules, CLI, scraper, visualization, scripts, and workflow surfaces were inspected or content-scanned. The 683 card YAML files were covered through schema/publication validation and complete-field queries. Cycle 4 fixes and the documented deferred optimizer/matcher/parser-consolidation work were excluded before evaluating new candidates.

## Finding

### C5-ARCH-001 — `annualCap` is a canonical supported field without either runtime semantics or a capability gate

- **Severity:** Medium
- **Confidence:** High
- **Status:** confirmed
- **Location:** `packages/rules/src/types.ts:14-23`; `packages/rules/src/schema.ts:89-175`; `packages/rules/src/catalog-validation.ts:229-256,293-309`; `packages/core/src/calculator/reward.ts:632-783`; `packages/rules/src/loader.ts:32-53`; `tools/cli/src/card-catalog.ts:27-52`; `tools/scraper/src/rule-contract.ts:53-100`; `tools/scraper/src/validators.ts:23-63`
- **Concrete failure scenario:** A custom `--cards` catalog or newly scraped card marks a 10% tier as supported with `annualCap: 1000`. Two eligible 10,000-won transactions produce 2,000 won in reported reward, with no cap hit and no unsupported-rule disclosure, even though the canonical rule says the reward stops at 1,000 won.
- **Evidence:** The canonical type/schema accepts and preserves `annualCap`, while semantic validation checks tier references and executable units but never rejects a positive annual cap on a supported rule. The calculator reads `perTransactionCap` and `monthlyCap` only. An executable probe cloned the tracked Simple Plan rule, set a supported tier to 10% plus `annualCap: 1000`, and passed both `cardRuleSetSchema.parse()` and `validateCardRuleSet()`. `calculateRewards()` then returned `{"totalReward":2000,"capsHit":[],"unsupportedRules":[]}` for two 10,000-won domestic transactions. The CLI authoring path calls schema-only `loadAllCardRules()`, and the scraper derives this field from the canonical schema before calling the same semantic validator, so both entry points can admit the shape. A complete catalog query found one current positive annual cap, `packages/rules/data/cards/hyundai/three-body-a.yaml:43-57`; it is safe only because that individual rule is manually marked unsupported.
- **Suggested fix:** Until the runtime owns year-to-date reward usage, make canonical semantic validation reject every positive `annualCap` on a supported rule and ensure the CLI authoring path runs that validation. The scraper should receive the same diagnostic and emit `support.status: unsupported`. If annual caps are implemented instead, extend the analysis contract with year-to-date facts or explicit accrued usage—accumulating only the current latest-month transaction slice is insufficient—then enforce/report the cap in the calculator. Add schema → semantic validation → scraper/CLI → calculator contract tests, including a regression that the tracked explicitly unsupported rule remains publishable.

## Final boundary sweep

Publication identity, compiled CLI/web catalog parity, parser-worker ownership, result replacement atomicity, package exports, cache identity, and deploy gate directionality retain the Cycle 4 closures. The final sweep also checked every canonical rule field against schema, semantic validation, runtime consumption, UI/report disclosure, scraper generation, and custom authoring. No additional non-deferred architecture defect met the evidence threshold.
