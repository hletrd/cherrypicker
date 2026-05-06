# Verifier Review — CherryPicker Cycle 39

**Reviewer:** verifier (manual, Agent tool unavailable)
**Date:** 2026-05-06
**Cycle:** 39 / 100
**HEAD:** d265c46

---

## Verified Fixed

| ID | Claim | File | Evidence |
|----|-------|------|----------|
| C38-BUG01 | HTML/XLSX silent skip fixed | `html/index.ts:249`, `xlsx/index.ts:416` | ParseError now emitted for amount <= 0 (commits da9d028, 404c4e8) |
| C38-CR01 | CSV isValidCSVAmount fixed | `csv/shared.ts:122` | ParseError now emitted for amount <= 0 (commit d265c46) |
| C37-V04 | isOnline dead code | `reward.ts:47` | `excludeOnline` removed (commit b5c393d) |
| C37-V07 | NaN propagation | `analyzer.ts` | `Number.isFinite` validation (commit 589af72) |
| C32-V03 | Web UTF-16 | `parser/index.ts:31-39` | UTF-16LE/BE BOM detection (web-side) |
| C32-V08 | AbortController reuse | `llm-fallback.ts:87` | New controller per call |
| CR-09 | Windows path | CLI tools | `fileURLToPath` used |
| CR-10 | Hardcoded model | `extractor.ts:34` | Env-driven |
| SEC-03 | LLM size limit | `llm-fallback.ts:77-79` | 100K char guard |
| SEC-04 | API key regex | `llm-fallback.ts:66` | `sk-ant-api[0-9]{2,}-...` |
| SEC-07 | Non-KRW tracking | `reward.ts:224-226` | `skippedTransactions` populated |

## Still Broken / Partially Fixed

| ID | Claim | File | Status |
|----|-------|------|--------|
| BUG-3 | NaN propagation | `reward.ts:186` | Web-side fixed; core calculator UNPROTECTED |
| C32-V07 | FIFO cache eviction | `matcher.ts:129-138` | **MISDIAGNOSED** — cache IS LRU (delete+set on access). Finding was incorrect. |

## New Verifications

| ID | Claim | File | Status |
|----|-------|------|--------|
| C39-V01 | JSON findField performance | `json/index.ts:75-79` | CONFIRMED — O(aliases × keys) case-insensitive fallback |
| C39-V02 | parseAmountString trailing chars | `csv/shared.ts:175-178` | CONFIRMED — `"1234abc"` parses as 1234 |
| C39-V03 | previousMonthSpending NaN | `reward.ts:186-191` | CONFIRMED — NaN silently produces 'none' tier, zero rewards |
