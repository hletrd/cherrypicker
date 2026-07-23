# Cycle 5 — Code Reviewer

**Review target:** `e3aa4241bbdc9c9b1dc3abff0df78e0cc9f8d715`
**Comparison base:** `e6fe49bb5d981d422f5b55bd855e87f0234ac13e` (`origin/main`)
**Lens:** code quality, logic, SOLID boundaries, failure atomicity, and maintainability. This was a read-only review; no source, test, plan, generated artifact, or git state was changed.

## Inventory and coverage

I built the inventory before reviewing implementation. After excluding historical `.context/**` work products, `.omc/**`, `bun.lock`, and the three vendored archive files, the current review universe contains **1,107 tracked artifacts**:

| Area | Files | Coverage |
| --- | ---: | --- |
| Root policy, workflow, manifests, configuration, and docs | 14 | Direct inspection |
| `apps/web` | 142 | All runtime/component/config/test paths inventoried; upload, parsing, optimization, persistence, fallback, and report flows traced |
| `e2e` | 15 | All specs, fixtures, and screenshots inventoried; relevant assertions and both tracked screenshots inspected |
| `packages/core` | 34 | All production/test modules inspected; categorization → performance basis → reward → optimizer traced |
| `packages/parser` | 83 | All server/browser kernels, adapters, tests, and fixtures inventoried; format/encoding parity exercised |
| `packages/rules` | 732 | All code/tests inspected; all 683 YAML rules and 24 issuer READMEs exercised by exhaustive schema/publication checks |
| `packages/viz` | 10 | Terminal and standalone-report paths/tests inspected |
| `scripts` | 18 | All build, publication, migration, dependency, bundle, E2E-process, and test paths inspected |
| `tools/cli` | 26 | All source/tests inspected; parser → catalog → optimization → output traced |
| `tools/scraper` | 33 | All source/config/targets/tests inspected; extraction → validation → durable write traced |

The large declarative catalog and generated JSON projections were not sampled: their complete populations were covered through the canonical loaders, Zod/domain validators, deterministic publication checks, source-hash parity, and focused full-catalog queries. Historical reports and completed plans were consulted first for closure; fixed Cycle 1–4 findings were not restated.

## Findings

### C5-CR-001 — Unknown previous-month merchants are treated as definitely eligible and can unlock excluded performance tiers

- **Severity:** High
- **Confidence:** High
- **Validation status:** Confirmed by direct execution and full data-flow tracing; no manual validation required
- **Location:** `packages/core/src/analysis/performance.ts:13-19,31-64,67-124`; `packages/rules/src/performance-exclusions.ts:42-47,108-132`; producers `packages/core/src/categorizer/matcher.ts:197-203,240-264`, `apps/web/src/lib/analyzer.ts:90-120,237-246,426-433`, and `tools/cli/src/analysis.ts:31-54,58-82`

`PerformanceSpendingTransaction` omits categorization confidence/provenance. For a category-based exclusion, `evaluatePerformanceExclusion()` returns `included` whenever the category string differs. That includes the matcher's explicit sentinel `{ category: "uncategorized", confidence: 0 }`; it is not treated as unknown even though its real category is unknown. This violates the surrounding fail-closed contract.

**Concrete failure scenario:** A previous-month statement contains a 300,000-won merchant the matcher cannot identify. The merchant is actually insurance, tuition, telecom, or utilities, all commonly excluded from performance. The current calculation counts the full 300,000 won, potentially qualifying a higher tier and overstating the current month's reward. Direct execution returned:

```text
calculatePerformanceSpending(
  [{ amount: 300000, category: "uncategorized" }],
  ["insurance"]
)
=> { amount: 300000, unknownExclusions: [] }
```

The scope is material: a full-catalog query found **237** cards with category-based performance exclusions, of which **226** also have a positive-spending tier. `bc-baro-clear-plus`, for example, has 150,000/300,000/500,000-won tiers and excludes utilities, apartment management, tuition, public transit, and telecom (`packages/rules/data/cards/bc/baro-clear-plus.yaml:14-42`).

**Suggested fix:** Carry category confidence or explicit category provenance into `PerformanceExclusionFacts`. Return `unknown` for category exclusions when the category is `uncategorized` or otherwise untrusted, preserving the existing whole-result fail-closed behavior. Treat a user-confirmed edit as known. Add core, web, and CLI regressions for confidence-0 previous-month transactions crossing a tier.

### C5-CR-002 — OFX, HTML, and HTML-as-XLS routes force UTF-8 and silently corrupt legacy Korean merchant text

- **Severity:** Medium
- **Confidence:** High
- **Validation status:** Confirmed in both server and browser-worker decoding paths by executable reproduction; an end-to-end real-browser fixture is still recommended
- **Location:** `packages/parser/src/statement.ts:110-136`; `apps/web/src/lib/parser/worker-protocol.ts:91-93`; callers `apps/web/src/lib/parser/index.ts:99-136` and `apps/web/src/lib/parser/workers/{json,ofx,html}-worker.ts`; HTML-as-XLS mirrors `packages/parser/src/xlsx/index.ts:35-41,75-87` and `apps/web/src/lib/parser/xlsx.ts:242-272`; canonical decoder `packages/parser/src/shared/encoding.ts:35-85`

