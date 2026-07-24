# Cycle 16 Test Engineer Review

## Disposition

- Role: test engineer
- Baseline: `4b1f368d6b8b92cf009ba18d93639f841a8b5d06`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Date: 2026-07-24
- Result: one genuine new root retained
- Severity: Medium
- Confidence: High
- Status: Confirmed
- Scope: review only; no product, test, fixture, runner, configuration, or plan
  file was changed

## Repository and test inventory

The exact baseline tree contains 2,354 tracked paths. The tracked-path manifest
SHA-256 is
`9e060303ffa4a07a2c264d3c8462417b2861ea6362a491dbcf975f7777748166`;
the corresponding Git archive SHA-256 is
`1a792a206ee41b27ace177ba84f3e5f1e5ed3d9fbf60d2d3f043bcc7ffaed885`.
This supplied the closing missed-file checklist rather than relying on a
hand-selected directory sample.

| Inventory slice | Count | Coverage |
| --- | ---: | --- |
| Active paths outside `.context` | 1,169 | Source, generated data, fixtures, scripts, configs, docs, and assets |
| Production/executable source | 203 | Web 80; core 26; parser 35; rules 14; viz 9; CLI 16; scraper 12; repository scripts 11 |
| Non-E2E test files | 136 | Web 56; core 19; parser 23; rules 7; viz 3; CLI 10; scraper 10; scripts 8 |
| E2E spec files | 10 | Nine regression specs and one screenshot-only spec |
| Fixture/support paths | 28 | Parser fixtures 25, scraper fixture module 1, E2E CSV fixtures 2 |
| Worker/protocol/runner slice | 10 | Parser and optimizer worker protocols, runners, and workers; included in production count |
| Historical `.context` files | 1,185 | Plans 313 and reviews 872 |

The 203-path production manifest SHA-256 is
`221222bae71b8df6cdbee9fac1e3cf607d38a8b35d6149a4da394ae564a8ae3d`.
The 146-path test manifest SHA-256 is
`ffe730943af144e177f8d8f6cd7adb989070f39ccd450a637d59c98a5ae4e852`.
The 1,185-path plan/review manifest SHA-256 is
`9f23be6a900729fc6cd40cc6150768b6d888fc2c186102940230f1dc5137379b`.
All 359 active TypeScript, JavaScript, Svelte, and Astro blobs were readable
and included in the source/test sweep.

Configuration coverage included all eight root/workspace package manifests,
all eight TypeScript configurations, `bun.lock`, `bunfig.toml`,
`turbo.json`, `vitest.config.ts`, `vitest-bun-shim.ts`, both Playwright
configs, Astro configuration, the deployment workflow, repository
instructions, and README commands.

### Runner reach and test-quality sweep

- The root test command in `package.json:13` reaches all 136 non-E2E test
  files through workspace tests plus `scripts/__tests__`.
- Vitest includes the seven workspace test trees at
  `vitest.config.ts:30-38` and deliberately excludes the Bun process test at
  `vitest.config.ts:39-42`, for 127 files. The eight repository-script tests
  remain Bun-owned.
- `playwright.config.ts:7-14` selects the nine regression specs and enforces
  CI retries plus failure on flaky tests. `playwright.screenshots.config.ts:7-15`
  selects the single visual spec. `scripts/run-e2e.ts:191-237` gives each run
  scoped process ownership and guaranteed cleanup.
- The workflow runs repository verification and the regression browser suite
  at `.github/workflows/deploy.yml:42-46`.
- No test file contains `.skip`, `.only`, `.todo`, or `.fixme`; every one of
  the 146 test specs contains an assertion.
- The scan covered timers and clocks, random input, environment/global
  mutation and restoration, temporary paths, process cleanup, listener
  cleanup, weak assertions, conditional tests, cross-package parity, and
  server/browser duplication. No independent second root survived source
  tracing and historical deduplication.

## large worksheet metadata bounds

