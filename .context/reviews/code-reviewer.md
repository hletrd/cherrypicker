# Code Review — CherryPicker Cycle 36

## Methodology
Manual review of packages/core/src/, packages/parser/src/, packages/rules/src/, packages/viz/src/, tools/cli/src/, tools/scraper/src/, apps/web/src/ for code quality, correctness, maintainability, and cross-platform compatibility.

---

## VERIFIED FIXED (from Cycle 35)

| ID | Finding | Status | Evidence |
|----|---------|--------|----------|
| CR-03 | `toCoreCardRuleSets` threw on unknown reward type | **FIXED** | Now defaults to `'none'` (analyzer.ts:71-74) |
| CR-04 | `console.warn` leaked into production | **FIXED** | Warning removed; silent fallback to `'web'` |
| CR-06 | `performanceTiers` ordering not validated | **FIXED** | `selectTier` now sorts explicitly (reward.ts:16-18) |

---

## CARRYOVER (still open from Cycle 35)

### CR-01: Silent error swallowing in format detection JSON.parse
**File**: `packages/parser/src/detect.ts:286-295` | **Severity**: Medium | **Confidence**: High
`JSON.parse` errors are silently caught, defaulting to CSV. A malformed JSON file is incorrectly treated as CSV with no error surfaced.
**Fix**: Capture parse error and include in DetectionResult.errors array.

### CR-02: Silent error swallowing in HTML parser
**File**: `packages/parser/src/html/index.ts:48` | **Severity**: Medium | **Confidence**: High
XLSX parsing errors are silently caught and the function returns `{transactions: [], errors: []}` with no indication parsing failed.
**Fix**: Surface the caught error as a ParseError in the returned errors array.

### CR-05: Greedy optimizer rate calculation has no zero-amount guard
**File**: `packages/core/src/optimizer/greedy.ts:55` | **Severity**: Low | **Confidence**: Medium
`const rate = reward / transaction.amount;` — if `scoreCardsForTransaction` is ever called directly with unfiltered data, this divides by zero.
**Fix**: Add `if (transaction.amount <= 0) return [];` at the top of `scoreCardsForTransaction`.

### CR-07: Type duplication between core and web
**File**: `apps/web/src/lib/store.svelte.ts`, `packages/core/src/models/result.ts` | **Severity**: Low | **Confidence**: High
Web store re-declares `CardRewardResult`, `CategoryReward`, `CapInfo`, `CardAssignment`, `OptimizationResult`.
**Fix**: Import types from `@cherrypicker/core` directly.

### CR-08: No validation that `categoryLabels` Map is non-empty
**File**: `apps/web/src/lib/analyzer.ts:260-265` | **Severity**: Low | **Confidence**: Medium
Empty Map causes raw English category keys to be used as labels.
**Fix**: Validate `categoryLabels.size > 0` before passing to optimizer.

---

## NEW FINDINGS

### CR-09: Windows path bug in CLI default path resolution
**File**: `tools/cli/src/commands/analyze.ts`, `tools/cli/src/commands/optimize.ts`, `tools/cli/src/commands/report.ts` | **Severity**: Medium | **Confidence**: High
`new URL('../../../..', import.meta.url).pathname` produces `/C:/path` on Windows (leading slash before drive letter), which is not a valid filesystem path. Node.js `path` operations on this string will fail.
**Fix**: Use `fileURLToPath(import.meta.url)` combined with `path.resolve()` or `path.dirname()`.

### CR-10: Outdated hardcoded model name in scraper
**File**: `tools/scraper/src/extractor.ts:34` | **Severity**: Medium | **Confidence**: High
Hardcoded `claude-sonnet-4-6` — this model identifier format is outdated and may not resolve to the intended model. Anthropic model names have changed (e.g., `claude-sonnet-4-20250514` or `claude-sonnet-4`).
**Fix**: Move model name to environment variable or config file, or update to current model string. Validate against supported model list.

### CR-11: CSV files read twice — no buffer reuse
**File**: `packages/parser/src/detect.ts:314`, `packages/parser/src/index.ts` | **Severity**: Low | **Confidence**: High
`detectFormat` reads the entire file into a Buffer for bank/encoding detection. `parseStatement` then reads the file AGAIN. For large CSV files (10MB+), this doubles I/O.
**Fix**: Pass the already-read Buffer through DetectionResult so `parseStatement` can reuse it, or refactor to return `{result, buffer}`.

### CR-12: CP949 detection ratio divides by near-zero for small buffers
**File**: `packages/parser/src/detect.ts:43` | **Severity**: Low | **Confidence**: Medium
```typescript
if (cp949SignalBytes > 0 && (cp949SignalBytes / (scanLen / 1024)) > 5)
```
For a 100-byte file with 1 signal byte: ratio = 1 / (100/1024) = 10.24, falsely detecting CP949. The `> 0` guard does not protect against small-buffer inflation.
**Fix**: Add `scanLen >= 1024` guard before ratio calculation, or use absolute threshold instead of per-KB ratio.

### CR-13: `store.svelte.ts` uses `any` for parsed storage data
**File**: `apps/web/src/lib/store.svelte.ts:244` | **Severity**: Low | **Confidence**: High
`let parsed: any = safeJSONParse(raw);` — bypasses TypeScript structural checking. The subsequent validation (`isPlainObject`, `hasString`) runtime-guards against prototype pollution but not against type mismatches.
**Fix**: Use `unknown` and narrow with a Zod schema or typed validation function.

### CR-14: No timeout on static JSON fetches
**File**: `apps/web/src/lib/cards.ts` | **Severity**: Low | **Confidence**: Medium
`loadCardsData()` and `loadCategories()` use `AbortController` but never set a timeout. A stalled network connection hangs indefinitely with no feedback to the user.
**Fix**: Add `setTimeout(() => controller.abort(), 10000)` or use `fetch(url, { signal: controller.signal, ... })` with a timeout wrapper.

### CR-15: ReDoS risk in `SUMMARY_ROW_PATTERN`
**File**: `packages/parser/src/csv/column-matcher.ts` | **Severity**: Medium | **Confidence**: Medium
The regex contains an extremely long alternation with Korean lookbehinds and overlapping patterns. On crafted input, backtracking could cause exponential time.
**Fix**: Decompose into multiple smaller regexes or use a linear scanner (string.includes / startsWith chain) instead of a single mega-regex.

### CR-16: No cancellation for in-flight analyze/reoptimize
**File**: `apps/web/src/lib/store.svelte.ts` | **Severity**: Low | **Confidence**: Medium
If a user triggers `analyze()` then quickly edits a category (triggering `reoptimize()`), both operations run concurrently. The later result may overwrite the earlier, causing race conditions in the UI.
**Fix**: Store an AbortController or Promise reference and cancel/await the previous operation before starting the next.

### CR-17: Server/web parser code duplication
**File**: `packages/parser/src/` vs `apps/web/src/lib/parser/` | **Severity**: Low | **Confidence**: High
Parser logic exists in both the Bun server package and the web app. Changes to one must be manually mirrored to the other. HTML forward-fill and OFX credit card fixes (recent commits) required dual maintenance.
**Fix**: Extract shared parser utilities into a pure-TS package consumed by both, or generate the web parser from the server parser via build step.

---

## COMMONLY MISSED CHECKS

- No `structuredClone` used before mutating cached data (cachedCoreRules is returned as-is, but it's re-created each time so this is currently safe)
- `detectEncoding` returns `'utf-8'` for UTF-8 BOM files, but `decodeBuffer` correctly handles this — however the encoding field in DetectionResult says `'utf-8'` when it could say `'utf-8-bom'` for clarity
