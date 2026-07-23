# Cycle 2 — Verifier

**Review target:** `a9d3c99d52dcacd6e48eede07bb7208af4acb7a2`
**Lens:** verify Cycle 1 closure claims at real consumer boundaries and against checked-in catalog data.

## Inventory and coverage

All **1,041 relevant tracked source/config/test/doc/data artifacts** were inventoried: root 15; web 115; E2E 9; core 29; parser 75; rules code/registries/tests 22; card catalog 707; viz 8; scripts 16; CLI 13; scraper 32. Every one of the 683 card YAMLs was exercised by the full schema/semantic suite and whole-catalog queries. Historical `.context` reviews/plans were excluded except the current Cycle 1 aggregate and implementation records used for closure comparison.

## Findings

### C2-V-001 — The analyzer hides the targeted zero-row parser errors added in Cycle 1

- **Severity:** Medium
- **Confidence:** High
- **Classification:** confirmed
- **Location:** `apps/web/src/lib/analyzer.ts:51-65,315-359`; representative targeted parser path `apps/web/src/lib/parser/xlsx.ts:349-380`
- **Scenario:** Upload an XLSX with a plausible header but no date or amount column. The parser returns `필수 컬럼을 찾을 수 없습니다: 날짜, 금액`, but the UI receives only `거래 내역을 찾을 수 없어요` (and, at the aggregate boundary, possibly just the filename).
- **Evidence:** `parseAndCategorize()` throws a generic error as soon as `transactions.length === 0`, before returning `parseResult.errors`. The file queue therefore records the generic rejection rather than the targeted parser diagnostics. This also affects zero-row CSV/HTML/JSON/OFX results. It is a remaining integration failure behind Cycle 1's targeted-XLSX-error parser fix, not a re-report of that parser bug.
- **Suggested fix:** If zero transactions have parser errors, propagate the first actionable error or return a zero-row outcome whose errors the aggregate can attach to the file. Reserve the generic message for genuinely error-free empty input. Add a `parseAndCategorize()`/upload integration test, not only parser-unit coverage.

### C2-V-002 — Merchant allowlists are case-sensitive while the categorizer contract is normalized

- **Severity:** Medium
- **Confidence:** High
- **Classification:** likely
- **Location:** `packages/core/src/calculator/reward.ts:102-107`; representative supported data `packages/rules/data/cards/hyundai/m-boost.yaml:67-93`
- **Scenario:** A bank export spells the cinema merchant as `cgv` or `Cgv`. Categorization still recognizes the merchant, but Hyundai M BOOST's supported `specificMerchants: [CGV, ...]` rule misses and returns no special reward.
- **Evidence:** Runtime uses raw `tx.merchant.includes(merchant)` with no shared normalization. Full-catalog audit found 127 supported allowlist entries containing Latin characters, including `CGV`, `AliExpress`, `S-OIL`, `PAYCO`, and mixed-case forms. The exact casing present in every issuer export needs fixture validation, hence “likely,” but the inconsistent matcher behavior is deterministic.
- **Suggested fix:** Reuse the canonical merchant normalization pipeline (Unicode normalization, case folding, whitespace/punctuation policy) for both transaction and allowlist tokens. Add mixed-case real-card tests and bank-export fixtures before deciding whether substring matching itself is sufficiently precise.

### C2-V-003 — Browser validation accepts authored-shape catalog JSON that becomes non-finite at runtime

- **Severity:** High
- **Confidence:** High
- **Classification:** manual-validation risk
- **Location:** `apps/web/src/lib/card-catalog-reader.ts:31-53`; `packages/rules/src/schema.ts:80-164`; consumer `apps/web/src/lib/cards.ts:309-319`
- **Scenario:** Serve a schema-valid optimizer payload with optional tier fields omitted. Validation succeeds, but because the raw graph is retained instead of Zod's canonical projection, calculator null checks receive `undefined` and can yield `NaN`.
- **Evidence:** Reproduction with canonical `shinhan-simple-plan` source minus only the optional normalized fields passed `readOptimizerCatalog()`; an applicable domestic transaction produced `totalReward: NaN`. Current checked-in `cards-optimizer.json` contains the normalized fields, so the tracked artifact passes; version skew or a future publisher is the unresolved boundary.
- **Suggested fix:** Return Zod's parsed values, or enforce a separate strict serialized-artifact schema with required normalized fields. Add a version-skew fixture and `Number.isFinite` assertions at the optimizer boundary.

## Verification results

- `bun test`: **2,196 passed, 0 failed, 7,202 assertions, 73 files**. Executed with installed Bun 1.3.12 rather than pinned Bun 1.2.6.
- Focused cross-boundary tests: **194 passed, 0 failed**.
- Verified catalog facts: 683 cards; five supported `rate + unit:miles` rules; 124 supported payment-type rules; 10 supported channel rules; 17 supported fuel rules; 577 cards with non-category statement-tag exclusions.
- Final missed-issue sweep covered each Cycle 1 plan's declared acceptance boundaries, generated artifacts, user-facing error propagation, consumer normalization, and real-card reachability. No further verifier finding met the confidence threshold.
