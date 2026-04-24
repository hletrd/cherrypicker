# Cycle 11 — Code Reviewer

Date: 2026-04-24

## Findings

### C11-CR01: `CategoryBreakdown.svelte` getCategoryColor does 3-way fallback with `.pop()` on every call
- **File:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:94-98`
- **Severity:** LOW
- **Confidence:** Medium
- **Description:** `getCategoryColor(category)` calls `category.split('.').pop()` on each invocation. For a component that renders N category rows, this creates N temporary arrays. The function could pre-compute a reverse lookup Map at module level for O(1) lookups.
- **Failure scenario:** Not a correctness bug; minor GC pressure in extreme cases with hundreds of categories.
- **Fix:** Build a `Map<string, string>` once from `CATEGORY_COLORS` that also maps leaf IDs (e.g., "cafe") to their colors, eliminating the `split('.').pop()` chain.

### C11-CR02: `formatIssuerNameKo` hardcodes 24 issuer name mappings — seventh taxonomy duplicate
- **File:** `apps/web/src/lib/formatters.ts:52-78`
- **Severity:** LOW (same class as C9-03)
- **Confidence:** High
- **Description:** This is the seventh hardcoded duplicate of data that should derive from a single source. The names could be sourced from `cards.json` issuer data at build time, same exit criterion as C7-01.
- **Failure scenario:** New issuer added to cards.json but not to this map — name falls back to raw ID string.

### C11-CR03: `TransactionReview.svelte` FALLBACK_GROUPS is a third hardcoded category hierarchy duplicate
- **File:** `apps/web/src/components/dashboard/TransactionReview.svelte:26-42`
- **Severity:** LOW (same class as C8-01)
- **Confidence:** High
- **Description:** Same exit criterion as C7-01/C7-02. All fallback data should be generated from categories.yaml at build time.

### C11-CR04: `FileDropzone.svelte` ALL_BANKS is a second hardcoded bank list duplicate
- **File:** `apps/web/src/components/upload/FileDropzone.svelte:80-105`
- **Severity:** LOW (same class as C9-02)
- **Confidence:** High
- **Description:** Hardcoded bank list that could be derived from cards.json data. Same exit criterion as C9-02.

### C11-CR05: `build-stats.ts` fallback values may become stale
- **File:** `apps/web/src/lib/build-stats.ts:16-18`
- **Severity:** LOW (same as C9-10)
- **Confidence:** High
- **Description:** Hardcoded fallback values (683 cards, 24 issuers, 45 categories) will silently become wrong as the card database grows.

## Convergence with prior cycles

- All findings above are carry-over class instances of known deferred items (C7-01, C7-02, C8-01, C9-02, C9-03, C9-10). No new HIGH or MEDIUM code quality issues found.
- Previously implemented fixes (C9-06 shallow copy removal, C9-07 sort dependency comment) remain intact.
- The core optimizer (`greedy.ts`) and calculator (`reward.ts`) are well-structured with clear invariants documented in comments.

## Final sweep

Examined all files in: `packages/core/src/`, `packages/rules/src/`, `packages/parser/src/`, `apps/web/src/lib/`, `apps/web/src/components/`, `apps/web/src/pages/`, `apps/web/src/layouts/`. No additional findings beyond those listed and the known deferred items.
