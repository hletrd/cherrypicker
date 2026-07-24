# Aggregate Review — CherryPicker Review/Plan/Fix Cycle 16

**Date:** 2026-07-24
**Cycle:** 16 / 100
**Baseline:** `4b1f368d6b8b92cf009ba18d93639f841a8b5d06`
**Branch:** `codex/review-plan-fix-no-deploy-20260723`
**Deploy mode:** none
**Prompt 1 status:** complete
**Prompt 2 status:** complete
**Prompt 3 status:** pending

## Executive summary

Cycle 16 completed all thirteen required review lenses: code, performance,
defensive, critic, verifier, test engineering, tracing, architecture,
debugging, documentation, design, dependency, and QA. Every role reviewed the
exact baseline, inventoried its relevant repository surface, reconciled
candidates against current and archived review/plan history, and completed a
closing missed-file sweep. No role failed.

Twelve reports independently retained the same parser input-validation root;
the designer found no separate UI issue. The **12 raw entries deduplicate to
1 unique finding**:

| Severity | Unique findings |
| --- | ---: |
| Medium | 1 |
| **Total** | **1** |

The finding is High confidence and confirmed by current source plus small
bounded checks. Prompt 1 changed no product source, test, dependency,
configuration, generated file, plan, deployment, or external system. Its
repository writes are the thirteen Cycle 16 role reports, this aggregate, and
the four authorized Cycle 15 recovery reports carried forward for provenance.

## Unique finding

### C16-001 — large worksheet metadata bounds

- Severity: Medium
- Confidence: High
- Status: confirmed
- Shared helper: `packages/parser/src/shared/sheet-cells.ts:20-31`
- Server spreadsheet:
  `packages/parser/src/xlsx/index.ts:106-175,256`
- Browser spreadsheet:
  `apps/web/src/lib/parser/xlsx.ts:109-182,264`
- Server HTML table: `packages/parser/src/html/index.ts:52-101,160`
- Browser HTML table: `apps/web/src/lib/parser/html.ts:42-87,144`
- Server routing: `packages/parser/src/statement.ts:91-97,131-137`
- Browser routing: `apps/web/src/lib/parser/index.ts:79-90,125-136`

All four supported sheet adapters call SheetJS logical-table conversion for
every present sheet before the application checks sheet count, row and column
limits, logical-cell totals, merge counts, or merge coverage. The shared
merge helper then stores one map entry for every covered cell without
independently enforcing a limit. Existing file-byte and archive checks operate
at a different boundary.

This occurs with ordinary supported inputs. A workbook can retain a broad
used range after formatting or template edits even when the visible
transaction table is small. A broad ordinary HTML table follows the same
conversion flow. Because every sheet is examined to choose the best result,
later metadata is processed even when an earlier sheet contains valid
transactions.

Independent small checks confirmed:

- server and browser spreadsheet paths perform work according to declared
  logical dimensions;
- server and browser direct-HTML and HTML-as-spreadsheet paths have the same
  behavior;
- merge lookup storage grows with the number of covered cells; and
- normal merged tables retain current anchor resolution and duplicate
  suppression semantics.

No large fixture was required. Focused role suites ranged from 15 to 271
passing tests, and no role observed a server/browser parity difference.

## Required corrective boundary

The shared browser-safe sheet helper should own one dependency-free policy:

- at most 64 sheets;
- at most 100,000 rows and 256 columns;
- at most 1,000,000 logical cells per sheet and 2,000,000 per workbook;
- at most 10,000 merges per sheet and 20,000 per workbook;
- at most 10,000 cells represented by one merge; and
- at most 100,000 merged cells per sheet and 200,000 per workbook.

It must validate finite, safe, nonnegative, ordered metadata with checked
arithmetic. Every server/browser spreadsheet and HTML-table adapter must
validate the full workbook immediately after SheetJS returns and before the
first logical conversion. Direct single-sheet HTML entry points must apply
the same per-sheet contract.

