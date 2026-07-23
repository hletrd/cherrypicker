# Cycle 1 Parser and CLI Integrity Plan

**Archived:** 2026-07-23 after recorded implementation and verification
**Date:** 2026-07-23
**Source:** `.context/reviews/_aggregate.md`, C1-017 through C1-025 and their raw review evidence
**Mode:** Implemented in cycle 1; no deployment
**Scope:** 9 findings — 6 High/High and 3 Medium/High

## Implementation record (2026-07-23)

- C1-017 through C1-024 were implemented. Date and amount failures now suppress
  invalid rows, blank cells inherit only from real merges, PDF text parsing is
  shared, CP949 detection uses strict UTF-8 failure, and CLI remote consent is
  local-first and keyed by `REMOTE_LLM_REQUIRED`.
- Integration-audit follow-up closed two missed boundaries: untrusted PDF LLM
  output now requires a real ISO calendar date and a positive safe-integer
  amount without rounding, and both `optimize` and `report` share exact
  non-negative safe-integer validation for `--prev-spending`.
- The non-deferred C1-025 work is complete: amount, date-cell, encoding,
  merge-resolution, and PDF-text behavior live under
  `packages/parser/src/shared/`; `@cherrypicker/parser/browser` is browser-safe;
  and `packages/parser/__tests__/conformance/` compares server and browser HTML
  and XLSX facts while directly testing the shared encoding and PDF kernels.
- The separately bounded full-adapter migration described in Task 7 remains
  deferred exactly as planned.
- Scope gates passed: parser tests (1,589), web unit tests (225), CLI tests (24),
  parser/web/CLI typechecks, the Astro production build, static browser-boundary
  checks, and scoped `git diff --check`.
- The pinned Bun 1.2.6 integration gate exposed that its native `TextDecoder`
  lacks `euc-kr`. The shared kernel now keeps the native browser decoder and
  uses a direct `iconv-lite` server fallback only when that label is
  unavailable; scraper HTML decoding uses the same direct dependency. The
  pinned rerun passes all 1,639 parser/scraper tests and the production browser
  build/bundle gate.
- The outer cycle's complete pinned verification, 2,148-test Vitest run, and
  64-test scoped E2E run pass. No deployment was performed.

## Outcome

After this plan is implemented, server and browser parsing must produce the same transaction facts for the affected inputs. Invalid dates and unsafe numeric values must not enter a transaction, blank note rows must not inherit transaction fields, refund notation must remain negative, corrected PDF columns must be read only after their final indices are known, CP949 CSVs must decode before header/bank detection, incomplete spreadsheets must explain which required column is absent, and CLI PDF commands must exhaust local parsing before asking for permission to upload anything.

No correctness fix in C1-017 through C1-024 may be deferred. C1-025 is split into:

1. shared browser-safe kernels and a conformance harness required in this batch for every touched behavior; and
2. a separately bounded remainder for replacing every complete browser parser with package adapters.

## Constraints and invariants

- Preserve the existing dirty changes in:
  - `apps/web/src/lib/parser/amount.ts`
  - `apps/web/__tests__/amount.test.ts`
  - `apps/web/src/lib/store.svelte.ts`
- Before implementation, capture `git status --short` and the diff of the dirty amount files. Moving amount logic to a shared kernel must retain the current double-negative behavior and tests; do not overwrite or revert those edits.
- Modify source and tests only after the baseline has been recorded. Do not edit review reports.
- Do not deploy, push `main`, or run any deployment command.
- A parser may return partial success with explicit row errors, but it must not append a transaction whose required date or amount is invalid.
- Every affected pure behavior must have one production implementation. Tests must import that implementation; they must not reconstruct its regex or algorithm.
- Browser-safe exports must not transitively import `node:fs`, `node:path`, `pdf-parse`, `unpdf`, or `@anthropic-ai/sdk`.
- No browser/E2E run is required for this parser/CLI batch. If an outer gate nevertheless runs Playwright, follow the process-isolation procedure in “Browser process hygiene”; a failed E2E gate is recorded and does not stop the outer cycle.

## Current duplicated surfaces

