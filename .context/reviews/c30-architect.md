# Cycle 30 Architecture Review

## Findings

### HIGH-01: Double HTML decode in xlsx.ts
- **Files:** `apps/web/src/lib/parser/xlsx.ts:327-353`, `packages/parser/src/xlsx/index.ts:30-37`
- **Severity:** HIGH
- **Confidence:** High
- **Issue:** `isHTMLContent` decodes the first 512 bytes, then the caller decodes the full buffer again when HTML is detected. The comment acknowledges this: "the 512-byte overlap is accepted as minor overhead." For large HTML-as-XLS files, this is wasteful. The web-side implementation is particularly problematic because it uses `new TextDecoder('utf-8').decode(buffer.slice(0, 512))` which creates a copy.
- **Fix:** Have `isHTMLContent` return the decoded prefix so the caller can avoid the second decode of the first 512 bytes.
- **Cross-reference:** C29-architect-MEDIUM-02, Plan 53 Task 5, Deferred D-52

### MED-01: Parser web/server duplication still unaddressed
- **Files:** `apps/web/src/lib/parser/*` vs `packages/parser/src/*`
- **Severity:** MEDIUM
- **Confidence:** High
- **Issue:** Despite many cycles of parity fixes, the fundamental duplication between web-side and server-side parsers remains. Every fix requires applying to both sides, and divergence risk is high. The normalizeHTML regex divergence (fixed in C29) is a perfect example of how duplication causes bugs.
- **Fix:** Extract shared utilities to a platform-agnostic module. The normalizeHTML, amount parsing, and column-matching logic are prime candidates.
- **Cross-reference:** Deferred D-01

### MED-02: analyzer.ts still mixing parsing, categorization, and optimization
- **File:** `apps/web/src/lib/analyzer.ts`
- **Severity:** MEDIUM
- **Confidence:** Medium
- **Issue:** The analyzer combines parseFile calls, MerchantMatcher construction, categorization, and optimization in a single file. While this works for the current flow, it makes unit testing difficult and creates tight coupling.
- **Fix:** Consider splitting into ParseService, CategorizationService, and OptimizationService when the file grows beyond ~300 lines.
- **Cross-reference:** Deferred D-34

### LOW-01: Mutable _loadPersistWarningKind module-level variable
- **File:** `apps/web/src/lib/store.svelte.ts:207`
- **Severity:** LOW
- **Confidence:** High
- **Issue:** The `_loadPersistWarningKind` and `_loadTruncatedTxCount` module-level variables create fragile coupling between `loadFromStorage` and the store constructor. If the load order changes, these variables could contain stale values.
- **Fix:** Return the warning info from `loadFromStorage` instead of using module-level mutable state.
- **Cross-reference:** Deferred D-56
