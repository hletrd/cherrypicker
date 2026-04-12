# Overall verdict: **Low release confidence**

Recent parser changes materially outpaced the automated test surface. The repo has decent unit coverage for a few core paths, but it does **not** currently protect the highest-risk areas: XLS/XLSX parsing, browser/server parser parity, expanded bank detection, encoding fallbacks, and release-time verification. I would not ship parser-heavy changes without adding targeted regression coverage first.

## What is tested vs untested

### Covered reasonably
- **Core reward/optimizer happy paths**: `packages/core/__tests__/calculator.test.ts`, `packages/core/__tests__/optimizer.test.ts`
- **Category matching basics**: `packages/core/__tests__/categorizer.test.ts`
- **Rules schema loading**: `packages/rules/__tests__/schema.test.ts`
- **A narrow slice of parser CSV behavior**: KB / Samsung / Shinhan fixtures in `packages/parser/__tests__/csv.test.ts:12-195`
- **A narrow slice of detection behavior**: selected bank signatures and CSV delimiter detection in `packages/parser/__tests__/detect.test.ts:5-132`

### Largely untested / unprotected
- **All web app behavior**: no test files under `apps/web`
- **All CLI behavior**: no test files under `tools/cli`
- **All scraper behavior**: no test files under `tools/scraper`
- **All viz behavior**: no test files under `packages/viz`
- **Parser XLS/XLSX paths**: no dedicated parser tests for `packages/parser/src/xlsx/index.ts:97-250`
- **Browser parser parity**: no tests for `apps/web/src/lib/parser/index.ts:13-55`, `apps/web/src/lib/parser/detect.ts:107-160`, or `apps/web/src/lib/parser/xlsx.ts:268-415`
- **Most bank-specific CSV adapters**: only three fixture-backed banks are exercised despite many adapters in `packages/parser/src/csv/index.ts:16-27`

## Severity buckets

### Critical

1. **Release pipeline does not gate on tests, lint, or type safety**
   - The only GitHub workflow is a Pages deploy that checks out, installs, and builds the web app; it does not run `test`, `lint`, or any repo-wide validation first: `.github/workflows/deploy.yml:17-40`.
   - Root scripts advertise `build`, `test`, and `lint`, but those protections are not enforced in CI: `package.json:9-19`.
   - Shipping risk: parser regressions can merge and deploy with zero automated release gate.

2. **Local verification path is brittle / currently broken in this environment**
   - The repo is pinned to Bun as the package manager: `package.json:27`.
   - Observed reliability issue: `npx turbo run build` and `npx turbo run lint` both failed with `Unable to find package manager binary: cannot find binary path` because Bun is not available.
   - Shipping risk: if the primary build/test entrypoints are this environment-sensitive, release confidence depends too heavily on individual machine setup.

### High

1. **Parser regression coverage is far too narrow for the recent XLS/XLSX changes**
   - There are only three parser fixtures, all CSV: `packages/parser/__tests__/fixtures/sample-kb.csv`, `sample-samsung.csv`, `sample-shinhan.csv`.
   - There are **no** parser XLS/XLSX fixtures or tests despite substantial logic in `packages/parser/src/xlsx/index.ts:14-250`.
   - Untested high-risk branches include:
     - HTML-as-XLS detection: `packages/parser/src/xlsx/index.ts:14-22`, `104-110`
     - malformed HTML normalization: `packages/parser/src/xlsx/index.ts:19-22`
     - multi-sheet first-success selection: `packages/parser/src/xlsx/index.ts:116-128`
     - header scan across long preambles: `packages/parser/src/xlsx/index.ts:168-180`
     - zero-amount row skipping: `packages/parser/src/xlsx/index.ts:228-230`
     - Korean short-date year inference: `packages/parser/src/xlsx/index.ts:62-67`
     - parenthesized negative amounts: `packages/parser/src/xlsx/index.ts:77-84`

2. **Browser parser duplicates server parser logic, but there is zero parity coverage**
   - The browser parser reimplements detection and XLSX parsing in `apps/web/src/lib/parser/detect.ts` and `apps/web/src/lib/parser/xlsx.ts` instead of reusing the package parser.
   - This duplication has already drifted:
     - server parses parenthesized negatives in XLSX amounts: `packages/parser/src/xlsx/index.ts:77-84`
     - browser parser does **not**: `apps/web/src/lib/parser/xlsx.ts:230-236`
     - server bank column configs for newer banks differ from browser configs (`packages/parser/src/xlsx/adapters/index.ts:83-163` vs `apps/web/src/lib/parser/xlsx.ts:89-172`)
   - With no `apps/web` tests at all, parser fixes can land in one runtime and silently regress in the other.

3. **Expanded bank detection is only partially protected**
   - The parser now declares many more bank IDs/signatures: `packages/parser/src/types.ts:1-2`, `packages/parser/src/detect.ts:10-106`.
   - Detection tests only cover a subset of them: `packages/parser/__tests__/detect.test.ts:6-78`.
   - Missing regression tests for at least: `kakao`, `toss`, `kbank`, `bnk`, `dgb`, `suhyup`, `jb`, `kwangju`, `jeju`, `sc`, `mg`, `cu`, `kdb`, `epost`.
   - Shipping risk: new signatures can false-positive or simply stop matching without any test failure.

