# Cycle 3 — Critic

**Review target:** `614ce5c`
**Lens:** challenge whether successful execution produces a complete, auditable, and truthfully qualified result at the user-visible boundary.

## Inventory and approach

The same 1,067-artifact non-historical inventory used by the Cycle 3 code review was covered. Particular attention went to the parser partial-success contract, calendar scoping, previous-spending provenance, unsupported-rule propagation, terminal/web/standalone-report parity, persistence, and the tests that claim those behaviors. All Cycle 1/2 closure records were compared first so fixed findings would not be restated.

## Findings

### C3-CT-001 — The durable HTML report strips the qualifications shown while it is generated

- **Severity:** High
- **Confidence:** High
- **Status:** confirmed
- **Location:** `tools/cli/src/commands/report.ts:90-102,124-151`; `tools/cli/src/disclosures.ts:11-59`; `tools/cli/src/analysis.ts:79-93`; `packages/viz/src/report/generator.ts:253-269`; `packages/viz/src/report/templates/report.html:180-212`; tests `packages/viz/__tests__/report.test.ts:56-119`
- **Concrete failure scenario:** A user generates a report from a multi-month statement containing rejected rows, has no exact previous-calendar-month statement, and has benefits excluded because required facts are absent. The terminal correctly says that rows/months were excluded, 0 won was assumed for previous spending, and some rules were not calculated. The saved or shared HTML presents exact-looking totals and recommendations but contains none of those qualifications.
- **Evidence:** `runReport()` prints parser warnings, `calendarScopeWarnings()`, previous-spending provenance, and `unsupportedRules` before calling `generateHTMLReport(result, latestTransactions, categoryLabels)`. The generator API has no parameter capable of carrying parse warnings, the full statement/calendar scope, or previous-spending basis; its template has only metrics/tables and a generic “참고용” footer. A generated result containing `missing_fuel_volume` produced HTML in which all probes were false: `missing_fuel_volume`, its detail, `전월실적 기준`, `계산 제한`, `분석 기간`, and `파싱 경고`. The report tests assert values, escaping, CSP, and branding only. This is a remaining artifact-boundary defect, not a re-report of the fixed Cycle 1 terminal disclosure.
- **Suggested fix:** Define one typed report context containing statement/latest month, full versus included counts, parser/calendar exclusions, previous-spending basis, and deduplicated unsupported issues. Pass it into the generator and render a prominent “분석 범위와 제한” section in the standalone artifact. Add CLI integration and generator tests proving each qualification survives after the terminal is gone.

### C3-CT-002 — JSON partial success can discard most input rows while reporting zero warnings

- **Severity:** Medium
- **Confidence:** High
- **Status:** confirmed
- **Location:** `packages/parser/src/json/index.ts:90-129,202-253`; duplicate browser path `apps/web/src/lib/parser/json.ts:86-121,185-234`; tests `packages/parser/__tests__/json.test.ts:118-127,184-188`; `apps/web/__tests__/parser-json.test.ts:92-101,164-174`
- **Concrete failure scenario:** A five-entry JSON transaction export has one valid transaction, two objects missing a required date/amount, a scalar corruption row, and `null`. Analysis succeeds using one row and shows no parse warning, so the user has no indication that 80% of the selected transaction array was omitted.
- **Evidence:** Objects lacking either required field return `null` before an error is emitted; `null`, arrays, and all non-object elements are skipped by `continue`. The executable input described above returned `{"inputRows":5,"parsedRows":1,"errors":[]}`. Tests explicitly lock the silent behavior, including the statement that null/undefined are “valid missing amount indicators.” Once the parser has selected a direct array or a recognized `transactions`/`records` wrapper, however, those entries are the asserted transaction collection; silently losing members contradicts the UI's partial-success warning model in `apps/web/src/components/ui/AnalysisWarnings.svelte:26-66`.
- **Suggested fix:** Emit one bounded row-level `ParseError` for every selected-array entry that is not a transaction object or lacks a required date/amount. Preserve permissive wrapper discovery, but do not treat malformed members of the selected transaction array as out-of-band metadata. Add server/web parity tests that assert input count = accepted count + explicitly reported rejected count, including warning compaction for large files.

## Adversarial closure sweep

I tried to falsify the two findings against the web report path, parser tests, and Cycle 1/2 records. The web report does preserve parse warnings and calculation disclosures through `AnalysisWarnings.svelte` and `ReportContent.svelte`; the defect is specifically the CLI-generated standalone artifact. JSON does report invalid typed amounts and invalid dates; the gap is specifically missing/non-object members. No additional Critic finding survived this boundary check.