| Concern | Server/package implementation | Browser implementation |
|---|---|---|
| Date parsing | `packages/parser/src/date-utils.ts:1-238`; XLSX coercion at `packages/parser/src/xlsx/index.ts:49-149` | `apps/web/src/lib/parser/date-utils.ts:1-253`; XLSX coercion at `apps/web/src/lib/parser/xlsx.ts:207-329` |
| Amount parsing | `packages/parser/src/csv/shared.ts:148-191`; `packages/parser/src/amount.ts:1-31` | `apps/web/src/lib/parser/amount.ts:1-66`; aliases in `apps/web/src/lib/parser/csv.ts:119-123` |
| Encoding | `packages/parser/src/detect.ts:6-73,322-334`; `packages/parser/src/index.ts:54-65` | `apps/web/src/lib/parser/index.ts:21-74` |
| Column matching | `packages/parser/src/csv/column-matcher.ts:1-148` | `apps/web/src/lib/parser/column-matcher.ts:1-130` |
| JSON normalization | `packages/parser/src/json/index.ts:85-96,185-254` | `apps/web/src/lib/parser/json.ts:85-92,169-233` |
| HTML parsing | `packages/parser/src/html/index.ts:31-285` | `apps/web/src/lib/parser/html.ts:56-294` |
| XLSX parsing | `packages/parser/src/xlsx/index.ts:161-460` | `apps/web/src/lib/parser/xlsx.ts:342-637` |
| PDF text parsing | `packages/parser/src/pdf/table-parser.ts:1-257`; `packages/parser/src/pdf/index.ts:15-260,297-395` | copied into `apps/web/src/lib/parser/pdf.ts:19-447,520-603` |
| Types/errors | `packages/parser/src/types.ts:1-54` | `apps/web/src/lib/parser/types.ts:1-53` |

## Implementation sequence

### 0. Baseline and dirty-worktree guard

1. Record:

   ```sh
   git status --short
   git diff -- apps/web/src/lib/parser/amount.ts apps/web/__tests__/amount.test.ts apps/web/src/lib/store.svelte.ts
   ```

2. Run the focused pre-change tests and save failures separately from new regressions:

   ```sh
   bun test packages/parser/__tests__/amount.test.ts packages/parser/__tests__/detect.test.ts packages/parser/__tests__/html.test.ts packages/parser/__tests__/xlsx.test.ts packages/parser/__tests__/table-parser.test.ts packages/parser/__tests__/pdf-parity.test.ts packages/parser/__tests__/json.test.ts
   bun test apps/web/__tests__/amount.test.ts apps/web/__tests__/parser-encoding.test.ts apps/web/__tests__/parser-html.test.ts apps/web/__tests__/parser-pdf.test.ts apps/web/__tests__/parser-json.test.ts
   bun test tools/cli/__tests__/commands.test.ts packages/core/__tests__/calculator.test.ts
   ```

3. Add no “temporary fix” that leaves server and web behavior different. Work by shared helper first, then replace both call sites in the same change.

### 1. Establish browser-safe production kernels and conformance fixtures

This is the non-deferred portion of C1-025.

#### Package boundary

1. Add browser-safe modules under `packages/parser/src/shared/`:
   - `amount.ts` — canonical string normalization plus `parseAmountValue(raw: unknown)`.
   - `date.ts` — canonical date-string parsing plus `coerceDateCell(raw: unknown)`.
   - `encoding.ts` — BOM detection, strict UTF-8 validation, CP949 fallback, and decoding from `Uint8Array`.
   - `sheet-cells.ts` — required-column validation and merge-backed cell resolution with provenance.
   - `pdf-text.ts` — PDF table/row parsing and fallback line scanning from already-extracted text.
2. Add `packages/parser/src/browser.ts` that exports only pure types and the browser-safe modules. It must have no import path to `packages/parser/src/index.ts`, PDF extractors, LLM fallback, or Node built-ins.
3. Add a `./browser` subpath in `packages/parser/package.json` and add `@cherrypicker/parser: "workspace:*"` to `apps/web/package.json`.
4. Keep the root `@cherrypicker/parser` entry compatible for CLI/server users. Existing server modules may re-export or delegate to the new kernels.
5. Verify the browser build resolves `@cherrypicker/parser/browser` directly and does not bundle the Node entry. A static import scan and the web production build are required gates.

#### Test and fixture strategy