4. **Most bank-specific CSV adapters have no direct regression protection**
   - `parseCSV` wires 10 adapters: `packages/parser/src/csv/index.ts:16-27`.
   - Fixture-backed tests only validate KB, Samsung, and Shinhan: `packages/parser/__tests__/csv.test.ts:12-195`.
   - No direct fixtures/tests exist for Hyundai, IBK, Woori, Lotte, Hana, NH, or BC adapters even though each contains bank-specific header parsing and row-shaping logic.
   - Shipping risk: a header rename or parser tweak in one adapter can break a bank-specific import with no failing test.

5. **Parser fallback behavior is not observable enough when adapters fail**
   - `parseCSV` silently swallows adapter failures and falls back to generic parsing: `packages/parser/src/csv/index.ts:38-62`.
   - There are no tests asserting when fallback occurs, whether warnings are surfaced, or whether bank-specific data is lost during fallback.
   - Shipping risk: bad bank-specific parses can degrade into “successful” generic parses that look valid enough to escape detection.

### Medium

1. **Encoding fallback paths are effectively untested**
   - Server CSV decoding has UTF-8 → EUC-KR fallback heuristics: `packages/parser/src/index.ts:33-47`.
   - Browser CSV decoding tries `utf-8`, `euc-kr`, `cp949`: `apps/web/src/lib/parser/index.ts:18-40`.
   - No fixtures exist for EUC-KR / CP949 / mojibake repair, and no tests cover these branches.
   - These are exactly the sorts of real-world statement imports that tend to fail first.

2. **Fixture realism is weak for parser reliability work**
   - Existing parser fixtures are small, clean CSV samples. They do not appear to cover:
     - quoted merchants with embedded commas/newlines
     - duplicate header rows / bank preambles
     - refunds / negative rows
     - zero-value authorization rows
     - statement summaries interleaved with transactions
     - malformed HTML-as-XLS exports
     - mixed date formats in one file
   - The generic parser contains heuristics for many of these messy cases (`packages/parser/src/csv/generic.ts:104-209`), but the tests do not validate them.

3. **Core calculator tests are not strong enough as business-rule regression tests**
   - `packages/core/__tests__/calculator.test.ts:48-70` contains a long comment trail showing uncertainty around rate semantics, then asserts current implementation behavior anyway.
   - That means the test is protecting ambiguous code behavior rather than a clearly defined product expectation.
   - This is useful for detecting code drift, but weaker for catching silent business logic defects.

4. **Rules tests have some brittle assertions and weak failure signaling**
   - `packages/rules/__tests__/schema.test.ts:191-217` hardcodes an exact total rule count (`145`), which is brittle for normal catalog growth.
   - `loadAllCardRules` downgrades parse failures to warnings rather than failing fast: `packages/rules/src/loader.ts:32-45`.
   - Together, this makes the signal noisy: harmless catalog changes can break tests, while individual rule parse failures may only log warnings.

5. **CLI and scraper are effectively unshipped from a test perspective**
   - CLI entry and commands: `tools/cli/src/index.ts:39-77`, `tools/cli/src/commands/analyze.ts:14-80`, `tools/cli/src/commands/optimize.ts:18-113`
   - Scraper entry: `tools/scraper/src/cli.ts:19-125`
   - There are no tests for argument parsing, missing-file handling, warning output, integration with parser/core/rules, or error paths.

## Missing tests that should exist now

1. **Parser XLS/XLSX golden tests**
   - Real fixture coverage for:
     - native `.xlsx`
     - legacy `.xls`
     - HTML disguised as `.xls`
     - multi-sheet workbooks
     - sheet with long preamble before headers
     - refunds / parenthesized negatives
     - summary rows mixed with real rows

2. **Bank detection matrix tests for every declared bank ID**
   - One positive and one negative/anti-collision case per signature in `packages/parser/src/detect.ts:10-106`.

3. **CSV adapter fixture tests for every wired adapter**
   - Hyundai / IBK / Woori / Lotte / Hana / NH / BC at minimum.
   - Each should assert headers, date normalization, amount parsing, installment extraction, and category/memo retention where relevant.

4. **Browser/server parser parity tests**
   - Same fixture should produce equivalent parse output from:
     - `packages/parser/src/xlsx/index.ts`
     - `apps/web/src/lib/parser/xlsx.ts`
   - Same for CSV detection/decoding.

5. **Encoding regression tests**
   - EUC-KR and CP949 fixtures with expected merchant/category strings.
   - A mojibake fixture validating fallback behavior in both browser and server paths.

6. **Fallback observability tests**
   - Assert that bank-specific parser failure is surfaced clearly instead of silently degrading via `parseGenericCSV` in `packages/parser/src/csv/index.ts:38-62`.

7. **CLI smoke/integration tests**
   - `analyze`, `optimize`, and `report` should have at least one end-to-end happy-path test using a fixture statement.
   - Error-path tests for missing file, invalid bank override, empty rules dir, and parser warnings.

8. **Release workflow test gate**
   - CI should run build + test + typecheck before deployment.
   - Today there is no automated proof that the parser changes are releasable.

## Confidence blockers for shipping

- No CI gate for tests/lint/typecheck before deploy.
- No automated XLS/XLSX regression suite despite recent large parser changes.
- No browser/server parser parity coverage even though logic is duplicated and already diverged.
- No tests for most bank adapters or newly added bank signatures.
- Local verification depends on Bun being installed correctly; current repo entrypoints are not resilient when that assumption fails.

## Bottom line

The repo has enough tests to catch some obvious core regressions, but not enough to trust the parser changes that matter most. The biggest missing protection is **real fixture-driven parser regression testing across both server and web runtimes**. Until that exists — and until CI actually blocks bad builds — release confidence remains low.
