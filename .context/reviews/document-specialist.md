# Document Specialist Review: Documentation-Code Mismatches

**Date**: 2026-04-22
**Scope**: README.md, .claude/CLAUDE.md, source files across all packages
**Method**: Cross-referenced documentation claims against actual code, package.json, file counts, and type definitions

---

## Summary

Found 9 documentation-code mismatches: 3 High, 4 Medium, 2 Low confidence. The most significant issues are stale card/issuer counts in the README (10 of 24 issuers have wrong card counts), a wrong card total (561 vs 683), and a nonexistent file referenced in the project structure diagram. The CLAUDE.md is accurate and requires no changes.

---

## Findings

### F1. README: Card count total is stale (561 vs 683)

- **File**: `/Users/hletrd/flash-shared/cherrypicker/README.md` lines 79, 98
- **Doc says**: "561개 카드 규칙" (line 79) and "561개" (line 98)
- **Code shows**: 683 YAML card files in `packages/rules/data/cards/` (verified by `ls */*.yaml | wc -l`)
- **Badge says**: "Cards-683" (line 12), "Issuers-24" (line 13) -- these are correct
- **Suggested fix**: Replace "561" with "683" on lines 79 and 98
- **Confidence**: **High** -- direct file count

### F2. README: Per-issuer card counts are stale (10 of 24 issuers wrong)

- **File**: `/Users/hletrd/flash-shared/cherrypicker/README.md` lines 57-68
- **Doc says vs actual**:

  | Issuer | README | Actual | Delta |
  |--------|--------|--------|-------|
  | shinhan | 65 | 80 | +15 |
  | hyundai | 48 | 63 | +15 |
  | samsung | 47 | 58 | +11 |
  | lotte | 47 | 55 | +8 |
  | kb | 47 | 67 | +20 |
  | hana | 45 | 61 | +16 |
  | woori | 42 | 52 | +10 |
  | ibk | 35 | 43 | +8 |
  | nh | 34 | 49 | +15 |
  | bc | 18 | 22 | +4 |

- **14 issuers are correct**: dgb(21), sc(10), kakao(9), suhyup(8), mg(8), toss(5), kbank(5), cu(4), kdb(2), epost(2), jeju(19), bnk(19), jb(11), kwangju(10)
- **Suggested fix**: Update the table to reflect actual counts. Consider automating this via `scripts/build-json.ts` output or a CI check.
- **Confidence**: **High** -- verified by per-directory YAML file count

### F3. README: Project structure references nonexistent file

- **File**: `/Users/hletrd/flash-shared/cherrypicker/README.md` line 93
- **Doc says**: `src/lib/categorizer-ai.ts # 비활성화된 AI 분류기 자리표시자`
- **Code shows**: The file `apps/web/src/lib/categorizer-ai.ts` does not exist. No file named `categorizer-ai.ts` exists anywhere in the repository. The grep for "categorizer-ai" only returns hits in `.context/reviews/` and `README.md` -- never in source code.
- **Suggested fix**: Remove the `categorizer-ai.ts` entry from the project structure diagram, or create the placeholder file if the reference is intentional.
- **Confidence**: **High** -- verified file does not exist on disk

### F4. README: Parsing dependency table omits packages/parser dependencies

- **File**: `/Users/hletrd/flash-shared/cherrypicker/README.md` line 77
- **Doc says**: "파싱 | PapaParse, SheetJS, pdfjs-dist"
- **Code shows**:
  - `apps/web/` uses: PapaParse (`papaparse`), SheetJS (`xlsx`), pdfjs-dist -- matches the doc for the web app
  - `packages/parser/` uses: `pdf-parse` (not pdfjs-dist), `@anthropic-ai/sdk` (for LLM fallback), `xlsx` -- these are NOT mentioned
  - `unpdf` is listed in `packages/parser/package.json` but no source file imports it (dead dependency)
- **Suggested fix**: Change the parsing row to distinguish web vs CLI dependencies, e.g.: "파싱 | PapaParse, SheetJS, pdfjs-dist (웹); pdf-parse, SheetJS, Claude API (CLI)". Or remove the simplified row and note the split in a footnote.
- **Confidence**: **Medium** -- the current text is not wrong for the web app, but is incomplete/misleading for the monorepo as a whole

### F5. README: Keyword count claim is stale ("350개 이상" vs ~13,500+)