1. Add one shared conformance suite under `packages/parser/__tests__/conformance/`:
   - `fixtures.ts` for format-neutral input/expected-output tables.
   - `workbook.ts` for creating one SheetJS workbook buffer and, for the server adapter, writing those exact bytes to a temporary file.
   - `parser-conformance.test.ts` for invoking both adapters against the same HTML/XLSX inputs and comparing normalized `transactions` and error codes/messages.
   - `pdf-text.test.ts` for the shared text kernel, independent of `unpdf` and `pdfjs-dist`.
2. Shared static fixtures:
   - `packages/parser/__tests__/fixtures/html/iso-hyphen-date.html`
   - `packages/parser/__tests__/fixtures/html/note-row-after-transaction.html`
   - `packages/parser/__tests__/fixtures/html/real-rowspan.html`
   - CP949 byte arrays in `packages/parser/__tests__/conformance/encoding-fixtures.ts`
3. Replace copied-implementation tests:
   - `apps/web/__tests__/parser-encoding.test.ts:1-199` must import the production encoding kernel instead of defining `detectBestEncoding`.
   - `apps/web/__tests__/parser-pdf.test.ts:1-75` must import the production PDF token/text helper instead of reconstructing `fallbackAmountPattern` and a local `parseAmount`.
   - `packages/parser/__tests__/table-parser.test.ts:452-490,681-750` must stop testing locally reconstructed regexes and assert production helper/output behavior.
   - Update `packages/parser/__tests__/pdf-parity.test.ts:11-17`, whose current comments accept duplicate “identical logic,” to execute the shared kernel directly.
4. Keep adapter-specific tests for I/O behavior, but make semantic expectations come from the conformance fixtures.

**Acceptance**

- The focused shared-kernel test suite can import `@cherrypicker/parser/browser` in Bun and in the Astro build.
- `rg` finds only one production definition for the fallback PDF amount matcher, unknown-value amount coercer, encoding-selection algorithm, and merge-resolution algorithm.
- Existing double-negative amount cases remain green after the dirty web helper becomes a wrapper/delegate.

### 2. Fix HTML/XLSX date, merge, and header integrity

**Findings:** C1-017, C1-018, C1-022

**Current locations**

- HTML SheetJS/date path:
  - `packages/parser/src/html/index.ts:44-48,82-84,179-282`
  - `apps/web/src/lib/parser/html.ts:62-66,101-103,192-291`
- XLSX date and row path:
  - `packages/parser/src/xlsx/index.ts:49-149,213-219,240-459`
  - `apps/web/src/lib/parser/xlsx.ts:207-329,389-391,412-636`
- Unsafe forward-fill tests:
  - `packages/parser/__tests__/html.test.ts:174-239`
  - `apps/web/__tests__/parser-html.test.ts:206-263`
  - `packages/parser/__tests__/xlsx.test.ts:274-407,509-650,942-1028`
- Missing XLSX required-column guard:
  - `packages/parser/src/xlsx/index.ts:270-284`
  - `apps/web/src/lib/parser/xlsx.ts:443-457`

#### Date coercion

1. `coerceDateCell(raw)` must accept:
   - a valid `Date`, using its calendar components rather than `toISOString()` so a local-midnight SheetJS value does not shift days;
   - Excel serial numbers and numeric `YYMMDD`/`YYYYMMDD` forms currently supported by XLSX;
   - supported date strings through the canonical date parser.
2. It returns a valid `YYYY-MM-DD` or a typed failure; it never returns an arbitrary display string as a successful date.
3. HTML must call it on the unknown cell value before any `String(...)` conversion.
4. HTML and XLSX must add a row-level parse error and skip emission when the final date is invalid. Do not append the invalid row merely because another row succeeded.

#### Merge-backed values only

1. Build a merge index from `sheet["!merges"]`. For each cell, the helper returns:
   - value;
   - source: `explicit`, `merge-anchor`, `merge-continuation`, or `empty`;
   - anchor coordinate when merge-backed.