All rejected inputs should return one stable parser code and natural Korean
message. The merge helper should enforce its direct-call contract and replace
the per-cell map with bounded row intervals, scanning later intervals first
to preserve current last-range-wins behavior and stable source identity.

Tests must cover exact and one-over limits, invalid endpoints, cumulative
workbook totals, all four ordinary parser routes, a valid first sheet followed
by an out-of-bounds sheet, interval resolution order, ordinary merged tables,
and the browser-only package entry.

## Cross-role agreement

| Evidence group | Independent roles | Resolution |
| --- | --- | --- |
| Four ordinary parser routes reach conversion before an app-owned logical bound | code, performance, defensive, critic, verifier, test engineer, tracer, architect, debugger, document specialist, dependency expert, QA tester | Retained as one Medium/High root |
| Shared merge lookup scales with covered cells and lacks its own limit | the same twelve roles | Folded into C16-001 rather than double-counted |
| UI behavior | designer | No separate current finding |

Repeated confirmations do not inflate the unique count.

## Historical reconciliation and exclusions

- Archived Plan 108 owns archive-byte validation before SheetJS; it does not
  own decoded worksheet metadata.
- Archived Plan 69 owns merged-value correctness and source identity; it does
  not define logical size limits or a bounded index representation.
- Older whole-workbook performance notes and the deferred parser-architecture
  item cover different scopes.
- Plans 141 and 142 are verified complete at the reviewed revision and are
  ready to archive in Prompt 2.
- The previously rejected prefixed-XLSX item remains rejected and distinct.
- No second current candidate survived exact-source validation, normal-path
  checks, historical deduplication, and final missed-file sweeps.

## Designer evidence and exact cleanup

The designer reviewed the production build in the isolated session
`cherrypicker-c16-designer-20260724` with profile
`/tmp/cherrypicker-c16-designer-profile.gwO82W`. The preview root/child were
PID `48110/48166` in PGID `48110` on `127.0.0.1:4174`; the browser
daemon/root were PID `50688/50710` in PGID `50688`.

Cleanup closed only the named session and recorded trees. Independent checks
confirmed no active sessions, both ports 4173 and 4174 free, all recorded PIDs
absent, the exact profile absent, and
`bun scripts/run-e2e.ts status --assert-clean` passing. Unrelated user Chrome
PID/PGID `1368/1368` remained untouched.

## Provenance and integrity

The four authorized Cycle 15 recovery reports were read as provenance only,
not counted as new findings, and retained their required SHA-256 values:

- `da11128ec5ff2357d3ddbf3f555ce7f0adaaa9e46d9a3d705108339d239c2914`
- `df310cf63a45f1805aaf3c75aaaa043e6a9c4f34ee3c269df2d40b9feb685906`
- `4dd218d24486237a5a775be489964776ca8516e3b16e281b13aeaab90f2ec22f`
- `947b05e9f69af72c05a745eb6c56febe6328228f12eb77abc506dd4e0c66b4d9`

The six protected Cycle 42 files retained their required hashes and remained
byte-identical, untracked, unstaged, and untouched.

## Agent failures

None. All thirteen roles returned successfully; no wording-filter retry was
needed.

## Prompt 2 plan coverage

Prompt 2 verified completed Plans 141–142 and moved them byte-identically to
`.context/plans/_archive/`. It created one plan for the one retained root:

| Plan | Finding | Scope |
| --- | --- | --- |
| `143-cycle16-large-worksheet-metadata-bounds.md` | C16-001 | Shared metadata policy, pre-conversion validation, stable parser result, row-interval merge index, and bounded parity regressions |

Plan 143 defines every numeric limit, all four parser adapters, both direct
HTML-sheet entry points, browser exports, error parity, existing merge
semantics, small-fixture TDD, focused checks, and every required repository
gate. No finding was deferred, rejected, downgraded, or silently dropped.

Prompt 3 remains pending. It must use the approved disciplined manual fallback
because the requested `ralph` capability is unavailable. Deployment remains
none.
