# Cycle 76 Implementation Plan

**Date:** 2026-04-22
**Status:** In Progress

---

## Task 1: Fix `loadFromStorage` migration loop to handle pre-versioning (undefined `_v`) data

**Finding:** C76-01 (MEDIUM / HIGH)
**File:** `apps/web/src/lib/store.svelte.ts:231-242`

**Problem:** The migration loop at lines 238-241 only runs when `parsed._v !== undefined && parsed._v !== STORAGE_VERSION`. Data persisted before the C74-02 versioning fix has no `_v` field at all. When such legacy data is loaded, `parsed._v` is `undefined`, so the condition `parsed._v !== undefined` is false, and the migration loop is skipped entirely.

Currently this is safe because `MIGRATIONS` is empty (v1 has no migrations). But when STORAGE_VERSION becomes 2 and a migration function is added at key `1`, the migration from v1 to v2 will correctly run for data with `_v: 1`. However, legacy data without a `_v` field will NOT be migrated, even though it logically represents v0 (pre-versioning) data that also needs migration.

**Fix:** Treat `_v: undefined` as version 0 (pre-versioning). Run migrations from the stored version (defaulting to 0) up to STORAGE_VERSION. Also update the version mismatch warning to show the actual stored version (0 for legacy data).

**Implementation:**
```typescript
// Replace the current version check block (lines 231-242):
if (parsed._v !== undefined && parsed._v !== STORAGE_VERSION) {
  if (typeof console !== 'undefined') {
    console.warn(`[cherrypicker] Session storage schema version mismatch: stored=${parsed._v}, current=${STORAGE_VERSION}. Attempting to load anyway.`);
  }
  // Apply migrations from the stored version to the current version
  for (let v = parsed._v; v < STORAGE_VERSION; v++) {
    const migrator = MIGRATIONS[v];
    if (migrator) parsed = migrator(parsed);
  }
}

// With:
const storedVersion = parsed._v ?? 0;
if (storedVersion < STORAGE_VERSION) {
  if (storedVersion === 0) {
    if (typeof console !== 'undefined') {
      console.warn(`[cherrypicker] Session storage has legacy (unversioned) data. Attempting migration to v${STORAGE_VERSION}.`);
    }
  } else if (typeof console !== 'undefined') {
    console.warn(`[cherrypicker] Session storage schema version mismatch: stored=${storedVersion}, current=${STORAGE_VERSION}. Attempting to load anyway.`);
  }
  // Apply migrations from the stored version to the current version.
  // Legacy data (_v undefined, treated as version 0) will run all migrations
  // from v0 up, ensuring pre-versioning data is correctly transformed.
  for (let v = storedVersion; v < STORAGE_VERSION; v++) {
    const migrator = MIGRATIONS[v];
    if (migrator) parsed = migrator(parsed);
  }
}
```

---

## Task 2: Run quality gates (eslint, tsc --noEmit, vitest, bun test)

**Requirement:** All gates must pass before cycle completion.

---

## Deferred Items (this cycle)

The following findings from this cycle's review are deferred per the repo's rules:

### C76-02: FALLBACK_CATEGORIES leading-space labels cause browser-inconsistent dropdown rendering
- **Severity:** LOW / HIGH
- **File:** `apps/web/src/components/dashboard/TransactionReview.svelte:36-64`
- **Reason for deferral:** The leading spaces are intentional for visual hierarchy in the dropdown. The `includes()` search matching works correctly regardless of leading spaces. Browser rendering of leading spaces in `<option>` is inconsistent but does not cause functional issues. Replacing the spaces with a different indentation mechanism (e.g., Unicode em-spaces, CSS padding, or Svelte-based optgroup) would require changing both the fallback and the dynamic loading path (line 107) simultaneously, and the benefit is purely cosmetic.
- **Exit criterion:** If a browser is found that completely ignores leading spaces in `<option>` elements, making subcategory indentation invisible, switch to CSS-based indentation or Unicode em-spaces.

### C76-03: SpendingSummary dismissal not reset on store.reset()
- **Severity:** LOW / MEDIUM
- **File:** `apps/web/src/components/dashboard/SpendingSummary.svelte:17-27`
- **Reason for deferral:** The warning is informational ("tab close will lose data"). Once dismissed, re-showing it after each re-analysis would be disruptive to the user experience. The dismissal clears on tab close (sessionStorage behavior). This is an intentional UX decision, not a bug.
- **Exit criterion:** If user feedback indicates the warning should re-appear after a fresh analysis, add a `reset()` listener.

### C76-04: VisibilityToggle $effect directly mutates DOM
- **Severity:** LOW / HIGH
- **File:** `apps/web/src/components/dashboard/OptimalCardMap.svelte:62-127`
- **Reason for deferral:** Known architectural limitation (C18-01/C50-08) flagged by many prior cycles. The direct DOM mutation is necessary because the managed elements belong to Astro's DOM tree, not Svelte's. All edge cases are handled correctly via isConnected checks and cleanup. Fixing this would require restructuring the Astro page to use Svelte-managed elements, which is a larger architectural change.
- **Exit criterion:** When the Astro page is refactored to use Svelte-managed elements, replace direct DOM mutation with Svelte reactivity.

### C76-05: build-stats.ts fallback values will drift
- **Severity:** LOW / MEDIUM
- **File:** `apps/web/src/lib/build-stats.ts:17-19`
- **Reason for deferral:** Known issue (C8-07/C67-02) deferred by 12+ prior cycles. Fallback only used when cards.json is unavailable at build time, which is an unusual scenario. The file is always built as part of the CI pipeline.
- **Exit criterion:** When a CI step can validate fallback values against the actual cards.json at build time, automate the check.

---

## Progress

- [x] Task 1: Fix loadFromStorage migration loop for pre-versioning data
- [x] Task 2: Quality gates -- all pass (tsc: 0 errors, vitest: 189/189 pass, bun test: 290/290 pass, eslint: N/A no config)