CSV parsing uses the shared BOM/strict-UTF-8/CP949 decoder, but the other text routes bypass it. Server JSON/OFX/HTML use `Buffer.toString("utf-8")`; browser workers use `new TextDecoder("utf-8")`; both HTML-as-XLS paths decode their full buffer as UTF-8. This is particularly unsafe for Korean OFX 1.x files, whose header can explicitly declare `ENCODING:EUC-KR` and `CHARSET:949`, and for legacy HTML exports.

**Concrete failure scenario:** A valid CP949 OFX entry with `<NAME>스타벅스` and an `EUC-KR`/949 header returns a transaction with merchant `��Ÿ����`, no parse error, and format `ofx`. The shared decoder identifies the same bytes as `cp949` and returns `스타벅스`. The browser worker decoder produces the same mojibake as the server. Categorization then fails and the optimizer can recommend the wrong card without telling the user that text was corrupted.

**Suggested fix:** Route every byte-oriented text format through one browser-safe decoder. Honor BOMs plus declared OFX/HTML charset metadata, with strict detection as fallback; either explicitly reject unsupported JSON encodings or decode them consistently. Reuse `detectTextEncoding()`/`decodeTextBytes()` rather than maintaining UTF-8-only branches. Add CP949 and UTF-16 server/web parity fixtures for OFX, HTML, and HTML-as-XLS, including a merchant-category assertion.

### C5-CR-003 — Persisted transactions are only partially validated, so malformed optional facts survive reload and crash reoptimization

- **Severity:** Medium
- **Confidence:** High
- **Validation status:** Confirmed by an executable deserialize → performance-calculation reproduction; no manual validation required
- **Location:** `apps/web/src/lib/tx-validation.ts:9-24`; `apps/web/src/lib/persistence.ts:469-533,582-615`; `apps/web/src/lib/store.svelte.ts:360-423`; failure site `packages/rules/src/performance-exclusions.ts:108-132`

`isOptimizableTx()` validates the required scalar fields and fuel volume only. It does not validate `subcategory`, `confidence`, `installments`, `paymentType`, `channel`, `performanceExclusionTags`, or `factProvenance`. `deserializeAnalysis()` then treats every passing object as a complete `CategorizedTx`.

**Concrete failure scenario:** A stored transaction has `performanceExclusionTags: { annual_fee: true }`, which can arise from corrupted/stale serialized state. Deserialization accepts it with one transaction, `warningKind: null`, and `shouldRemove: false`. On reoptimization, `evaluatePerformanceExclusion()` assumes the truthy field is an array and calls `.includes()`, throwing:

```text
facts.performanceExclusionTags.includes is not a function
```

The same boundary also casts any plain `statementPeriod` object without checking `start`/`end` strings (`apps/web/src/lib/persistence.ts:589-597`), while formatters later assume date strings.

**Suggested fix:** Define one complete runtime schema for persisted `CategorizedTx` and period shapes, including optional enums, arrays, and provenance records. Reject the record or quarantine malformed rows with a visible corruption warning. Add deserialize → reoptimize tests for every optional field, not just amount/fuel boundaries.

### C5-CR-004 — Delimiter detection counts punctuation inside quoted fields and can reject an otherwise valid statement

- **Severity:** Medium
- **Confidence:** High
- **Validation status:** Confirmed through both server and browser production parsers; no manual validation required
- **Location:** `packages/parser/src/shared/delimiter.ts:12-34,37-80`; server delegation `packages/parser/src/detect.ts:183-185`; browser delegation `apps/web/src/lib/parser/detect.ts:207-209`; quote-aware splitters `packages/parser/src/csv/shared.ts:12-34` and `apps/web/src/lib/parser/csv.ts:27-45`

Delimiter selection counts every comma, tab, pipe, and semicolon in the first 30 physical lines, including characters inside quoted fields. The actual field splitters correctly honor quotes, so detection and parsing disagree.

**Concrete failure scenario:** This valid comma-delimited statement contains a quoted memo:

```csv
이용일,가맹점명,이용금액,메모
2026-07-01,카페,10000,"a;b;c;d;e;f;g;h;i;j"
```

Both production paths choose semicolon, parse zero transactions, and report the first row's comma-separated prefix as an unparseable amount. The inverse happens to a semicolon statement containing a comma-rich quoted merchant.

**Suggested fix:** Sample logical, quote-aware records and count only candidate delimiters outside quoted fields. Prefer a stable-column-count score across records rather than raw character totals. Add competing punctuation and multiline-quoted-field parity tests for server and browser routes.

### C5-CR-005 — Bank-specific CSV/XLSX adapters silently analyze rows without any merchant