2. Replace all rolling `lastDate`, `lastMerchant`, `lastAmount`, `lastCategory`, `lastInstallments`, and `lastMemo` state in both HTML and XLSX parsers.
3. Resolve an empty field only when that exact coordinate is covered by a SheetJS merge range. Ordinary blank or whitespace-only cells do not inherit prior values.
4. Require valid explicit-or-merge-backed date and amount signals before transaction emission. Merchant may remain empty if the source statement truly omits it, but a note in the merchant column cannot manufacture missing date/amount.
5. Prevent duplicate emission when the required amount cell resolves to the same merge anchor on multiple continuation rows. A merged date with distinct explicit amount cells still represents distinct transactions and must remain valid.
6. Use the same whitespace-aware emptiness predicate before summary/note handling.

#### Required headers

1. Immediately after XLSX column matching, require `dateCol !== -1` and `amountCol !== -1`, matching the existing HTML policy at:
   - `packages/parser/src/html/index.ts:123-133`
   - `apps/web/src/lib/parser/html.ts:140-150`
2. Return a targeted `ParseError` naming every missing required column.
3. Multi-sheet selection must not erase the targeted error when all candidate sheets are invalid; if any sheet parses valid transactions, keep the valid sheet while retaining its own row errors.

#### Fixture changes

1. ISO HTML fixture: `2026-01-01` must produce exactly that date in server and browser results.
2. Invalid `Date` fixture: no transaction is appended and a date error is present.
3. Note-row fixture: a valid 50,000-won row followed by a row containing only `할부 안내 문구` produces one transaction, not two.
4. Real-merge fixtures must set actual `rowspan` or SheetJS `!merges`; blank-cell arrays without merge metadata no longer count as merged cells.
5. Rewrite the tests currently described as “simulates merged cells” so the workbook helper sets real merge ranges.
6. Add:
   - date+merchant header with missing amount;
   - merchant+amount header with missing date;
   - partial header on every sheet;
   - one invalid summary sheet plus one valid detail sheet.

**Acceptance**

- Both HTML parsers return `2026-01-01`, never a `Date.toString()` value.
- No invalid date is present in `transactions`.
- The note/spacer fixtures add zero transactions.
- Only merge-covered blanks inherit values.
- Incomplete XLSX headers yield zero transactions and a targeted non-empty error list in both adapters.
- Server and browser conformance outputs are deeply equal.

### 3. Unify and fix pure PDF text parsing

**Findings:** C1-019, C1-020

**Current locations**

- Server structured and fallback paths:
  - `packages/parser/src/pdf/index.ts:15-260,297-395`
  - `packages/parser/src/pdf/table-parser.ts:1-257`
- Browser copies:
  - `apps/web/src/lib/parser/pdf.ts:19-447,520-603`

#### Shared kernel

1. Move format-neutral PDF text handling into `packages/parser/src/shared/pdf-text.ts`:
   - table parsing;
   - transaction-row filtering;
   - header layout resolution;
   - per-row date/amount/merchant resolution;
   - fallback line scanning.
2. Keep only I/O at the edges:
   - `packages/parser/src/pdf/index.ts:263-281` extracts text from a file and retains the optional remote LLM fallback.
   - `apps/web/src/lib/parser/pdf.ts:453-518` extracts text with pdf.js.
3. Both adapters call the same `parsePDFText(text, bank)` and translate the same returned transactions/errors.

#### Signed fallback amounts

1. The production matcher must return the complete sign-bearing token and its offsets, not an unsigned capture-group payload.
2. Pass the complete token to the canonical amount parser. Removing a currency suffix/prefix is allowed only if sign markers remain intact.
3. Cover:
   - `50,000원` → positive;
   - `(50,000)` → negative;
   - `마이너스50,000원` → negative;
   - `－50,000원` → negative;
   - `50,000-` → negative.
4. The positive-spending PDF result must exclude all four refund forms.

#### Structured row ordering

1. Add a production `resolvePDFRowLayout(row, headerLayout)` helper.
2. Resolve header indices, run per-row fallback, validate final bounds, and only then read `dateValue` and `amountValue`.
3. The helper returns final indices and values together so callers cannot cache a value before changing its index.
4. Date, amount, category, memo, and installment reads must all use the final layout.

#### Tests

