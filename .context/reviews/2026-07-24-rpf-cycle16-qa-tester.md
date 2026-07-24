# Cycle 16 QA tester review

Date: 2026-07-24
Role: QA tester
Scope: server and browser spreadsheet and HTML statement routes

## Inventory and coverage

I traced every runtime call site relevant to the requested routes:

- Dispatch:
  - `packages/parser/src/statement.ts`
  - `apps/web/src/lib/parser/index.ts`
- Server adapters:
  - `packages/parser/src/xlsx/index.ts`
  - `packages/parser/src/html/index.ts`
- Browser adapters and worker entrypoints:
  - `apps/web/src/lib/parser/xlsx.ts`
  - `apps/web/src/lib/parser/html.ts`
  - `apps/web/src/lib/parser/workers/xlsx-worker.ts`
  - `apps/web/src/lib/parser/workers/html-worker.ts`
  - `apps/web/src/lib/parser/worker-protocol.ts`
  - `apps/web/src/lib/parser/worker-runner.ts`
- Shared format, decoding, and worksheet helpers:
  - `packages/parser/src/detect.ts`
  - `packages/parser/src/shared/format-detection.ts`
  - `packages/parser/src/shared/encoding.ts`
  - `packages/parser/src/shared/xlsx-archive.ts`
  - `packages/parser/src/shared/sheet-cells.ts`
  - `packages/parser/src/browser.ts`
- Focused regression suites:
  - `packages/parser/__tests__/xlsx.test.ts`
  - `packages/parser/__tests__/html.test.ts`
  - `packages/parser/__tests__/statement-runtime.test.ts`
  - `apps/web/__tests__/parser-xlsx-parity.test.ts`
  - `apps/web/__tests__/parser-html.test.ts`
  - `apps/web/__tests__/parser-format-routing-parity.test.ts`
  - `apps/web/__tests__/parser-conformance.test.ts`
  - `apps/web/__tests__/parser-cycle5-integrity.test.ts`
  - `apps/web/__tests__/parser-cycle7-direction.test.ts`
  - `apps/web/__tests__/parser-worker.test.ts`
  - `apps/web/__tests__/parser-browser-boundary.test.ts`
  - `apps/web/__tests__/parser-web-detect-parity.test.ts`

I also searched historical reviews and plans for ownership of the retained
root. Archived plan 69 owns merge-value semantics, while earlier performance
notes only describe the existing conversion mode. No existing plan owns the
logical-size boundary below. The previously rejected prefixed-XLSX topic
remains distinct and was not reopened.

## Independent QA results

An in-memory statement with one KB transaction was exercised through both
`parseStatement` and browser `parseFile` for each format:

| Route | Server result | Browser result |
|---|---|---|
| Standard `.xlsx` | KB, one transaction, 6,500 won, no diagnostic | Exact match |
| Legacy binary `.xls` | KB, one transaction, 6,500 won, no diagnostic | Exact match |
| HTML saved as `.xls` | KB, one transaction, 6,500 won, no diagnostic | Exact match |
| Direct `.html` | KB, one transaction, 6,500 won, no diagnostic | Exact match |

The transaction date, merchant, amount, category, bank, format, and diagnostic
list matched on every route. The browser worker files delegate to the same
adapters, and the worker protocol regression suite confirmed result
rehydration and lifecycle behavior.

A bounded metadata probe used a 16,061-byte workbook declaring 32 rows by 512
columns, with one ordinary transaction in the first three columns. Both
spreadsheet adapters returned the transaction without a diagnostic. The shared
merge helper also produced 16,384 map entries for one 32-by-512 merge span.

Focused regression commands completed with:

- 219 passed, 0 failed, 734 expectations across the nine parser and parity
  files in the first run.
- 52 passed, 0 failed, 122 expectations across worker, browser-boundary, and
  file-detection coverage.
- Combined: 271 passed, 0 failed, 856 expectations.

## Retained finding

### C16-QA-001: large worksheet metadata bounds

Severity: Medium
Confidence: High
Status: Confirmed

#### Evidence

- The server spreadsheet route reads the workbook and iterates every named
  sheet at `packages/parser/src/xlsx/index.ts:106-175`; conversion occurs at
  line 175, before any app-owned logical-size check. Merge indexing follows at
  line 256.
- The browser spreadsheet route has the same ordering at
  `apps/web/src/lib/parser/xlsx.ts:110-182`, with merge indexing at line 264.
- Direct server HTML conversion occurs at
  `packages/parser/src/html/index.ts:52-101`, followed by merge indexing at
  line 160.
- Direct browser HTML conversion occurs at
  `apps/web/src/lib/parser/html.ts:42-87`, followed by merge indexing at line
  144.
- `packages/parser/src/shared/sheet-cells.ts:18-31` stores one map entry for
  every cell covered by every merge and does not validate its input contract.
- The ordinary server routes reach these adapters through
  `packages/parser/src/statement.ts:91-97,131-138`; the browser routes reach
  them through `apps/web/src/lib/parser/index.ts:79-90,125-136`.

The existing archive-byte checks are distinct from decoded worksheet metadata.
There is no shared limit for sheet count, absolute rows, columns, logical cells
per sheet or workbook, merge count, or merge coverage. Conversion work scales
with the declared used area, and merge indexing scales with covered cells,
before the parser can return a stable user-facing result.

A normal export can retain a broad used area after formatting many blank cells,
or contain presentation tables with large row and column spans. The current
routes may spend disproportionate time and memory on that metadata or let an
iteration/allocation error escape instead of returning a predictable Korean
diagnostic. Spreadsheet, legacy spreadsheet, HTML-as-spreadsheet, and direct
HTML inputs all converge on the same unchecked conversion/indexing order.

#### Recommended fix

1. Add a dependency-free, browser-safe validator beside
   `packages/parser/src/shared/sheet-cells.ts`.
2. Validate finite, safe, nonnegative, ordered row and column endpoints, then
   enforce documented per-sheet and per-workbook limits for sheets, rows,
   columns, logical cells, merge count, and merge coverage.
3. Validate all present sheets immediately after workbook decoding and before
   any adapter calls `sheet_to_json`.
4. Make `createSheetMergeIndex` enforce its direct-call contract and replace
   per-covered-cell storage with bounded row intervals while preserving current
   last-range-wins behavior.
5. Return one stable `ParseError` code and a short Korean message such as
   `표의 행, 열 또는 병합 범위가 너무 커서 읽지 않았어요.`
6. Add server/browser boundary and one-over-boundary tests for standard
   workbooks, legacy workbooks, HTML saved as a spreadsheet, direct HTML,
   multi-sheet totals, malformed endpoints, merge counts, merge coverage, and
   worker result serialization. Keep the four normal-path checks above as
   regression controls.

## Final sweep

No second actionable root was retained. Normal parsing, legacy parsing,
format routing, bank detection, transaction facts, and server/browser parity
were green. Source-wide search found exactly four conversion call sites and
one shared merge-index implementation, all covered above. Historical ownership
was checked, the protected files were left unchanged and unstaged, and this
review stages nothing.