- Severity: Medium
- Confidence: High
- Status: Confirmed
- Affected production boundaries:
  - server spreadsheet decode, traversal, and conversion:
    `packages/parser/src/xlsx/index.ts:106-175`
  - browser spreadsheet decode, traversal, and conversion:
    `apps/web/src/lib/parser/xlsx.ts:109-182`
  - server HTML decode, traversal, and conversion:
    `packages/parser/src/html/index.ts:52-101`
  - browser HTML decode, traversal, and conversion:
    `apps/web/src/lib/parser/html.ts:42-87`
  - shared merge indexing:
    `packages/parser/src/shared/sheet-cells.ts:22-31`
  - server and browser merge-index call sites:
    `packages/parser/src/xlsx/index.ts:256`,
    `packages/parser/src/html/index.ts:160`,
    `apps/web/src/lib/parser/xlsx.ts:264`, and
    `apps/web/src/lib/parser/html.ts:144`

### Root and normal failure

All four spreadsheet-table adapters accept the workbook returned by SheetJS
and call `sheet_to_json()` for every present sheet without first applying an
application-owned logical size policy. They do not validate:

- worksheet count;
- row, column, and logical-cell bounds for each used range;
- cumulative logical cells across a workbook;
- merge count, per-merge coverage, or cumulative merge coverage;
- finite, non-negative, ordered safe-integer endpoints; or
- overflow during dimension and cumulative-total calculations.

The shared merge helper then inserts one `Map` entry for every cell covered by
each merge. Its nested loops are at
`packages/parser/src/shared/sheet-cells.ts:24-29`.

The existing ZIP preflight at
`packages/parser/src/shared/xlsx-archive.ts:118-223` validates physical archive
metadata. The browser admission limits at
`apps/web/src/lib/upload-admission.ts:3-5,42-67` validate file bytes and file
count. Neither is a logical worksheet-size contract.

A normal statement workbook can retain a broad used range after formatting,
template editing, or clearing old rows. A formatting-only sheet can also
remain beside the transaction sheet. Because every sheet is converted before
the best result is chosen, a small otherwise supported file can require work
far beyond its populated statement rows and may fail to return a structured
parse result. A normal HTML statement with broad row or column spans reaches
the same merge-index path. A browser worker isolates the page thread, but it
does not supply a deterministic parser result; direct browser fallback and
server/CLI parsing remain synchronous.

### Independent bounded confirmation

Only small in-memory checks were used.

| Input | Encoded size / logical metadata | Observed behavior |
| --- | --- | --- |
| `.xlsx` with one valid transaction | 16,040 bytes; `!ref=A1:AF32` | `sheet_to_json` produced 32 rows and 1,024 logical slots; server and browser each returned the same transaction |
| legacy `.xls` with the same content | 3,584 bytes; `!ref=A1:AF32` | The same 1,024-slot conversion and server/browser result parity |
| Ordinary HTML table with one valid transaction | 196 bytes; one 12-by-12 span | SheetJS produced one merge; the shared merge index created 144 entries; direct server/browser HTML and HTML-as-spreadsheet routes returned identical facts |

These checks establish route reach and deterministic scaling without a large
fixture or large allocation. In the pinned SheetJS implementation,
`node_modules/xlsx/xlsx.mjs:27531-27583` derives conversion loops from
`sheet["!ref"]`; worksheet dimension and merge metadata are decoded at
`node_modules/xlsx/xlsx.mjs:15847-15917`, and HTML span metadata is decoded at
`node_modules/xlsx/xlsx.mjs:22610-22670`.

### Missing test contract

Current tests establish ordinary behavior but not this boundary:

- `packages/parser/__tests__/xlsx.test.ts:312-455,1005-1030` covers normal
  merge semantics.
- `packages/parser/__tests__/html.test.ts:196-272` and
  `apps/web/__tests__/parser-html.test.ts:229-267` cover normal HTML rows and
  spans.
- `packages/parser/__tests__/xlsx-archive.test.ts:77-178` covers archive-byte
  validation.
- `apps/web/__tests__/parser-xlsx-parity.test.ts:44-214` covers configuration,
  detection, date, and amount parity.
