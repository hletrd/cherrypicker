# Cycle 2 product/design review

Date: 2026-07-23
Role: designer
Result: 3 new findings (1 Medium, 2 Low)

## Scope and inventory

I inspected all 56 tracked web source files, all 3 public runtime scripts, the 24 web-test files and 9 E2E files, all 5 viz source files and its report test, the CLI report caller, the complete 683-card catalog/24 issuer indexes, and the relevant Astro, theme, manifest, deployment, and product-documentation surfaces. The component review covered information architecture, responsive classes and overflow, link/button affordance, focus and keyboard contracts, ARIA/naming, contrast tokens, reduced-motion branches, light/dark tokens, loading/empty/error/validation states, report/print output, and Korean copy. The product is Korean-only and LTR by contract, so RTL was checked as a non-requirement rather than presented as a missing feature.

Browser evidence used a uniquely named `agent-browser` session against a freshly successful `bun run --cwd apps/web build` and isolated Astro preview at `127.0.0.1:4173`. The deployed home route loaded as `홈 | CherryPicker`. The generated-report template was then loaded directly so CSP enforcement, DOM, active stylesheets, computed styles, network activity, and accessibility structure could be queried. DOM/computed-style evidence, not the screenshot, is the basis of C2-DES-01. The unique browser session and preview were stopped after the review.

Cycle 1's heading, landmarks, upload affordance, validation/error announcements, focus treatment, mobile navigation, card-grid bounds/pagination, disclosure copy, color-token, reduced-motion, and result-state fixes are present. Those completed items are not repeated below.

## Findings

### C2-DES-01 — The standalone HTML report's CSP disables its entire visual design

- Severity: **Medium**
- Confidence: **High**
- Status: **Confirmed in browser**
- Location:
  - `packages/viz/src/report/templates/report.html:6-177`
  - `packages/viz/src/report/generator.ts:238-252`
  - `tools/cli/src/commands/report.ts:144-148`

Evidence:

- The document sets `default-src 'self'; script-src 'none'` at line 6 and puts all presentation in one inline `<style>` element beginning at line 8. With no `style-src`, `default-src` is the fallback; inline style is not a `'self'` resource and is blocked.
- Browser DOM inspection found one style element with 4,169 characters and the expected CSP meta, but `document.styleSheets` was empty.
- Computed styles were browser defaults rather than the authored report design:

  ```json
  {"bg":"rgba(0, 0, 0, 0)","padding":"0px","margin":"8px","headerBg":"rgba(0, 0, 0, 0)","styleSheets":[]}
  ```

- The generator only substitutes template placeholders; it does not change the CSP/style relationship. The CLI writes the resulting file and announces success.

User impact:

The promised HTML report opens as an unstyled default document: no report background/surface hierarchy, grid layout, card treatment, table system, badges, highlight states, spacing scale, or print-quality composition. The content remains partially readable, but a primary CLI deliverable looks broken and dense, particularly for wide tables.

Competing hypothesis:

The CSP correctly disables scripts and is valuable for a local report. That does not require disabling the report's own fixed CSS; a hash can authorize this exact style block without authorizing arbitrary inline styles.

Suggested fix:

Keep `script-src 'none'`, add a generated/verified `style-src` SHA-256 hash for the exact inline block, or emit a securely referenced companion stylesheet if the report is no longer required to be a single file. Add a real-browser report test that asserts an active stylesheet and representative computed values for body, metrics grid, section, and table. Do not rely only on substring tests of generated HTML.

### C2-DES-02 — Finite performance-tier maxima are described as exclusive although calculation is inclusive

- Severity: **Low**
- Confidence: **High**
- Status: **Confirmed**
- Location:
  - `apps/web/src/components/cards/CardDetail.svelte:250-258`
  - `packages/core/src/calculator/reward.ts:20-30`
  - Representative data: `packages/rules/data/cards/nh/apeach-sweet-check.yaml:16-23`

Evidence:

- The card detail says `{maxSpending} 미만` (“less than”).
- Core qualifies the same tier when `previousMonthSpending <= maxSpending`.
- Catalog tiers encode adjacent integer boundaries such as maximum ₩199,999 followed by minimum ₩200,000.

User impact:

At exactly ₩199,999, the UI says the tier applies below ₩199,999 while the calculator includes ₩199,999. The discrepancy repeats on every finite tier and makes the detail view an inaccurate explanation of the recommendation at its boundary.

Suggested fix:

Render the stored maximum as `{maxSpending} 이하`, or render the next tier's minimum as `{nextMinSpending} 미만`. Add a component/contract test covering the exact maximum and next minimum alongside core tier selection.

### C2-DES-03 — The report still presents the retired `CardPick` product name

- Severity: **Low**
- Confidence: **High**
- Status: **Confirmed residual from completed branding work**
- Location:
  - `packages/viz/src/report/templates/report.html:7,182,211`
  - Reconciliation reference: `.context/plans/72-cycle1-performance-quality-docs.md:34,455,465`

Evidence:

The generated report title, visible H1, and footer all say `CardPick`; a repository-wide non-history search found no other production occurrence. The current web product, docs, and CLI-facing copy use `CherryPicker`, and the Cycle 1 completion record says public CardPick references were removed.

User impact:

The downloadable/shareable artifact appears to come from a different or obsolete product, weakening trust in a financial recommendation and making screenshots/reports inconsistent with the app that produced them.

Suggested fix:

Replace all three occurrences with `CherryPicker` and add a generated-report assertion for the current brand plus a repository lint/check that rejects the retired public name outside migration/history documentation.

## State, accessibility, and performance coverage

The final static sweep covered desktop/mobile layout constraints, table/long-label overflow, no-JS/loading/empty/error/validation branches, focus-visible and keyboard naming, live-region use, dark/light tokens, reduced motion, card-catalog loading boundaries, and LCP/CLS/INP-sensitive image/list/animation code. The isolated home-route smoke and build exposed no additional reproducible defect. Browser verification was deliberately focused on the standalone report once its CSP/style mismatch was observed; no screenshot-only claim was promoted to a finding.

## Missed-issue and file-coverage sweep

I re-ran searches for headings/landmarks, unlabeled interactive elements, raw colors, transitions/animations without motion handling, overflow-prone tables, missing state branches, stale product names, report/print CSS, and semantic copy/calculator mismatches. Every hit was traced to its component, caller, data contract, and test where present, and all source files in the inventory were revisited against the Cycle 1 reconciliation list. No additional independent product/design finding survived the sweep.
