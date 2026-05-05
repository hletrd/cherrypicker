# Cycle 17 Implementation Plan

## New Findings to Address

### C17-01 [MEDIUM] — `(item: any)` type annotation in pdf.ts bypasses type checking
- **File:** `apps/web/src/lib/parser/pdf.ts:323`
- **Fix:** Replace `(item: any)` with a proper `TextItem` interface that reflects the pdfjs-dist API surface used in the function body. The interface only needs the fields actually accessed: `str`, `transform`, `width`, `height`, `dir`, `hasEOL`. This eliminates the only `any` in runtime code outside store validation.

### C17-02 [LOW] — persistWarningKind defaults to 'truncated' for freshly computed data
- **File:** `apps/web/src/lib/store.svelte.ts:248-250`
- **Fix:** When `_loadPersistWarningKind` is null and `result.transactions` is undefined, the warning should not default to `'truncated'`. Only an actual load-from-storage should set the warning. Change the fallback from `'truncated'` to `null` (or conditionally set only when `_loadPersistWarningKind` is non-null). The warning UI already handles the null case (no warning shown).

### C17-03 [LOW] — BASE_URL trailing slash inconsistency in FileDropzone and CardDetail
- **File:** `apps/web/src/components/upload/FileDropzone.svelte:217`, `apps/web/src/components/cards/CardDetail.svelte:276`
- **Fix:** Use the existing `getBaseUrl()` helper from `cards.ts` (or extract it to a shared utility) to construct navigation URLs instead of raw `import.meta.env.BASE_URL + 'dashboard'`. The helper already handles the trailing slash edge case. If importing from cards.ts creates a circular dependency, inline the small helper.

### C17-04 [LOW] — Split-brain visibility in dashboard.astro and results.astro
- **File:** `apps/web/src/pages/dashboard.astro:121`, `apps/web/src/pages/results.astro:80`
- **Fix:** Replace the inline `<script is:inline>` visibility toggles with Svelte-driven visibility. Move the container visibility logic into the Svelte components themselves (e.g., have SavingsComparison/OptimalCardMap toggle their parent container via a reactive prop or a shared store). Alternatively, have the Astro page check the store state via a small Svelte wrapper component that manages the container visibility. This eliminates the split-brain where plain JS toggles containers independently from Svelte reactivity.

### C17-05 [LOW] — CategoryBreakdown "other" threshold applied after rounding creates asymmetric boundary
- **File:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:88-89`
- **Fix:** Apply the `< 2` threshold on the unrounded percentage value, not the rounded one. Change the filter from `pct < 2` to `(a.spending / totalSpending) * 100 < 2`. This way, 1.95% (which rounds to 2.0% visible) and 1.94% (which rounds to 1.9% hidden) are both below 2.0% raw and get grouped into "other" consistently, or both stay visible if the threshold is changed to `< 1.95`. The simpler approach: use the raw value for the threshold decision but display the rounded value.

## Implementation Order

1. **C17-01** — Type safety fix (MEDIUM severity, only `any` in runtime code)
2. **C17-02** — Data-integrity fix (incorrect warning for freshly computed data)
3. **C17-05** — Logic fix (asymmetric threshold boundary)
4. **C17-03** — Navigation fix (BASE_URL trailing slash)
5. **C17-04** — Architecture fix (split-brain visibility, most involved)

## Deferred Items

All prior deferred items from `00-deferred-items.md` remain unchanged. No new deferrals this cycle.
