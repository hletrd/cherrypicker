# Review-plan-fix Cycle 16 — verifier

## Review identity

- Date: 2026-07-24
- Revision: `4b1f368d6b8b92cf009ba18d93639f841a8b5d06`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Disposition: one genuinely new finding independently verified
- Finding count: one Medium, High confidence
- Scope: independent verification and this report only

## Inventory and provenance

The verifier traced all server and browser statement routes, spreadsheet and
HTML-table decoders, conversion calls, shared merge lookup, worker and
fallback paths, public exports, tests, and historical ownership. The four
authorized Cycle 15 recovery reports were used only as provenance.

The six protected Cycle 42 files retained their recorded hashes and remained
untracked, unstaged, and untouched.

## Retained finding

### C16-VR-001 — large worksheet metadata bounds

- Severity: Medium
- Confidence: High
- Shared indexing: `packages/parser/src/shared/sheet-cells.ts:20-31`
- Server spreadsheet path:
  `packages/parser/src/xlsx/index.ts:106-119,149-175,256`
- Browser spreadsheet path:
  `apps/web/src/lib/parser/xlsx.ts:109-127,163-182,264`
- Server HTML-table path:
  `packages/parser/src/html/index.ts:52-65,82-101,160`
- Browser HTML-table path:
  `apps/web/src/lib/parser/html.ts:42-50,66-87,144`

All supported paths perform full logical conversion before an
application-owned row, column, cell-total, merge-count, or merge-coverage
limit is enforced. The shared merge helper likewise stores one entry per
covered cell without its own limit.

Independent small checks exercised normal server/browser spreadsheet and HTML
routes, confirmed declared logical dimensions drive conversion work, and
confirmed merge lookup storage grows with covered cells. A normal merged
table control preserved current lookup semantics. No large fixture was used.

An ordinary workbook may retain a broad used range after formatting or
template edits even when visible transaction data is small. The implementation
therefore needs shared validation immediately after workbook decoding and
before any conversion or merge indexing.

The fix should enforce explicit per-sheet and cumulative workbook totals,
validate numeric metadata, use one stable sanitized parse error on every
server/browser path, and replace the per-cell merge map with bounded row
intervals while preserving current precedence. Tests should cover limits,
invalid metadata, cumulative totals, and normal merged-table parity.

## Historical result and exclusions

Full-history search found no owner for this logical metadata boundary. The
archive-byte plan, prior merge-semantics work, older general performance note,
and parser-duplication item remain separate. The previously rejected
prefixed-XLSX item remains rejected and distinct. No second candidate survived
independent verification.

## Verification and closing sweep

- Exact baseline remained
  `4b1f368d6b8b92cf009ba18d93639f841a8b5d06`.
- No tracked or staged change existed before this report was written.
- Final sweep rechecked every production SheetJS read, conversion, merge
  lookup, statement router, parser worker, upload boundary, CLI consumer,
  test family, dependency record, workflow, documentation path, and
  historical ownership record.
- No browser, preview server, E2E run, deployment, or production mutation was
  performed.

Final count: one new Medium finding, High confidence.