1. Add a table-driven signed-token fixture to `packages/parser/__tests__/conformance/pdf-text.test.ts`.
2. Add a structured-row fixture where the header points to date/amount columns 0/3 but the row contains them at 1/4. Assert the row is retained with the value from 1/4.
3. Run the same shared kernel for the “server” and “browser” adapter expectations; do not duplicate regex assertions.
4. Remove or rewrite copied regex tests listed in Task 1.

**Acceptance**

- Every supported negative notation parses as a negative value before filtering and is absent from positive transaction output.
- The shifted-column row is parsed once with its corrected amount/date.
- There is one production PDF text parser and one fallback amount matcher.
- Server PDF and browser PDF adapters differ only in text extraction and server-only remote fallback.

### 4. Replace CP949 heuristics with strict decoding

**Finding:** C1-021

**Current locations**

- `packages/parser/src/detect.ts:6-73,322-334`
- `packages/parser/src/index.ts:54-65`
- `apps/web/src/lib/parser/index.ts:21-74`
- copied web tests at `apps/web/__tests__/parser-encoding.test.ts:1-199`

#### Algorithm

1. `decodeTextBytes(bytes: Uint8Array)` uses this order:
   - UTF-16LE/UTF-16BE BOM;
   - UTF-8 BOM;
   - strict UTF-8 decode with `{ fatal: true }`;
   - CP949 decode only when strict UTF-8 fails.
2. ASCII is valid UTF-8 and remains UTF-8.
3. Return `{ content, encoding, replacementCount }`; strip a decoded BOM exactly once.
4. Use the same result for server format/bank detection and browser CSV parsing.
5. Remove the server “signal byte follows ASCII” heuristic and the browser “fewest replacement chars” loop.
6. If CP949 decoding is unavailable or still produces replacement characters beyond the accepted threshold, return a parse error instead of silently claiming UTF-8.

#### Fixtures and tests

1. Use one known CP949 byte fixture for `이용일,가맹점,이용금액`; it deliberately begins Korean segments with lead bytes that the current heuristic misses.
2. Cover short and greater-than-100-byte BOM-free CP949 inputs, valid UTF-8 Korean, pure ASCII, UTF-8 BOM, UTF-16LE/BE BOM, and malformed bytes.
3. Assert both detected encoding and decoded Korean text.
4. Feed the decoded CP949 CSV through production bank/header parsing, not only the decoder.
5. Replace the local `detectBestEncoding` implementation in the web test with imports from `@cherrypicker/parser/browser`.

**Acceptance**

- The realistic CP949 fixture reports `cp949`, contains intact Korean headers, and parses the expected transaction.
- All valid UTF-8 fixtures remain UTF-8.
- Server and browser use byte-for-byte identical decoder output.

### 5. Enforce safe amounts at parser and calculator boundaries

**Finding:** C1-023

**Current locations**

- Numeric normalization:
  - `packages/parser/src/amount.ts:15-30`
  - `packages/parser/src/json/index.ts:85-96`
  - `apps/web/src/lib/parser/json.ts:85-92`
  - `packages/parser/src/xlsx/index.ts:398-430`
  - `apps/web/src/lib/parser/xlsx.ts:571-600`
- Existing safe string check:
  - `packages/parser/src/csv/shared.ts:180-191`
- Public reward boundary:
  - `packages/core/src/calculator/reward.ts:185-194,226-260`
  - `packages/core/src/calculator/types.ts:13-18`

#### Parser policy

1. `parseAmountValue(raw)`:
   - for strings, preserves the existing normalization and safe-integer bound;
   - for numbers, first requires finite input, rounds once, then requires `Number.isSafeInteger(rounded)`;
   - returns a typed failure/null for unsafe numeric values.
2. JSON and XLSX in both environments must call this production helper without first stringifying a numeric cell.
3. An unsafe value must produce a row error and no transaction.
4. Preserve all dirty web amount cases, including `(-1234)`, full-width symbols, Korean prefix, trailing minus, and `MAX_SAFE_INTEGER`.

#### Core policy

1. `calculateRewards()` must fail fast before any bucket mutation when a transaction amount is not a finite safe integer.
2. Throw a descriptive error containing the transaction ID and invalid amount, consistent with the existing `previousMonthSpending` boundary check.
3. Do not place `NaN` or infinity in `skippedTransactions`; those values cannot be represented safely in serialized output.

#### Tests