- **Severity:** Medium
- **Confidence:** High
- **Validation status:** Confirmed in server and browser CSV paths; the mirrored XLSX control flow is confirmed statically and should receive a fixture test
- **Location:** `packages/parser/src/csv/adapter-factory.ts:78-125,127-175`; `apps/web/src/lib/parser/csv.ts:478-511,513-548`; `packages/parser/src/xlsx/index.ts:184-207,227-249,296-311`; `apps/web/src/lib/parser/xlsx.ts:358-380,401-423,474-490`

The generic CSV parser treats date, merchant, and amount as required, but bank-specific CSV and both XLSX implementations require only date and amount. If no merchant column is found, they substitute an empty string and emit no warning.

**Concrete failure scenario:** Parsing the Samsung CSV below in both server and browser paths returns one transaction with `merchant: ""` and `errors: []`:

```csv
이용일,이용금액
2026-07-01,10000
```

The analysis appears successful, but merchant categorization and merchant-specific rewards can never match. An unrecognized merchant header has the same effect across every row.

**Suggested fix:** Establish one required-field contract across generic CSV, bank CSV, and XLSX. If retaining date/amount-only rows is intentional, emit a bounded row/header warning and mark them explicitly incomplete; otherwise reject the header or row. Add server/web parity tests for a missing merchant header and blank merchant cells.

### C5-CR-006 — Reset treats failed durable deletion as success, allowing explicitly cleared data to return after reload

- **Severity:** Medium
- **Confidence:** High
- **Validation status:** Likely in a real browser; control flow is confirmed, but a browser policy-transition/manual validation remains pending
- **Location:** `apps/web/src/lib/store.svelte.ts:152-188,462-477`

`clearStorage()` catches every `sessionStorage.removeItem()` failure and returns `void`. `reset()` first invalidates work and clears the in-memory result, error, warning, and cached labels, then calls that best-effort helper without knowing whether the old serialized analysis was removed.

**Concrete failure scenario:** Storage deletion fails during reset because storage access is temporarily blocked or the document is sandboxed. The UI immediately looks empty, but the prior serialized financial analysis remains. If storage becomes accessible on the next load, `loadFromStorage()` accepts and restores the result the user explicitly cleared. This is distinct from the Cycle 4 replacement path, whose failed-clear branch is now guarded and tested.

**Suggested fix:** Make reset consume a `PersistResult` and require durable deletion before presenting reset as complete, or write a durable generation/tombstone protocol. If deletion fails, preserve the coherent in-memory result and show an actionable error. Add a reset-failure → reload regression using an injectable storage adapter, plus a real-browser manual check for the relevant storage policy.

### C5-CR-007 — Custom authoring catalogs and reward ties have no stable order

- **Severity:** Low
- **Confidence:** High
- **Validation status:** Tie sensitivity is confirmed by execution; cross-filesystem order variation is likely and should be manually validated on a second platform
- **Location:** `packages/rules/src/loader.ts:17-52`; authoring caller `tools/cli/src/card-catalog.ts:27-41`; tie handling `packages/core/src/optimizer/greedy.ts:97-107,305-315,359-374`

The recursive loader consumes `readdir()` order without sorting. CLI `--cards` authoring mode passes that array directly to the optimizer. Reward scores sort only by reward, and best-single replacement uses strict `>`, so equal-benefit cards retain filesystem enumeration order.

**Concrete failure scenario:** Two otherwise identical custom cards yield the same reward. Reversing their input order changes both `assignedCardId` and `bestSingleCard.cardId` while every monetary result remains equal. The checked-in compiled catalog is sorted, but the explicitly supported authoring path is not, so recommendations and reports can differ across filesystems or directory layouts.

**Suggested fix:** Sort collected YAML paths and/or parsed card IDs in the loader, and add an explicit ASCII `cardId` tie-breaker in both score ordering and best-single selection. Test a nested authoring tree created in reverse order.

## Verification and final missed-issue sweep

- Targeted parser, persistence, performance, optimizer, and disclosure run: **138 pass, 0 fail** across nine suites. These passes also demonstrate that the reproduced gaps are absent from current tests.
- `bun run data:check`: pass for all **683 cards / 24 issuers**, generated projections, and README catalog.
- `bun run migrations:check`: pass.
- `bun run dependencies:check`: pass.
- `git diff --check origin/main...HEAD`: pass.
- The host has Bun 1.3.12 while the repository pins 1.2.6, so this review did not claim a fresh pinned-toolchain umbrella verification; the checked-in Cycle 4 closure records the full HEAD gates.

The closing sweep revisited every parser format, numeric and safe-integer boundary, operation epoch/cancellation transition, storage mutation, taxonomy fallback, catalog loader/publication reader, CLI/scraper write path, output qualification, unsafe cast/catch, TODO, and test/fixture inventory. The two main candidates rejected after falsification were the old ILP-stub report (the public API now exposes only greedy) and prior Cycle 1–4 defects whose current regressions pass. No review-relevant file was skipped without the generated/data coverage described above.