- **File**: `/Users/hletrd/flash-shared/cherrypicker/README.md` lines 34, 47
- **Doc says**: "350개 이상 키워드 매칭 기반 분류" (line 34) and "키워드 매칭 (350개 이상)" (line 47)
- **Code shows**: The keyword files contain approximately 13,511 keyword entries across 4 files:
  - `keywords.ts`: ~10,007 entries
  - `keywords-english.ts`: ~1,687 entries
  - `keywords-locations.ts`: ~960 entries
  - `keywords-niche.ts`: ~915 entries
- **Note**: The "350" likely referred to an earlier version of the keyword database. The count has grown by ~40x.
- **Suggested fix**: Update to "13,000개 이상 키워드 매칭 기반 분류" or use a more conservative rounded figure. Consider adding a comment that the count is approximate and grows with each update.
- **Confidence**: **Medium** -- the 13,511 count comes from grep matching of key patterns; the exact count may vary slightly depending on how multi-word keys are counted, but it is unambiguously far above 350

### F6. README: "TypeScript 6" is incorrect

- **File**: `/Users/hletrd/flash-shared/cherrypicker/README.md` line 82
- **Doc says**: "언어 | TypeScript 6"
- **Code shows**: `typescript@^5.9.3` in root `package.json` and all workspace `package.json` files. The actual installed version is 5.9.3. TypeScript 6 does not exist as a stable release.
- **Suggested fix**: Change to "TypeScript 5.9" or simply "TypeScript"
- **Confidence**: **High** -- verified via package.json and node_modules

### F7. Web cards.ts: RewardEntry.conditions uses `minAmount` but schema uses `minTransaction`

- **File**: `/Users/hletrd/flash-shared/cherrypicker/apps/web/src/lib/cards.ts` line 79
- **Doc/type says**: `minAmount?: number` in the `RewardEntry` interface's `conditions` field
- **Code shows**: The canonical schema in `packages/rules/src/schema.ts` and `types.ts` uses `minTransaction` (not `minAmount`). The `WebRewardConditions` interface at line 6 of the same file correctly uses `minTransaction`, but the nested `conditions` type inside `RewardEntry` at line 76 uses `minAmount`.
- **Impact**: The `RewardEntry` interface is exported and used by components. If any component reads `conditions.minAmount`, it would be undefined at runtime because the JSON data uses `minTransaction`.
- **Suggested fix**: Change `minAmount` to `minTransaction` in the `RewardEntry` interface's `conditions` type (line 79) to match the schema.
- **Confidence**: **Medium** -- the field is optional, so no runtime crash, but it is a type-level documentation mismatch that could cause silent data loss

### F8. CLAUDE.md: Parser description could note the parser package split

- **File**: `/Users/hletrd/flash-shared/cherrypicker/.claude/CLAUDE.md` line 17
- **Doc says**: "`packages/parser/` -- Statement parsers (CSV, XLSX, PDF). Runs on Bun."
- **Code shows**: The parser is split into two parallel implementations:
  - `packages/parser/` -- Node/Bun runtime (uses `pdf-parse`, `@anthropic-ai/sdk`)
  - `apps/web/src/lib/parser/` -- Browser runtime (uses `papaparse`, `pdfjs-dist`, `xlsx`)
  - Both support CSV, XLSX, and PDF, but with different libraries
- **Suggested fix**: Consider adding a note like: "Browser-side parser lives in apps/web/src/lib/parser/ with different PDF/CSV dependencies." This is a minor improvement, not a bug.
- **Confidence**: **Low** -- the current text is technically correct; the split is implicit

### F9. packages/parser: `unpdf` is listed as a dependency but never imported

- **File**: `/Users/hletrd/flash-shared/cherrypicker/packages/parser/package.json` line 15
- **Doc says**: `"unpdf": "^0.12.0"` is declared as a dependency
- **Code shows**: No source file in `packages/parser/src/` imports `unpdf`. The PDF extraction uses `pdf-parse` instead (`extractor.ts` line 2: `import pdfParse from 'pdf-parse'`).
- **Suggested fix**: Remove `unpdf` from `packages/parser/package.json` dependencies, or document why it is kept (e.g., planned migration from pdf-parse to unpdf).
- **Confidence**: **Medium** -- the dependency is installed but unused; could be intentional for future use

---

## CLAUDE.md Assessment

The `.claude/CLAUDE.md` is accurate as of this review:

- Tech stack versions are correct (Astro 6, Svelte 5, Tailwind CSS 4, Zod, Node 24)
- Architecture descriptions match actual package structure
- Conventions (YAML paths, Won amounts, ISO 8601 dates) are consistent with the code

No changes needed for CLAUDE.md.

---

## Files Reviewed

- `/Users/hletrd/flash-shared/cherrypicker/README.md`
- `/Users/hletrd/flash-shared/cherrypicker/.claude/CLAUDE.md`
- `/Users/hletrd/flash-shared/cherrypicker/package.json`
- `/Users/hletrd/flash-shared/cherrypicker/apps/web/package.json`
- `/Users/hletrd/flash-shared/cherrypicker/apps/web/src/lib/analyzer.ts`
- `/Users/hletrd/flash-shared/cherrypicker/apps/web/src/lib/api.ts`
- `/Users/hletrd/flash-shared/cherrypicker/apps/web/src/lib/cards.ts`
- `/Users/hletrd/flash-shared/cherrypicker/apps/web/src/lib/parser/index.ts`
- `/Users/hletrd/flash-shared/cherrypicker/apps/web/src/lib/parser/csv.ts`
- `/Users/hletrd/flash-shared/cherrypicker/apps/web/src/lib/parser/xlsx.ts`
- `/Users/hletrd/flash-shared/cherrypicker/apps/web/src/lib/parser/pdf.ts`
- `/Users/hletrd/flash-shared/cherrypicker/packages/core/src/index.ts`
- `/Users/hletrd/flash-shared/cherrypicker/packages/core/src/categorizer/matcher.ts`
- `/Users/hletrd/flash-shared/cherrypicker/packages/core/src/categorizer/keywords.ts`
- `/Users/hletrd/flash-shared/cherrypicker/packages/core/src/models/transaction.ts`
- `/Users/hletrd/flash-shared/cherrypicker/packages/core/src/models/card.ts`
- `/Users/hletrd/flash-shared/cherrypicker/packages/core/src/models/result.ts`
- `/Users/hletrd/flash-shared/cherrypicker/packages/core/src/calculator/reward.ts`
- `/Users/hletrd/flash-shared/cherrypicker/packages/core/src/calculator/types.ts`
- `/Users/hletrd/flash-shared/cherrypicker/packages/core/src/optimizer/index.ts`
- `/Users/hletrd/flash-shared/cherrypicker/packages/core/src/optimizer/ilp.ts`
- `/Users/hletrd/flash-shared/cherrypicker/packages/parser/src/index.ts`
- `/Users/hletrd/flash-shared/cherrypicker/packages/parser/src/types.ts`
- `/Users/hletrd/flash-shared/cherrypicker/packages/parser/src/detect.ts`
- `/Users/hletrd/flash-shared/cherrypicker/packages/parser/src/csv/index.ts`
- `/Users/hletrd/flash-shared/cherrypicker/packages/parser/src/pdf/index.ts`
- `/Users/hletrd/flash-shared/cherrypicker/packages/parser/src/pdf/extractor.ts`
- `/Users/hletrd/flash-shared/cherrypicker/packages/parser/src/pdf/llm-fallback.ts`
- `/Users/hletrd/flash-shared/cherrypicker/packages/parser/package.json`
- `/Users/hletrd/flash-shared/cherrypicker/packages/rules/src/index.ts`
- `/Users/hletrd/flash-shared/cherrypicker/packages/rules/src/schema.ts`
- `/Users/hletrd/flash-shared/cherrypicker/packages/rules/src/types.ts`
- `/Users/hletrd/flash-shared/cherrypicker/packages/rules/src/loader.ts`
- `/Users/hletrd/flash-shared/cherrypicker/packages/rules/package.json`
- `/Users/hletrd/flash-shared/cherrypicker/packages/viz/src/index.ts`
- `/Users/hletrd/flash-shared/cherrypicker/packages/viz/src/report/generator.ts`
- `/Users/hletrd/flash-shared/cherrypicker/packages/viz/package.json`
- `/Users/hletrd/flash-shared/cherrypicker/tools/cli/src/index.ts`
- `/Users/hletrd/flash-shared/cherrypicker/tools/cli/package.json`
- `/Users/hletrd/flash-shared/cherrypicker/tools/scraper/package.json`
- `/Users/hletrd/flash-shared/cherrypicker/scripts/build-json.ts`
