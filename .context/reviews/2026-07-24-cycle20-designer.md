# Cycle 20 Designer Review

Date: 2026-07-24
Baseline: `c59938ee5ca5b0c5756e34907330a4eacd2898f9`
Role: Designer
Mode: review only; no implementation, browser launch, E2E run, commit, push, or deploy

## Result

No novel design defect was found.

One current downstream presentation risk was corroborated:

| ID | Severity | Confidence | Status |
| --- | --- | --- | --- |
| C20-B-001 | Low | High | Confirmed current gap in archived Plan 109; not a new Cycle 20 root |

The data-coherence defect can make the full-period spending total display money from a monthly bucket that claims zero transactions. The appropriate repair is to reject the malformed snapshot before it reaches the store, not to add UI copy or presentation-only filtering.

## Inventory and coverage

The review reused the complete tracked inventory at the baseline: 2,424 paths, comprising 1,172 active paths and 1,252 archived `.context` paths. The visual/product sweep covered all 22 active UI source files (6 page/layout files, 15 components, and the shared stylesheet), all 3 static client scripts, 57 web test files, and the 10 executable E2E specifications.

The sweep inspected:

- loading, empty, success, validation, parser-error, analysis-error, and recovery states;
- navigation landmarks, skip navigation, status announcements, inputs, buttons, tables, cards, and disclosure controls;
- responsive table/card behavior, narrow layouts, long text, Korean copy, and RTL stress behavior;
- light and dark themes, focus visibility, reduced motion, print behavior, and local performance-sensitive transitions;
- report totals and the relationship between the spending summary and monthly breakdown data.

Relevant source regions included:

- `apps/web/src/components/dashboard/SpendingSummary.svelte:31-37,105-108`
- `apps/web/src/lib/store.svelte.ts:304-311`
- `apps/web/src/styles/app.css:192-201`
- `apps/web/src/components/FileDropzone.svelte`
- `apps/web/src/pages/index.astro`
- `apps/web/src/layouts/Layout.astro`

## Supplied browser evidence audit

This role did not start Chrome, Playwright, or another browser. It audited the existing Cycle 20 textual evidence supplied by the browser-design run:

- Desktop, 1440 × 1000: no horizontal overflow; skip link, navigation, main, footer, headings, upload control, status region, list, and input were exposed semantically.
- Keyboard: the skip link measured 132.67 × 36 px with a visible outline; Enter moved focus to `main`.
- Theme: dark foreground/background were `rgb(241, 245, 249)` / `rgb(15, 23, 42)` and light foreground/background were `rgb(15, 23, 42)` / `rgb(248, 250, 252)`.
- Local document-ready and load timing was approximately 103 ms.
- Mobile, 375 × 812: no clipping or horizontal overflow; the named menu exposed its expanded links and Escape restored focus.
- RTL stress: no clipping was reported.

The supplied run used session `cherrypicker-c20-designer-20260724`, profile `/tmp/cherrypicker-c20-designer-profile.vEefVJ`, preview process 34463/34554 in PGID 34463 on port 4190, and daemon/root 38457/38460 in PGID 38457. Two stale commands from an aborted cards-summary attempt, 51658 and 68390, were terminated by exact command identity. The stuck daemon was terminated by its exact PGID. The preview, browser session/tree, and listener were confirmed gone; the profile was recoverably moved to `/Users/hletrd/.Trash/cherrypicker-c20-designer-profile.vEefVJ-20260724`. The wrapper was clean, while unrelated Chrome process 1368 was preserved.

## C20-B-001 — impossible monthly bucket can surface as phantom spending

### Evidence

The producer creates a monthly bucket only while processing a transaction and increments its count unconditionally:

- `packages/core/src/analysis/context.ts:157-175,189-205`

The snapshot validator and persistence layer accept `transactionCount: 0` for an individual truncated month:

- `apps/web/src/lib/analysis-result.ts:926-984`
- `apps/web/src/lib/persistence.ts:822-844,867-925`

The spending summary then adds every monthly bucket's `spending`, independently of that bucket's transaction count:

- `apps/web/src/components/dashboard/SpendingSummary.svelte:31-37,105-108`

Therefore, a truncated snapshot such as a month with positive spending and zero transactions can display a positive full-period total even though no transaction backs it. Other UI count surfaces can simultaneously report zero for that data.

### User-visible failure

The report remains polished and internally plausible, which makes this primarily a trust defect: a user can see spending that cannot be reconciled with the displayed transaction facts. It is low severity because the malformed state requires corrupted or incompatible persisted data, but confidence is high because the path from validation through restoration to rendering is direct.

### Recommended fix and design acceptance

Require every stored monthly bucket to have `transactionCount > 0` in both the pure result validator and persistence validation. Keep zero spending valid when the count is positive.

Design acceptance:

1. A snapshot containing positive spending with a zero-count month is rejected before the result shell is shown.
2. No partial, stale, or phantom spending total flashes during rejection/recovery.
3. A zero-spending month with a positive transaction count still renders normally.
4. Valid truncated and full snapshots retain their current hierarchy, copy, spacing, and responsive behavior.

No UI-specific patch or new explanatory copy is recommended.

## Historical reconciliation

Archived Plan 109 explicitly owns coherent monthly counts/spending and preventing stale financial totals:

- `.context/plans/_archive/109-cycle8-analysis-coherence.md:17-21,23-42,44-63,65-76`

C20-B-001 is therefore a completion gap in that accepted plan, not a novel Cycle 20 design finding. Cycle 18 and Cycle 19 findings were checked as resolved and were not reissued. Known static-host CSP, parser duplication, performance, session-storage, mixed-runner, and coverage items were also not relabeled as new design defects.

## Verification

- Focused web tests: 215 tests passed with 543 expectations.
- Astro check: 126 files, zero errors, warnings, or hints.
- Dependency validation: passed.
- Data validation: passed for 683 cards, 24 issuers, and 551 executable records.
- No browser, Chrome, Playwright, E2E, or deployment command was started by this role.

## Final sweep

The final design sweep found no additional confirmed, likely, or manual-check item. Responsive, keyboard, semantic, theme, reduced-motion, RTL, loading, error, empty, and success-state evidence remained coherent. The six protected untracked Cycle 42 artifacts were neither opened nor searched. Only this assigned report pair was changed.
