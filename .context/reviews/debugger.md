# Debugger Review — Cycle 1

**Reviewer:** debugger
**Date:** 2026-07-23
**Scope:** Parser edge cases, async failure paths, categorization state, month selection, and numeric integrity
**Result:** 8 findings: 6 High, 2 Medium

## Findings

### DBG-01 — PDF fallback strips two common negative markers before parsing

- **Severity:** High
- **Confidence:** 0.99
- **Status:** Confirmed by focused regex/amount execution in both duplicated implementations
- **Locations:** `packages/parser/src/pdf/index.ts:307-315`; `packages/parser/src/pdf/index.ts:335-382`; `apps/web/src/lib/parser/pdf.ts:527-542`; `apps/web/src/lib/parser/pdf.ts:561-598`

The fallback regex matches parenthesized and `마이너스` negative amounts, but the selected capture group contains only the digits. `parseAmount()` receives `1,234`, not `(1,234)` or `마이너스1,234`, so the refund becomes a positive purchase. Full-width prefix minus and trailing minus remain in their captures and work, making the bug format-specific.

**Failure scenario:** A fallback-scanned line `2026-07-01 환불가맹점 (50,000)` is returned as a +50,000 won transaction and enters optimization instead of being skipped as a refund.

**Fix:** Parse the entire matched token after removing only currency wrappers/suffixes, or reattach the sign based on the matched alternative. Add end-to-end fallback tests for parentheses, `마이너스`, full-width minus, trailing minus, and ordinary positives in both server and web parsers.

### DBG-02 — Structured PDF row fallback changes indices after caching stale cell values

- **Severity:** High
- **Confidence:** 0.99
- **Status:** Confirmed by direct control-flow inspection
- **Locations:** `packages/parser/src/pdf/index.ts:93-125`; `packages/parser/src/pdf/index.ts:193-206`; `apps/web/src/lib/parser/pdf.ts:294-321`; `apps/web/src/lib/parser/pdf.ts:386-405`

Both implementations read `dateValue` and `amountValue` using header-derived indices, then detect that a particular row has shifted columns and update `dateIdx`/`amountIdx`. Date parsing later rereads the updated cell, but amount parsing uses the old cached `amountValue`; the early `dateValue` guard is stale too.

**Failure scenario:** A PDF header says amount is column 4, while a split/merged row places it in column 3. The heuristic finds column 3, but the parser still parses column 4 and either drops the row or records the wrong amount.

**Fix:** Resolve and validate per-row indices before reading values, or retain and use the `dateCell.value`/`amountCell.value` returned by the heuristic. Add a shifted-row table fixture to both parser suites.

### DBG-03 — Server-side CP949 detection misclassifies ordinary Korean CSV bytes as UTF-8

- **Severity:** High
- **Confidence:** 0.99
- **Status:** Confirmed by a realistic CP949-encoded Korean header execution
- **Locations:** `packages/parser/src/detect.ts:22-55`; `packages/parser/src/detect.ts:58-73`; `packages/parser/src/index.ts:54-65`; `apps/web/src/lib/parser/index.ts:40-64`

The detector counts a CP949 signal only when a `0x80-0xBF` byte follows ASCII. Ordinary Korean CP949 characters are high-byte pairs, so that condition usually contributes zero and the detector returns UTF-8. In a focused run, CP949 bytes for `이용일,가맹점,이용금액` were detected as UTF-8 and decoded as mojibake; `TextDecoder("euc-kr")` decoded them correctly. The web parser already uses a different replacement-character comparison.

**Failure scenario:** A common Korean CP949 CSV loses recognizable headers and bank keywords, then fails parsing or silently falls into generic detection.

**Fix:** Prefer strict/fatal UTF-8 validation; if the byte stream is not valid UTF-8, decode as CP949. If ambiguity remains, compare replacement-character counts. Add realistic CP949 files, including short and BOM-free inputs.

### DBG-04 — XLSX files with a plausible partial header silently return no transactions and no errors

- **Severity:** Medium
- **Confidence:** 0.99
- **Status:** Confirmed by focused in-memory workbook execution
- **Locations:** `packages/parser/src/xlsx/index.ts:240-284`; `packages/parser/src/xlsx/index.ts:445-459`; `apps/web/src/lib/parser/xlsx.ts:412-457`; `apps/web/src/lib/parser/xlsx.ts:620-636`

Header detection accepts keywords from two categories, but neither implementation verifies that required date and amount columns were found. With headers `날짜, 가맹점` and one data row, the web parser returned exactly `{ transactions: 0, errors: [] }` in a focused execution. The server path has the same missing guard.

**Failure scenario:** A changed bank export omits or renames the amount header. Analysis reports an empty parse without explaining that a required column was missing.

**Fix:** Immediately require `dateCol !== -1` and `amountCol !== -1` after column matching and return a targeted `ParseError` naming missing columns. Add web/server tests for date-only, amount-only, and multi-sheet partial headers.

### DBG-05 — Card-data timeout or cross-caller cancellation can produce a successful zero-card optimization

