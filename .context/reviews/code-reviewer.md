# Overall verdict

**REQUEST CHANGES.** The recent parser work solves a real problem (HTML-as-`.xls` exports), but the repo still has multiple correctness failures that are worse than normal polish issues. The highest-risk problems are not stylistic: the reward engine is structurally incapable of honoring a large chunk of the rule data, and the parser/detection changes introduce silent misclassification and silent row loss.

Brief positive note: the HTML-as-XLS path and broader header matching are directionally right, and the new total-row skipping in the core CSV adapters is useful. The rest of this review focuses on the blocking problems.

---

## CRITICAL

### 1) The reward engine drops fixed-amount / unit-based rules on the floor, so many cards will compute **0 or nonsense rewards**
- **Where:** `packages/rules/src/types.ts:12-30`, `packages/rules/src/schema.ts:14-19`, `packages/core/src/calculator/reward.ts:24-26`, `packages/core/src/calculator/reward.ts:123-176`
- **Concrete examples in data:** `packages/rules/data/cards/lotte/digiloca-auto.yaml:35-56`, `packages/rules/data/cards/kb/min-check.yaml:60-73`
- **Why this is bad:** the schema only preserves `rate`, `monthlyCap`, and `perTransactionCap`. Fields like `fixedAmount` and `unit` are present in the rule data but are not represented in the types/schema, so Zod strips them. Worse, `rewardTierRateSchema` converts `rate: null` to `0` (`packages/rules/src/schema.ts:16`). For cards like `digiloca-auto`, that means a “100원/리터” or “150원/리터” reward becomes a plain zero-rate cashback rule.
- **Impact:** a non-trivial part of `packages/rules/data/cards/**` cannot be evaluated correctly today; results for those cards are materially wrong, not just slightly off.
- **Fix:** extend the rule model to preserve `fixedAmount`, `unit`, and any other non-rate reward semantics; add calculator branches for those modes; add regression tests that load one fixed-amount rule and assert non-zero reward output.

### 2) `subcategory` exists in the card YAML, but the loader/optimizer/reward matcher ignore it, so subcategory-specific rewards collapse into broad category matches
- **Where:** `packages/rules/src/types.ts:25-30`, `packages/rules/src/schema.ts:27-32`, `packages/core/src/optimizer/constraints.ts:13-16`, `packages/core/src/calculator/reward.ts:44-47`
- **Concrete examples in data:** `packages/rules/data/cards/mg/plus-blue.yaml:32-68`
- **Why this is bad:** many rule files distinguish `dining.restaurant` vs `dining.cafe` (represented as `category: dining` + `subcategory: ...`). The rule schema never preserves `subcategory`, so that information is discarded during load. Then the optimizer aggregates only by `tx.category`, and the reward engine matches only on `rule.category === category`.
- **Impact:** category-specific cards are over-rewarded or mis-rewarded. In `mg/plus-blue`, restaurant and cafe rewards become indistinguishable, and the first `dining` rule wins.
- **Fix:** add `subcategory?: string` to rule types/schema, carry `tx.subcategory` through constraint building, and match `(category, subcategory)` before falling back to category-only or wildcard rules.

---

## HIGH

### 3) New bank detection signatures are dangerously over-broad; they will misclassify statements based on merchant names
- **Where:** `packages/parser/src/detect.ts:51-106`, `apps/web/src/lib/parser/detect.ts:49-104`
- **Examples that currently mis-detect:** merchant strings containing `CU`, `토스`, `MG`, or `JB` are enough to produce `cu`, `toss`, `mg`, or `jb` matches. I verified this with representative strings like `CU편의점 강남점`, `토스페이먼츠주식회사`, `메가MG`, and `JB타워점`.
- **Why this is bad:** patterns like `/토스/`, `/MG/`, `/JB/`, and `/cu\b/i` are not bank signatures. They are common merchant/payment strings. On multi-line statement content, this is guaranteed to produce false positives.
- **Amplifier:** the XLSX HTML path trusts the full-document bank hint without validation (`packages/parser/src/xlsx/index.ts:104-107`, `packages/parser/src/xlsx/index.ts:155-158`; web mirror at `apps/web/src/lib/parser/xlsx.ts:273-276`, `apps/web/src/lib/parser/xlsx.ts:314-315`). Once the HTML hint is wrong, the parser never re-checks against sheet headers.
- **Fix:** remove generic abbreviations unless paired with bank-only context, require stronger co-signals (brand + statement header tokens), and treat HTML-derived bank hints as tentative until validated by headers.

### 4) The browser parser and the core parser have already drifted apart; the same file can parse differently in web vs CLI
- **Where:** `packages/parser/src/xlsx/adapters/index.ts:83-163` vs `apps/web/src/lib/parser/xlsx.ts:89-172`
- **Concrete mismatch:** for `kakao`, `toss`, `kbank`, `bnk`, `dgb`, `suhyup`, `jb`, `kwangju`, `jeju`, `sc`, `mg`, `cu`, `kdb`, and `epost`, the browser column configs do not match the core configs. Example: `kakao` is `{ merchant: '이용처', amount: '이용금액' }` in core but `{ merchant: '가맹점명', amount: '거래금액' }` in web.
- **Additional drift:** the core XLSX parser handles parenthesized negative amounts (`packages/parser/src/xlsx/index.ts:74-85`), while the browser XLSX parser does not (`apps/web/src/lib/parser/xlsx.ts:230-237`). Core CSV adapters also gained total-row skipping (`packages/parser/src/csv/kb.ts:70-74`, same pattern across adapters), but the browser CSV adapters still parse those rows (`apps/web/src/lib/parser/csv.ts:374-398`, `apps/web/src/lib/parser/csv.ts:437-460`, etc.).
- **Impact:** web and CLI/server outputs are no longer trustworthy relative to each other.
- **Fix:** stop maintaining a second parser fork in `apps/web/src/lib/parser/*`; extract shared pure parsing modules and consume them from both sides.