1. Parser amount matrix:
   - `Number.MAX_SAFE_INTEGER` accepted;
   - the next representable unsafe integer rejected;
   - `NaN`, `Infinity`, and `-Infinity` rejected;
   - numeric and string paths have the same boundary.
2. JSON and XLSX adapter tests in both environments assert zero transactions plus an amount error for unsafe numeric input.
3. `packages/core/__tests__/calculator.test.ts` adds direct public-API cases for `NaN`, both infinities, and an unsafe integer; every case throws before returning a partial calculation.

**Acceptance**

- No parser output contains a non-finite or unsafe-integer amount.
- No reward output contains `NaN`/infinity.
- Existing amount-format behavior and the current dirty double-negative fix remain green.

### 6. Make CLI remote consent local-first

**Finding:** C1-024

**Current locations**

- `tools/cli/src/consent.ts:3-76`
- `tools/cli/src/commands/analyze.ts:51-65`
- `tools/cli/src/commands/optimize.ts:67-81`
- `tools/cli/src/commands/report.ts:76-91`
- `tools/cli/__tests__/commands.test.ts:48-71`
- Local PDF tiers and remote boundary:
  - `packages/parser/src/pdf/index.ts:283-409`

#### Typed fallback signal

1. Extend `ParseError` in `packages/parser/src/types.ts:30-46` with a stable optional error code.
2. When local structured and fallback PDF parsing both produce no transaction and remote fallback is disabled, emit `REMOTE_LLM_REQUIRED`; CLI logic must not match Korean error text.
3. Preserve that code through `enrichErrors()` in `packages/parser/src/index.ts:38-50`.

#### Shared CLI orchestration

1. Add `tools/cli/src/parse-statement.ts` and route analyze, optimize, and report through it.
2. The helper sequence is:
   1. call `parseStatement(..., { allowRemoteLLM: false })`;
   2. if local parsing succeeds or no `REMOTE_LLM_REQUIRED` code exists, return immediately;
   3. only now call the consent helper;
   4. without `--allow-remote-llm`, throw the actionable rerun instruction without making a remote request;
   5. with the flag, prompt unless `--yes` or CI makes the run non-interactive;
   6. on approval, retry with `allowRemoteLLM: true`;
   7. on denial/timeout, do not retry remotely.
3. Rename/refocus `requireRemoteLLMConsent()` so it no longer decides from the `.pdf` extension. Its only job is to authorize a confirmed remote-fallback request.
4. A two-pass remote case is acceptable for this correctness batch. Do not introduce a parser callback while simultaneously changing PDF extraction unless tests prove callback ordering and single invocation.

#### Tests

Use dependency injection in the production orchestration helper so tests can count parse and consent calls without contacting Anthropic.

1. Locally parseable PDF, no flag:
   - one local parse;
   - zero consent calls;
   - zero remote-enabled parses;
   - success.
2. Locally unparseable PDF, no flag:
   - local parse occurs first;
   - zero remote-enabled parses;
   - actionable error.
3. Locally unparseable PDF, flag and interactive approval:
   - local parse;
   - one consent call;
   - one remote-enabled retry.
4. Denial or timeout:
   - no remote-enabled retry.
5. `--allow-remote-llm --yes`/CI:
   - no interactive prompt;
   - retry only after the typed local failure.
6. Non-PDF:
   - no consent path.
7. Replace the current tests that require every PDF to throw before parsing.

**Acceptance**

- A locally parseable PDF works without `--allow-remote-llm`.
- Consent is requested only after local parsing reports `REMOTE_LLM_REQUIRED`.
- No denied, unflagged, or timed-out path calls the remote-enabled parser.
- Analyze, optimize, and report share the same orchestration helper.

### 7. Complete parity verification and bound the remaining C1-025 architecture work

#### Required now

1. The amount, date, encoding, SheetJS merge/header, and PDF text behaviors changed above live in shared browser-safe production modules.
2. Server and web adapters consume the same conformance fixtures.
3. Remove copied tests and stale comments that describe separately maintained “identical logic.”
4. Add a static guard test that fails if these definitions reappear under `apps/web/src/lib/parser`:
   - `fallbackAmountPattern`;
   - a local encoding-selection loop;
   - a local unsafe numeric amount normalizer;
   - a rolling all-column forward-fill implementation.

