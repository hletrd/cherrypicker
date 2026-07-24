# Review-plan-fix Cycle 16 — critic

## Review identity

- Date: 2026-07-24
- Revision: `4b1f368d6b8b92cf009ba18d93639f841a8b5d06`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Disposition: one genuinely new finding retained after challenge
- Finding count: one Medium, High confidence
- Scope: independent critic review and this report only

## Baseline and inventory

The critic inventoried all 2,354 tracked paths and searched the 1,185 review
and plan records for prior ownership. It challenged the current candidate
through source tracing, small bounded checks, consumer analysis, and review
from correctness, performance, API, UI, data, operations, documentation, and
cross-package perspectives.

The four authorized Cycle 15 recovery reports were read as provenance only.
The six protected Cycle 42 files remained byte-identical, untracked,
unstaged, and untouched.

## Retained finding

### C16-CT-001 — large worksheet metadata bounds

- Severity: Medium
- Confidence: High
- Shared helper: `packages/parser/src/shared/sheet-cells.ts:20-31`
- Server spreadsheet:
  `packages/parser/src/xlsx/index.ts:106-119,149-175,256`
- Browser spreadsheet:
  `apps/web/src/lib/parser/xlsx.ts:109-127,163-182,264`
- Server HTML table:
  `packages/parser/src/html/index.ts:52-65,82-101,160`
- Browser HTML table:
  `apps/web/src/lib/parser/html.ts:42-50,66-87,144`

The four production paths begin complete logical table conversion before an
application-owned dimension or cell-total boundary is checked. The shared
merge helper also stores a separate map entry for each covered cell. File-byte
checks do not constrain this decoded logical work.

Ordinary formatting or template edits can leave a workbook with a broad used
range relative to its visible data, and a broad ordinary HTML table follows
the same library conversion. Small probes confirmed both branches and the
growth relationship while keeping all fixtures bounded.

The required fix is one shared policy for sheet count, rows, columns, logical
cells, merge count, individual and cumulative merge coverage, and workbook
totals. All server/browser spreadsheet and HTML-table paths must validate
before conversion. The merge helper must enforce the contract itself and use
bounded row intervals while preserving last-range-wins behavior. Stable parse
errors and boundary/parity tests are acceptance requirements.

## Challenge result and novelty

The critic independently confirmed reachability through the normal
server/browser routers and found no existing logical-size owner in current,
archived, or deferred records. The archive-byte plan, merge-semantics plan,
parser-duplication item, and prior general performance note remain separate.
The previously rejected prefixed-XLSX item remains rejected and distinct.

No second candidate survived exact-source verification, normal-path checks,
historical deduplication, and consumer tracing.

## Verification and closing sweep

- Focused critic matrix: 190 tests, 567 expectations, 0 failures.
- `bun run typecheck` passed all seven workspaces; the web checker reported
  zero errors, warnings, or hints across 125 files.
- `bun run dependencies:check` and `bun run data:check` passed.
- No browser, preview server, E2E run, deployment, or production mutation was
  performed.
- The final sweep covered every production SheetJS call, statement router,
  parser worker, upload boundary, CLI consumer, optimizer/calculator delta,
  generated-data path, manifest, workflow, documentation path, and historical
  ownership record.

Final count: one new Medium finding, High confidence.
