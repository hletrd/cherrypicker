# Review-plan-fix Cycle 16 — defensive reviewer

## Review identity

- Date: 2026-07-24
- Revision: `4b1f368d6b8b92cf009ba18d93639f841a8b5d06`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Disposition: one genuinely new finding
- Finding count: one Medium, High confidence
- Scope: independent defensive and resilience review and this report only

## Inventory and coverage

The review traced every supported statement format through server and browser
parsers, worker and fallback paths, persistence, CLI consumers, and UI sinks.
It also reviewed file admission, archive checks, scraper and filesystem
boundaries, dependency integrity, workflow controls, and all historical
review and plan ownership.

The four authorized Cycle 15 recovery reports were provenance only. The six
protected Cycle 42 files remained byte-identical, untracked, unstaged, and
untouched.

## Retained finding

### C16-DR-001 — large worksheet metadata bounds

- Severity: Medium
- Confidence: High
- Shared helper: `packages/parser/src/shared/sheet-cells.ts:20-31`
- Server spreadsheet call: `packages/parser/src/xlsx/index.ts:149-175`
- Browser spreadsheet call: `apps/web/src/lib/parser/xlsx.ts:163-182`
- Server HTML-table call: `packages/parser/src/html/index.ts:82-101`
- Browser HTML-table call: `apps/web/src/lib/parser/html.ts:66-87`
- Server routing: `packages/parser/src/statement.ts:91-97,131-137`
- Browser routing: `apps/web/src/lib/parser/index.ts:79-90,125-136`

Each path accepts decoded sheet metadata and begins full logical conversion
before applying an app-owned limit to sheet count, rows, columns, total
logical cells, merge count, or merge coverage. The shared merge helper
similarly creates one map entry per covered cell without independently
enforcing limits.

This is reachable through ordinary supported files and HTML tables. A
workbook can retain a broad used range through normal formatting or template
editing even when the useful transaction data is small. Small bounded checks
confirmed the path and growth behavior without using a large fixture.

The corrective boundary should be shared, browser-safe, dependency-free, and
run immediately after workbook decoding but before conversion or merge
indexing. It should reject invalid numeric endpoints, enforce per-sheet and
cumulative totals, expose one stable sanitized parse error, and make the
merge helper enforce the same policy with row intervals.

## Historical reconciliation and exclusions

No current or archived review, plan, or deferred record owns this exact
logical metadata boundary. Plan 108 covers archive bytes; the historical
merge plan covers merge semantics; the older general performance note does
not specify this pre-conversion contract. The previously rejected
prefixed-XLSX item remains rejected and distinct.

The sweep also covered statement detection, parser isolation, worker
protocols, filesystem writes, scraper limits, credential handling, workflow
permissions, dependency sources, generated-data identity, persistence
coherence, and rendering sinks. No second new root survived exact-source
validation and deduplication.

## Verification and closing sweep

- Focused parser checks completed successfully.
- `git diff --check HEAD` passed before this report was written.
- No browser, preview server, E2E run, deployment, or production mutation was
  performed.
- Every production SheetJS call and each server/browser conversion and
  merge-resolution path was rechecked in the final sweep.

Final count: one new Medium finding, High confidence.
