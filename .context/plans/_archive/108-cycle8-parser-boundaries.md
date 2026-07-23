# Plan 108 — Cycle 8 Parser Boundaries and Shared Contracts

**Findings:** C8-002 (Medium/High), C8-003 (Medium/High), C8-004
(Medium/High), C8-007 (Medium/High)
**Status:** archived (completed)
**Deploy mode:** none

## Evidence

- Server and browser XLSX entry points pass attacker-controlled compressed
  bytes directly to SheetJS. The web upload limit covers only compressed size,
  while the CLI has no equivalent admission check.
- The shared amount planner recognizes broad Korean amount suffixes before
  recognizing compact incoming/outgoing compound headers, and it accepts the
  first populated field within a role.
- CSV, XLSX, HTML, OFX, and PDF paths append an object for every rejected row.
  The worker's 100-item serializer bound therefore runs only after the full
  diagnostic graph already exists.
- `BankId`, `FileFormat`, and complete bank column maps are copied between the
  parser package and the web application. Package tests import the web copy to
  assert parity.

## Outcome

Untrusted workbooks are rejected before decompression work exceeds a documented
budget, all table-oriented parsers resolve amount meaning consistently, source
diagnostics are bounded at creation, and the parser package is the sole owner
of browser-safe file/bank contracts.

## Implementation

1. Add a dependency-free ZIP central-directory preflight to the parser's
   browser-safe exports. Before `XLSX.read`, enforce compressed input, entry
   count, per-entry expanded size, aggregate expanded size, and compression
   ratio limits; reject malformed/multi-disk/ZIP64 metadata and offset
   overflows. Keep legacy OLE/HTML workbook routing intact.
2. Run the preflight in server and browser XLSX paths before importing or
   invoking SheetJS. Keep one shared constant set and return a sanitized
   `ParseError` rather than allocating expanded content.
3. Recognize compact Korean compound headers (`입출금액`, `입/출금액`,
   `입금/출금액` and reversed/separator variants) before broad suffix
   classification. When multiple populated fields have the same role, accept
   equal normalized values but diagnose unequal or incomparable values instead
   of selecting by source order. Configured columns must not bypass conflicts.
4. Add one parser-owned bounded diagnostic collector: retain at most 99
   examples and one exact counted summary. Use it at the source in server and
   browser CSV, XLSX, HTML, OFX, and PDF paths; preserve worker-side defense,
   `count`, source filename, and message/raw text limits.
5. Export `BankId`, `FileFormat`, column configuration types, and canonical
   bank XLSX maps from the browser-safe parser entry point. Make the web layer
   import/re-export those contracts and remove package-to-application test
   imports. Add a dependency invariant that packages cannot import apps.

## Tests

- Forged ZIP metadata tests exercise excessive entry count, per-entry and
  aggregate expansion, ratio, ZIP64/multi-disk sentinels, truncated records,
  bad offsets, legacy OLE routing, and a representative valid XLSX fixture
  without large allocations.
- Server/browser parity for every compound header variant, equal duplicate
  values, unequal values in both orders, configured-column conflicts, and
  ordinary debit/credit inputs.
- A large bad-row corpus for every tabular format proves the source array is
  at most 100 entries, the summary count is exact, valid rows survive, and the
  worker round trip does not amplify the graph.
- Type-level and dependency checks prove all web parser consumers use the
  package-owned contracts and no package test imports `apps/**`.

## Acceptance

- [x] SheetJS never sees a workbook that exceeds the shared archive budget.
- [x] Compound amount headers and same-role conflicts are deterministic across
      server and browser parsers.
- [x] Parser-source diagnostic memory is bounded before worker serialization.
- [x] Parser contracts and bank maps have one package-owned source of truth.

## Completion evidence

- A browser-safe ZIP preflight now checks central and local headers, rejects
  malformed/encrypted/ZIP64/multi-disk/data-descriptor bypasses, and enforces
  compressed, entry, aggregate, and ratio budgets before SheetJS.
- Amount-field conflicts use one shared directional plan. Source diagnostics
  retain 99 examples plus one exact summary in a plain-array collector that
  passes both Bun and Vitest equality/clone boundaries.
- Web parser contracts and bank maps now come from the parser package; parity
  tests moved downwind and the dependency checker rejects package-to-app
  imports.
- Parser/web focused verification passed 1,509 and 379 tests respectively;
  final `test:bun` passed 1,601 tests and full Vitest passed 2,811 tests.

## Execution note

The requested `ralph` skill is unavailable. Prompt 3 will use a manual
test-first boundary matrix, focused server/browser parity runs, and a final
missed-path audit.
