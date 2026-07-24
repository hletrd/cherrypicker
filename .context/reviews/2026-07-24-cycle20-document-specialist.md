# Cycle 20 document-specialist review

## Result

Review baseline: `c59938ee5ca5b0c5756e34907330a4eacd2898f9`.

No genuinely new documentation root survived the full current-tree and
history comparison.

- New Cycle 20 documentation findings: **0**
- Corroborated current completion gap: **C20-B-001**
- Severity / confidence: **Low / High**
- Historical disposition: reopen archived Plan 109; do not count a new root
- Confirmed findings: **1 historical obligation**
- Likely findings: **0**
- Manual-only risks promoted: **0**

## Complete documentation inventory

The inventory contains 2,424 tracked paths: 1,172 active paths, including 181
test/E2E support paths, and 1,252 `.context` review/plan paths. The
documentation pass covered every one of the 29 active Markdown files:

- `README.md`, `.claude/CLAUDE.md`, `.claude/AGENTS.md`, and the remaining
  active repository instruction/plan document;
- all 24 generated issuer README files; and
- `vendor/README.md`.

The pass also inspected the license, all eight root/workspace manifests,
package exports, Bun/Astro/TypeScript/Playwright declarations, the deployment
workflow, CLI and scraper help/argument sources, source comments that promise
validation or completeness, generated catalog headers and metadata, README
generation/check scripts, and the complete tracked history corpus.

The documented claims still match repository authority:

- the web accepts CSV/TSV, XLS/XLSX, PDF, JSON, OFX/QFX, and HTML/HTM;
- web analysis is local to the browser, while the CLI's remote PDF fallback is
  opt-in and consent-gated;
- scraper credentials, model override, host expansion, overwrite behavior,
  and review quarantine match their help and implementation;
- Bun 1.3.12, Astro 7, Svelte 5, TypeScript 5.9, static GitHub Pages hosting,
  and the no-response-header limitation are stated accurately; and
- generated documentation reports 683 catalog cards, 551
  optimizer-executable cards, and 24 issuers.

## C20-B-001 contract evidence

Archived Plan 109 is explicit that persisted snapshots restore only when all
stored derivations form one coherent analysis
(`.context/plans/_archive/109-cycle8-analysis-coherence.md:17-21`). Its
implementation and acceptance sections specifically include monthly
count/spending summaries, intentional truncated snapshots, atomic rejection,
and prevention of stale financial totals
(`:23-42,44-63,65-76`).

The current implementation leaves one narrow hole in that completed
contract:

- the producer creates a monthly bucket only while processing a transaction
  and increments its count unconditionally
  (`packages/core/src/analysis/context.ts:157-175,189-205`);
- the truncated coherence validator accepts each bucket with
  `transactionCount >= 0`, not `> 0`
  (`apps/web/src/lib/analysis-result.ts:926-984`);
- its missing-calendar-month callback treats an existing zero-count bucket as
  absent (`apps/web/src/lib/analysis-result.ts:979-983`);
- persistence independently admits the same zero count and then restores the
  coherent-looking current-version payload
  (`apps/web/src/lib/persistence.ts:822-844,867-925`); and
- the dashboard sums every monthly spending value
  (`apps/web/src/components/dashboard/SpendingSummary.svelte:31-37,105-108`).

A transaction-truncated payload can therefore contain an older month with
positive spending and zero transactions. Its represented count and
missing-month provenance still reconcile, deserialization succeeds with a
`truncated` warning, and the dashboard includes the phantom money in the
full-period total. The source comment on
`isAnalysisResultCoherent()` correctly describes a reconciliation boundary
(`apps/web/src/lib/analysis-result.ts:987-990`), but the implementation does
not yet satisfy that wording.

Status: **confirmed current behavior, historical Plan 109 completion gap**.
This is documentation evidence for `C20-B-001`, not a second finding.

## Concrete repair and documentation impact

1. Require every `monthlyBreakdown` bucket to have a positive safe-integer
   `transactionCount` in both the pure coherence validator and the persistence
   structural boundary. Keep `spending: 0` valid when the count is positive.
2. Add pure-validator and deserializer regressions for a positive-spending,
   zero-count truncated bucket, plus a valid zero-spending, positive-count
   control.
3. Keep the existing atomic corrupted-result removal path and prove the
   invalid snapshot never reaches the dashboard.
4. No public README feature claim needs changing. After the repair, Plan 109's
   existing completion statement becomes accurate again. A short invariant
   comment beside the shared monthly-bucket validation would help prevent a
   second drift.

## Verification

- The Cycle 20 focused web matrix passed 215 tests with 543 expectations.
- Astro checked 126 files with zero errors, warnings, or hints.
- `bun run dependencies:check` passed.
- `bun run data:check`, including documentation drift checks, passed with 683
  cards, 551 executable cards, and 24 issuers.
- No browser, Playwright, E2E, deploy, release, or publish action was run by
  this role.

The passing checks explain why the narrow truncated-payload gap was not
already visible; none currently asserts that a represented monthly bucket
must itself contain at least one transaction.

## History reconciliation and final missed-issue sweep

Cycle 18's `YearMonth` domain/leading-zero work and Cycle 19's lower-bound
validator totality work are resolved and were not reissued. The full tracked
history search also excluded already-owned static-host CSP limitations,
parser duplication, algorithmic performance, session-storage scope, mixed
test runners, and coverage-policy requests.

The closing sweep rechecked stale counts and versions, copyable commands,
supported formats and issuers, privacy/consent/security/deploy wording,
generated ownership markers, public exports, help-option arity/defaults,
catalog identity terminology, comments promising fail-closed validation, and
current/archive ownership. No additional current documentation mismatch
remained.

The protected untracked Cycle 42 artifacts were not opened, searched, edited,
deleted, moved, or otherwise inspected.