#### Explicitly deferred architecture remainder

- **Finding:** C1-025 — browser and server maintain separate parser products
- **Original severity/confidence:** High / High
- **Exact current locations:**
  - Server: `packages/parser/src/types.ts:1-54`, `date-utils.ts:1-238`, `amount.ts:1-31`, `detect.ts:6-337`, `csv/column-matcher.ts:1-148`, `csv/shared.ts:1-228`, `json/index.ts:1-254`, `ofx/index.ts:1-246`, `html/index.ts:31-285`, `xlsx/index.ts:161-460`, `pdf/table-parser.ts:1-257`, `pdf/index.ts:15-431`
  - Browser: `apps/web/src/lib/parser/types.ts:1-53`, `date-utils.ts:1-253`, `amount.ts:1-66`, `detect.ts:1-223`, `column-matcher.ts:1-130`, `csv.ts:1-872`, `json.ts:1-233`, `ofx.ts:1-185`, `html.ts:56-294`, `xlsx.ts:342-637`, `pdf.ts:19-623`
- **Deferred portion:** Replacing all remaining full browser CSV/JSON/OFX/HTML/XLSX orchestration and duplicate types with thin adapters over `@cherrypicker/parser/browser`.
- **Concrete rationale:** The root package entry currently imports `fs/promises` at `packages/parser/src/index.ts:1` and server PDF/LLM dependencies through `packages/parser/src/index.ts:7-10`. The web package currently has no parser dependency. Converting every format at once changes package exports, bundling boundaries, bank adapters, File/Buffer I/O, and the initial upload bundle while this batch is already correcting transaction integrity. Combining that migration with the correctness changes would make it harder to isolate semantic regressions. The affected pure behavior and all C1-017–C1-024 fixes are still shared now; only the unrelated adapter replacement remains.
- **Measurable exit criterion:** This deferral closes only when all of the following are true:
  1. `apps/web/src/lib/parser/` contains only browser I/O adapters/re-exports; it contains no independent date, amount, encoding, column, JSON, OFX, HTML, XLSX, or PDF text semantics.
  2. One conformance matrix covers CSV, XLSX, PDF-text, JSON, OFX, and HTML through server and browser adapters and asserts identical normalized transactions/errors.
  3. `rg` finds no duplicate definitions of `parseDateStringToISO`, amount normalization, `SUMMARY_ROW_PATTERN`, header keyword sets, PDF text patterns, or encoding selection outside the shared package.
  4. `bun run build` proves the browser subpath pulls in none of `node:fs`, `pdf-parse`, `unpdf`, or `@anthropic-ai/sdk`.
  5. The production upload-route bundle grows by no more than 5% from the baseline unless the increase is measured and approved.
  6. No new parser format or semantic feature is added before this exit criterion is completed; fixes may still proceed through the shared kernels.

## Gate commands

Run gates in this order. A failure is recorded with its command/output, fixed if caused by this batch, and does not terminate the outer review/plan/fix cycle.

### Focused correctness gates

```sh
bun test packages/parser/__tests__/conformance packages/parser/__tests__/amount.test.ts packages/parser/__tests__/detect.test.ts packages/parser/__tests__/html.test.ts packages/parser/__tests__/xlsx.test.ts packages/parser/__tests__/xlsx-parity.test.ts packages/parser/__tests__/table-parser.test.ts packages/parser/__tests__/pdf-parity.test.ts packages/parser/__tests__/json.test.ts
bun test apps/web/__tests__/amount.test.ts apps/web/__tests__/parser-encoding.test.ts apps/web/__tests__/parser-html.test.ts apps/web/__tests__/parser-pdf.test.ts apps/web/__tests__/parser-json.test.ts
bun test tools/cli/__tests__/commands.test.ts
bun test packages/core/__tests__/calculator.test.ts
```

### Package and repository gates

```sh
bun run lint
bun run typecheck
bun run test
bun run build
git diff --check
```

### Static browser-boundary checks

```sh
rg -n "node:fs|fs/promises|pdf-parse|unpdf|@anthropic-ai/sdk" packages/parser/src/browser.ts packages/parser/src/shared
rg -n "fallbackAmountPattern|detectBestEncoding|lastAmount|lastDate" apps/web/src/lib/parser
```