### 5) The recent amount-handling changes now silently drop rows instead of surfacing parse errors, and they lose real charges in the checked-in `.xls` samples
- **Where:** `packages/parser/src/csv/generic.ts:73-79`, `packages/parser/src/csv/generic.ts:184-185`, `packages/parser/src/xlsx/index.ts:218-229`, `apps/web/src/lib/parser/xlsx.ts:382-395`
- **Why this is bad:** `parseAmount()` returns `0` for both legitimate zeroes and parse failures. The caller then treats `amount === 0` as “skip this row”. That converts malformed data into silent data loss.
- **Concrete repo evidence:** the checked-in HTML-as-XLS files `202602.xls` and `202603.xls` contain `연회비` rows where `이용금액` is `0` but `수수료(이자)` carries the actual charge (10,000 / 30,000). The current parser does not read the fee column and will drop those rows entirely.
- **Impact:** totals are understated, annual fees disappear, and bad parses leave no trace in `errors`.
- **Fix:** distinguish “failed to parse” from numeric zero, emit errors for malformed rows, and explicitly handle fee/interest columns for statement formats that place charges there.

### 6) `excludeOnline` rules cannot work because the parser never populates `isOnline`, and the web re-optimizer hardcodes it to `false`
- **Where:** parser transaction construction omits `isOnline` in `packages/parser/src/csv/generic.ts:187-190`, `packages/parser/src/xlsx/index.ts:231-244`, `packages/parser/src/pdf/index.ts:63-67`; the reward engine depends on it at `packages/core/src/calculator/reward.ts:137-139`; the web path hardcodes `isOnline: false` at `apps/web/src/lib/analyzer.ts:69-81`
- **Concrete rules depending on it:** `packages/rules/data/cards/lotte/loca-for-shopping.yaml:43-49`, `packages/rules/data/cards/lotte/digiloca-auto.yaml:55-56`
- **Impact:** offline-only rewards are applied to transactions that should be excluded, because “unknown” is effectively treated as “offline”.
- **Fix:** either infer `isOnline` during parsing (PG/payment-gateway heuristics, bank channel fields, etc.) or remove/disable `excludeOnline` until the signal is real.

### 7) The repo currently does not typecheck cleanly
- **Where:** `packages/core/src/categorizer/keywords-niche.ts:597` and `packages/core/src/categorizer/keywords-niche.ts:640` duplicate `자동차세`; `packages/core/src/categorizer/keywords-niche.ts:844` and `packages/core/src/categorizer/keywords-niche.ts:888` duplicate `면세점`; `apps/web/src/lib/categorizer-ai.ts:81` imports a CDN URL that TypeScript cannot resolve
- **Verification:** `tsc --noEmit` reports `TS1117` for the duplicate keys and `TS2307` for the unresolved CDN import.
- **Impact:** basic static verification is already broken, which makes the parser regressions above harder to catch before release.
- **Fix:** remove duplicate object keys, and wrap the AI categorizer behind a typed local module or ambient declaration instead of a raw URL import.

---

## MEDIUM

### 8) The new short-date parsing is non-deterministic and will mis-year year-boundary statements
- **Where:** `packages/parser/src/csv/generic.ts:56-67`, `packages/parser/src/xlsx/index.ts:62-67`, `apps/web/src/lib/parser/csv.ts:40-58`, `apps/web/src/lib/parser/xlsx.ts:218-223`
- **Why this is bad:** formats like `1월 15일` or `03/25` are now forced into `new Date().getFullYear()`. That means the same statement parses differently depending on when you run the code, and January statements imported in the following year will be wrong.
- **Fix:** infer the base year from statement metadata/header rows or neighboring full dates, and thread that context into the date parser instead of using wall-clock time.

### 9) The web app owns a full parser fork without any automated test surface
- **Where:** `apps/web/package.json:6-9` (no test script), plus the large duplicated implementation under `apps/web/src/lib/parser/*`
- **Why this is bad:** the parser drift in issue #4 is exactly what happens when a critical data parser is copy-pasted into the app with no parity tests.
- **Fix:** either delete the fork and consume shared code, or add golden-file parity tests that assert browser-vs-core output equivalence for the same fixtures.

---

## LOW

### 10) The CLI command code is carrying type-level contortions instead of validating inputs at the boundary
- **Where:** `tools/cli/src/commands/analyze.ts:39`, `tools/cli/src/commands/optimize.ts:61`, `tools/cli/src/commands/report.ts:67`
- **Why this is bad:** the `Parameters<typeof parseStatement>[1] ...` cast is a smell, not a solution. It hides invalid `--bank` values instead of validating them.
- **Fix:** validate CLI `bank` args against the actual `BankId` enum/union at parse time and fail fast with a user-facing error.

---

## Verification notes
- I was able to run package-level TypeScript checks with `tsc --noEmit`; they fail on the issues in item #7.
- I could not rerun the Bun test suite in this environment because `bun` is not installed here, so parser/runtime verification beyond static inspection is still partially blocked.
