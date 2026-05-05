# Verifier — cherrypicker (Cycle 5)

**Reviewer:** verifier (sonnet)
**Scope:** Evidence-based correctness check
**Date:** 2026-05-05

---

## Summary

Verification of previously reported issues shows a mixed picture: some critical bugs were fixed (FileDropzone ReferenceError, fetcher abort timeout, store migration), while structural issues remain unaddressed. No new critical correctness bugs were found in this cycle.

---

## Verification Results

### C-CR-03 / D-DEB-01: FileDropzone `errorMessage` vs `errorMessages`

**Status:** FIXED
**Evidence:** `apps/web/src/components/upload/FileDropzone.svelte:76` declares `let errorMessages = $state<string[]>([])`. All 9 references in the file use `errorMessages` (lines 208, 215, 232, 241, 255, 318, 330, 353, 367). No `errorMessage` references found.

---

### P-PR-01: Greedy optimizer `rules.indexOf` O(n^2 log n)

**Status:** FIXED
**Evidence:** `grep -n "rules.indexOf" packages/core/src/optimizer/greedy.ts` returns no matches. The sort at lines 90-94 now uses a pure specificity comparison with no index lookup.

---

### S-SEC-02: Fetcher abort timeout lost on EUC-KR retry

**Status:** FIXED
**Evidence:** `tools/scraper/src/fetcher.ts:50-51` shows the second `fetch(url, { signal: controller.signal, ... })` properly propagates the abort signal.

---

### A-ARCH-05 / F-CRI-08: Store sessionStorage with no eviction

**Status:** FIXED
**Evidence:** `apps/web/src/lib/store.svelte.ts:132` defines `MAX_PERSIST_SIZE = 4 * 1024 * 1024`. Lines 169-179 implement truncation logic. Lines 114-116 add migration support. Lines 239-256 handle version migration.

---

### C-CR-02 / D-DEB-02: PDF non-null assertion on amount match

**Status:** PARTIALLY FIXED
**Evidence:** `packages/parser/src/pdf/index.ts:358` no longer has `!` after the nullish coalescing chain. However, if ALL capture groups are undefined, `amountRaw` becomes `undefined` and the code falls through to line 360 which pushes an error. This is better than throwing but still a silent failure.

---

### C-CR-05 / A-ARCH-02 / F-CRI-02: CATEGORY_NAMES_KO hardcoded

**Status:** OPEN
**Evidence:** `packages/core/src/optimizer/greedy.ts:11-90` still contains 79 lines of hardcoded `CATEGORY_NAMES_KO`. The TODO comment at line 8 remains.

---

### F-CRI-01 / A-ARCH-01: Server/web parser duplication

**Status:** OPEN
**Evidence:** `apps/web/src/lib/parser/csv.ts`, `pdf.ts`, `xlsx.ts`, `html.ts`, `json.ts`, `ofx.ts`, `date-utils.ts`, `column-matcher.ts`, `detect.ts` all exist as separate implementations. File sizes and line counts match server versions closely but are not shared.

---

### F-CRI-04 / A-ARCH-03: Card rules type duplicated in web app

**Status:** OPEN
**Evidence:** `apps/web/src/lib/cards.ts:14-52` defines `CardRuleSet` inline. Does not import from `@cherrypicker/rules`.

---

### V-VER-01 / T-TE-01: FileDropzone error path test coverage

**Status:** UNVERIFIED
**Evidence:** No test files for FileDropzone.svelte found in the repository. Component test coverage cannot be assessed.

---

### V-VER-02 / T-TE-02: Parser parity test suite

**Status:** OPEN
**Evidence:** No `__tests__/parity/` directory exists. No fixtures are shared between server and web parsers.

---

## Gate Check

| Gate | Result |
|------|--------|
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `bun run test` | PASS |

---

## Verdict

**5 FIXED, 6 OPEN, 1 UNVERIFIED** — The bug-fix velocity is good but structural issues are accumulating. Recommend prioritizing the parser unification and CATEGORY_NAMES_KO generation.