The first command must return no matches. Matches from the second command are permitted only for adapter references/comments proven not to define duplicate behavior; production duplicate definitions fail the gate.

## Browser process hygiene

This batch does not require Playwright. If an outer full gate runs `bun run test:e2e`:

1. Before the run, inspect port 4173 and candidate processes.
2. Resolve each candidate PID's command and working directory. Terminate only processes whose command or cwd belongs to `/Users/hletrd/flash-shared/cherrypicker`; do not terminate interactive Chrome or the unrelated Travelback session.
3. Start the E2E command in a tracked process group/PID, capture failure without aborting the cycle, and in a `finally`/shell trap send `TERM` to that owned group.
4. After a bounded wait, use `KILL` only for still-live PIDs already verified as repository-owned.
5. Recheck that port 4173 is clear and no repository-owned Playwright/Chrome/Chromium/preview process remains before the next cycle.

## Acceptance criteria

- [x] Dirty amount/store work is preserved; no unrelated file is reverted.
- [x] Browser-safe shared imports contain no Node/PDF/LLM server dependencies.
- [x] C1-017: ISO-looking HTML dates produce valid ISO dates in both runtimes; invalid dates are not appended.
- [x] C1-018: ordinary note/spacer rows cannot inherit fields; only actual merge coverage resolves blank cells.
- [x] C1-019: parentheses, `마이너스`, full-width minus, and trailing minus remain negative and never enter positive spending.
- [x] C1-020: PDF per-row values are read only after final indices are resolved.
- [x] C1-021: realistic BOM-free CP949 Korean CSV bytes decode and parse identically on server and web.
- [x] C1-022: every missing date/amount XLSX header produces a targeted error rather than silent empty success.
- [x] C1-023: parser outputs and reward outputs contain no unsafe, `NaN`, or infinite amount.
- [x] C1-024: all CLI commands attempt local PDF parsing before consent; remote retry occurs only after typed need plus authorization.
- [x] C1-025: every touched semantic kernel is shared and conformance-tested; only the precisely bounded full-adapter migration remains deferred.
- [x] Scope-focused tests, package tests, typechecks, web build, static checks, and scoped `git diff --check` pass.
- [x] Whole-repository pinned lint/typecheck/test/build, Vitest, bundle/artifact, and scoped browser gates pass in the outer cycle.
- [x] No deployment occurred.
- [x] E2E was not run and no browser/preview process was started by this work.

## ID coverage

| Aggregate ID | Severity / confidence | Plan tasks | Completion evidence |
|---|---|---|---|
| C1-017 | High / High | Tasks 1–2 | Shared date coercer; server/web ISO HTML fixture; invalid-date exclusion |
| C1-018 | High / High | Tasks 1–2 | Merge-provenance helper; note/spacer and real-merge fixtures; unsafe expectation rewrites |
| C1-019 | High / High | Tasks 1 and 3 | Complete signed token helper; actual PDF text output matrix; copied regex tests removed |
| C1-020 | High / High | Tasks 1 and 3 | Final-layout/value helper; shifted-column fixture; one shared PDF text parser |
| C1-021 | High / High | Tasks 1 and 4 | Strict UTF-8/CP949 decoder; realistic shared byte fixtures; full CSV parse |
| C1-022 | Medium / High | Task 2 | Date/amount required-column guard in both XLSX adapters; targeted-error fixtures |
| C1-023 | Medium / High | Tasks 1 and 5 | Safe numeric parser matrix; JSON/XLSX adapter errors; core fail-fast tests |
| C1-024 | Medium / High | Task 6 | Typed `REMOTE_LLM_REQUIRED`; shared local-first CLI orchestrator; call-order tests |
| C1-025 | High / High | Tasks 1, 3, and 7 | Shared affected kernels and conformance now; exact architecture deferral and measurable exit criteria |

## Implementation-file diff check

After implementation, run:

```sh
git diff --check -- .context/plans/69-cycle1-parser-cli-integrity.md
git status --short -- .context/plans/69-cycle1-parser-cli-integrity.md
```

Expected implementation result: this plan plus the scoped parser, web-parser, and
CLI source/test changes are present; unrelated dirty work remains untouched.