- **Severity:** High
- **Confidence:** 0.98
- **Status:** Confirmed async data-flow defect
- **Locations:** `apps/web/src/lib/cards.ts:135-184`; `apps/web/src/lib/cards.ts:225-234`; `apps/web/src/lib/analyzer.ts:191-218`; `apps/web/src/lib/analyzer.ts:276-280`

The internal ten-second timeout aborts the shared controller, but all `AbortError`s are swallowed into `undefined`. `getAllCardRules()` converts that into `[]`; analysis then permits empty `coreRules` and returns the greedy optimizer's zero-reward result. A later caller's signal is also chained to the same shared controller, so an unrelated component unmount can abort analysis's shared fetch.

**Failure scenario:** The card grid starts loading, analysis joins the in-flight request, and grid unmount aborts it. Analysis completes with no recommendations and zero reward instead of reporting data unavailability.

**Fix:** Distinguish internal timeout from caller cancellation and propagate failures to analysis. Never accept zero card rules as a valid full-catalog optimization. Isolate each caller's cancellation from the shared underlying fetch, for example by racing only that caller's await.

### DBG-06 — Raw bank category fallback flattens leaf IDs into impossible top-level categories

- **Severity:** High
- **Confidence:** 0.99
- **Status:** Confirmed by focused matcher execution; existing test locks the defect
- **Locations:** `packages/core/src/categorizer/taxonomy.ts:113-126`; `packages/core/src/categorizer/matcher.ts:109-120`; `packages/core/__tests__/categorizer.test.ts:229-240`; `packages/core/src/calculator/reward.ts:69-71`

`getAllCategories()` flattens parent and child IDs into one set. The raw-category fallback therefore treats a known child such as `cafe` as `{ category: "cafe" }` rather than `{ category: "dining", subcategory: "cafe" }`. A focused run also showed that the fully qualified `dining.cafe` form is rejected as unknown. Exact reward matching cannot use the flattened result.

**Failure scenario:** An unknown merchant with bank-supplied raw category `cafe` is assigned a category that no canonical cafe reward can match, even though the taxonomy contains the parent relation.

**Fix:** Build a canonical lookup from each accepted token to `{ parent, subcategory? }`. Accept qualified IDs and unambiguous leaf IDs, reject ambiguous leaves, and update the test to assert the canonical pair.

### DBG-07 — “Previous month” means previous uploaded month, not the previous calendar month

- **Severity:** High
- **Confidence:** 0.98
- **Status:** Confirmed control-flow defect
- **Locations:** `apps/web/src/lib/analyzer.ts:407-419`; `apps/web/src/lib/store.svelte.ts:585-610`

Both initial analysis and reoptimization sort the months present in the upload and choose the preceding entry. They do not calculate the calendar predecessor of the latest month.

**Failure scenario:** A statement set contains January and March but no February. January spending is treated as March's “previous month” performance, potentially unlocking tiers that should use February's absent/zero/explicit value.

**Fix:** Compute the exact preceding `YYYY-MM` with year rollover and look up only that key. When it is missing, use the explicit user value or a clearly disclosed default; do not substitute an older uploaded month. Add January/March and January/December rollover tests.

### DBG-08 — Numeric JSON/XLSX amounts can exceed the safe-integer boundary

- **Severity:** Medium
- **Confidence:** 0.99
- **Status:** Confirmed numeric-integrity defect
- **Locations:** `packages/parser/src/json/index.ts:85-96`; `apps/web/src/lib/parser/json.ts:85-92`; `packages/parser/src/amount.ts:15-30`; `packages/parser/src/csv/shared.ts:180-191`

String amount parsing rejects values beyond `Number.MAX_SAFE_INTEGER`, but raw numeric JSON and XLSX cells are accepted whenever finite, then rounded. JSON has already irreversibly rounded a literal such as `9007199254740993` to `9007199254740992` before this check.

**Failure scenario:** A malformed or hostile numeric amount is silently changed and retained, corrupting totals and comparisons rather than producing a parse error.

**Fix:** Require `Number.isSafeInteger()` after rounding (and apply the same absolute bound as string parsing) for every numeric entry point. Add parity tests for numeric and string values at, below, and above the safe boundary.

## Coverage and final sweep

- Inventory traversed: `packages/core` 27 files, `packages/parser` 60, `packages/rules` 714, `packages/viz` 8, `tools/cli` 10, `tools/scraper` 20, `apps/web` 60, `scripts` 1, and `.github` 1, plus root workspace/configuration files.
- Parser implementations and their web duplicates were compared across CSV, JSON, OFX, HTML, XLSX, PDF, amount/date normalization, detection, and analyzer/store handoff.
- Focused executions reproduced the negative-capture behavior, CP949 misdetection, raw-category flattening, and silent XLSX partial-header result.
- A final sweep checked test intent, async error propagation, date/month edge cases, and numeric boundaries. No additional actionable finding survived evidence verification.
- No browser or E2E test was launched, so this reviewer created no Playwright/Chrome process requiring cleanup.