- `apps/web/__tests__/parser-conformance.test.ts:36-80` covers ordinary
  server/browser facts and required-column errors.
- `apps/web/__tests__/parser-worker.test.ts:108-219` covers worker ownership,
  cleanup, transfer, and error rehydration.

None asserts logical metadata limits, cumulative workbook totals, malformed
range endpoints, or rejection before conversion and indexing.

The focused existing suites pass on both supported unit runners:

- Bun: 89 passed, 0 failed, 259 assertions across five files.
- Vitest: 89 passed, 0 failed across the same five files.

Passing here is expected: the current suite has no executable specification
for this boundary.

### TDD fix

1. First add a dependency-free, browser-safe validator test table covering a
   normal value, the exact limit, and one past the limit for sheets, rows,
   columns, per-sheet cells, cumulative workbook cells, merge count,
   per-merge coverage, and cumulative merge coverage. Add missing, reversed,
   non-integer, non-finite, negative, unsafe, and high-offset endpoint cases,
   plus multiplication and summation overflow cases.
2. Add small call-order tests around a decoded-workbook seam, or stub the
   configurable `xlsx.utils.sheet_to_json`. A rejected synthetic sheet must
   leave the conversion call count at zero. Rejected merge metadata must be
   reported before conversion and therefore before merge-index creation.
   These tests must not construct the represented large grid.
3. Add server/browser table-driven parity for `.xlsx`, legacy `.xls`,
   HTML-as-spreadsheet, and direct HTML. Assert one stable application
   `ParseError` code/message, no transactions on rejection, and acceptance at
   the exact supported edge.
4. Add multi-sheet cases in which each sheet is individually accepted but the
   cumulative total is not, and a valid first sheet is followed by an
   out-of-policy sheet. This proves complete metadata validation precedes
   candidate selection and conversion.
5. Extend worker/fallback tests to prove the structured validation result is
   serialized unchanged and worker listeners are still cleaned up. Cover the
   statement/CLI route and use at most one compact upload E2E check; no large
   fixture is necessary.
6. Implement one shared application-owned policy immediately after workbook
   decode and before every `sheet_to_json` or merge-index call. Export it
   through the browser-safe parser surface so server and browser cannot drift.
   Use overflow-safe arithmetic. Make the merge helper independently reject
   values outside its contract and replace per-covered-cell storage with a
   bounded row-interval or equivalent range-aware index while preserving
   existing source identity and overlapping-merge semantics.
7. Run the new unit and parity tables under Bun and Vitest, then run the
   separately configured regression E2E suite.

## Duplicate and rejection adjudication

- All four Cycle 15 recovery reports were read in full; they retained no
  finding.
- Every completed Cycle 16 specialist report present at the closing cutoff
  (code reviewer, critic, performance reviewer, defensive reviewer, tracer,
  and verifier) was read in full. Their retained parser observations are the
  same root and are counted once here.
- Archived Plan 108 owns physical ZIP/archive metadata checks, not decoded
  worksheet logical limits.
- Archived Plan 69 owns merge-backed value correctness and source identity,
  not logical metadata bounds.
- The earlier generic whole-workbook performance note did not define or
  implement this application boundary.
- Deferred mixed-runner/coverage work, browser-matrix work, parser
  duplication, the fixed E2E temporary path, the clock-dependent parser test,
  and the planned Svelte DOM harness already have historical owners.
- The old prefixed-XLSX rejection is distinct and excluded.

Full-history searches across all 313 tracked plans and 872 tracked reviews
found no completed owner for this root. No second finding is reported.

## Closing verification

- `git diff --check 5260bbd..4b1f368d` passed for the reviewed production
  delta.
- `git diff --check HEAD` passed before this report was written.
- The final missed-file sweep reconciled production, unit, integration,
  runner, E2E, fixture, worker, configuration, and historical document
  inventories to the exact tracked path manifest.
- Product/source/test/fixture/runner/configuration/plan files remain
  unmodified by this review.
- All six protected Cycle 42 artifacts were rechecked against their required
  hashes and remained byte-identical, untracked, and unstaged.
