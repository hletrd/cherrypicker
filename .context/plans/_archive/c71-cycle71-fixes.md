# Cycle 71 Implementation Plan

## Review Summary

Cycle 71 found 5 findings (C71-01 through C71-05). Two are MEDIUM severity with HIGH confidence and concrete failure scenarios. The rest are LOW severity carry-forwards.

Focus this cycle: Fix C71-01 (FileDropzone stale state) and C71-02 (loadCategories AbortError silent failure), which are both MEDIUM severity with clear fixes.

## Actionable Fixes (scheduled for implementation this cycle)

### Task 1: Reset bank and previousSpending in FileDropzone clearAllFiles/removeFile (C71-01) -- DONE
**Priority:** HIGH (MEDIUM severity, HIGH confidence, concrete user-facing bug)
**Files:** `apps/web/src/components/upload/FileDropzone.svelte`
**Commit:** `0000000384` fix(web): 🐛 reset bank and previousSpending on FileDropzone clear/remove (C71-01)

Implemented: Added `bank = ''` and `previousSpending = ''` to both `clearAllFiles()` and `removeFile()` (when last file removed).

### Task 2: Guard against empty categories in analyzeMultipleFiles (C71-02) -- DONE
**Priority:** HIGH (MEDIUM severity, HIGH confidence, silently wrong results)
**Files:** `apps/web/src/lib/analyzer.ts`
**Commit:** `0000000fa3` fix(web): 🐛 guard against empty categories in analysis (C71-02)

Implemented: Added empty categories guard in both `analyzeMultipleFiles()` and `parseAndCategorize()`. When `loadCategories()` returns an empty array (AbortError), throws a clear error message "카테고리 데이터를 불러올 수 없어요. 다시 시도해 보세요." instead of proceeding with silently wrong results.

### Task 3: Add parse error for unparseable dates in CSV/XLSX/PDF parsers (C71-04/C70-03/C56-04) -- DONE
**Priority:** MEDIUM (10+ cycles agree; LOW severity but straightforward improvement)
**Files:** `apps/web/src/lib/parser/date-utils.ts`, `apps/web/src/lib/parser/csv.ts`, `apps/web/src/lib/parser/xlsx.ts`, `apps/web/src/lib/parser/pdf.ts`
**Commit:** `000000068a` fix(parser): 🐛 report unparseable dates as parse errors (C71-04)

Implemented: Added `isValidISODate()` helper to date-utils.ts. Updated `parseDateToISO()` wrapper in all three parsers (CSV, XLSX, PDF) to accept an `errors` parameter and push a parse error entry when the parsed date is not a valid ISO format string. All 14 call sites in csv.ts, the 1 in xlsx.ts, and 2 in pdf.ts now pass the errors array.

---

## Deferred Items (not scheduled for implementation this cycle)

| Finding | Reason for deferral |
|---|---|
| C71-03 (annual savings *12 projection) | Same class as C4-06/C52-03. 10+ cycles agree. Label already says "단순 연환산". Exit criterion: when user confusion is reported. |
| C71-05 (BANK_SIGNATURES tie-breaking order) | LOW severity, MEDIUM confidence. Existing C70-01 confidence cap already mitigates the worst case. Exit criterion: when a real false-positive is reported. |
| C70-02 (cachedCategoryLabels View Transitions) | Same class as C66-02. 14 cycles agree. Static build artifact. Exit criterion: when categories.json can be updated at runtime. |
| C70-05 (BANK_SIGNATURES duplication) | Same class as C66-10/C7-07. 6 cycles agree. Requires D-01 architectural refactor. Exit criterion: when the two copies drift out of sync. |
| C70-04 (csv.ts reimplements shared.ts) | NOTE comment added. Full dedup requires D-01 refactor. Exit criterion: when shared module architecture is designed. |
| C67-01 (greedy optimizer O(m*n*k)) | Same class as D-09/D-51/D-86. 12+ cycles deferred. Latency acceptable. Exit criterion: when optimization latency exceeds 5s. |
| C66-02 (cachedCategoryLabels stale) | 14 cycles agree. Static build artifact. Exit criterion: when categories.json is updated during a user session. |
| C66-03 (MerchantMatcher O(n) substring) | 11 cycles agree. Pre-computed entries reduced overhead. Exit criterion: when merchant matching latency becomes noticeable. |
| C66-05 (FALLBACK_CATEGORIES hardcoded) | 6 cycles agree. Only used on network error. Exit criterion: when fallback is hit in production. |
| C66-08 (formatIssuerNameKo / CATEGORY_COLORS drift) | 6 cycles agree. Derived from YAML at build time. Exit criterion: when new issuers are added without updating maps. |
| C66-10 (BANK_SIGNATURES duplication) | 5 cycles agree. Same as C70-05. |
| C69-01 (animation flicker for tiny savings) | Informational only. Existing guard mitigates. |
| C56-05 (zero savings sign display) | Current "0원" display is correct. |
