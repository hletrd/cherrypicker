# Cycle 75 Implementation Plan

**Date:** 2026-04-22
**Status:** In Progress

---

## Task 1: Remove dead `prefix` return from `checkHTMLContent` or use it in the caller

**Finding:** C75-01 (refines C74-03/C73-06)
**Severity:** LOW / HIGH
**File:** `apps/web/src/lib/parser/xlsx.ts:262-297`

**Problem:** The C74-03 refactor changed `isHTMLContent` to `checkHTMLContent` returning `{ isHTML, prefix }`. However, the caller at line 297 still decodes the full buffer unconditionally and never uses the `prefix` field. The prefix is computed but dead code. The comment at lines 291-295 explains that `TextDecoder` doesn't support partial streaming in all browsers, so the full decode is necessary. But the `prefix` field in the return type is misleading.

**Fix options:**
- Option A: Remove the `prefix` field from the return type since it's unused, simplifying the function back to just returning `isHTML: boolean`. This is the cleanest approach.
- Option B: Actually use the prefix in the caller by slicing the buffer after the first 512 bytes and concatenating the decoded strings. This is more complex and has cross-browser concerns.

**Chosen approach:** Option A -- remove the `prefix` return field. Rename back to `isHTMLContent` returning `boolean`. This removes dead code and simplifies the API. The comment about double-decode overhead stays as documentation of the known limitation.

**Implementation:**
```typescript
function isHTMLContent(buffer: ArrayBuffer): boolean {
  const raw = new TextDecoder('utf-8').decode(buffer.slice(0, 512));
  const head = raw.replace(/^\uFEFF/, '').trimStart().toLowerCase();
  return head.startsWith('<!doctype') || head.startsWith('<html') || /<table[\s>]/.test(head);
}
```
And update the caller to use `isHTMLContent(buffer)` instead of `checkHTMLContent(buffer).isHTML`.

---

## Task 2: Add missing subcategory entries to `FALLBACK_CATEGORIES` in TransactionReview

**Finding:** C75-02 (refines C74-01)
**Severity:** LOW / HIGH
**File:** `apps/web/src/components/dashboard/TransactionReview.svelte:16-57`

**Problem:** The `FALLBACK_CATEGORIES` list added by C74-01 covers 25 dot-notation subcategories but misses several that exist in the YAML taxonomy (`packages/rules/data/categories.yaml`). The missing subcategories are:

From the YAML taxonomy:
- `dining.restaurant` (already present but label is "음식점" -- should be "일반음식점" to match YAML)
- `grocery.traditional_market` (전통시장)
- `grocery.online_grocery` (온라인식품)
- `online_shopping.general` (종합쇼핑몰)
- `offline_shopping.department_store` (백화점)
- `offline_shopping` top-level (오프라인쇼핑) -- missing from top-level categories too
- `insurance` top-level (보험) -- missing from top-level categories
- `subscription` top-level (구독) -- already present in fallback but as subcategory
- `travel.travel_agency` (여행사)
- `utilities.apartment_mgmt` (관리비)

Additionally, some labels in `FALLBACK_CATEGORIES` differ from the YAML taxonomy:
- `dining.restaurant` fallback: "음식점" vs YAML: "일반음식점"
- `utilities.electricity` fallback: "전기" vs YAML: "전기요금"
- `utilities.gas` fallback: "가스" vs YAML: "가스요금"
- `utilities.water` fallback: "수도" vs YAML: "수도요금"
- `travel.hotel` fallback: "숙박" vs YAML: "호텔/숙박"

**Fix:** Add the missing subcategories and correct the labels to match the YAML taxonomy. This ensures the fallback is consistent with the actual categories displayed when the fetch succeeds.

---

## Task 3: Add migration placeholder in `loadFromStorage` for future schema changes

**Finding:** C75-03 (refines C74-02)
**Severity:** LOW / MEDIUM
**File:** `apps/web/src/lib/store.svelte.ts:219-225`

**Problem:** The C74-02 fix added a version check that warns on mismatch but does not attempt migration. This is correct for v1 but leaves no structure for future migrations. When the schema actually changes, developers need to know where to add migration logic.

**Fix:** Add a `MIGRATIONS` map keyed by version number. For v1, it's empty but documents the pattern. When v2 is needed, a migration function transforms old data to the new shape before validation. This is a lightweight documentation/structure addition, not a full migration system.

**Implementation:**
```typescript
const STORAGE_VERSION = 1;

// Migration functions keyed by source version. Each function receives the
// raw parsed object and returns a (possibly transformed) object. Migrations
// run BEFORE validation so the validation logic sees the current schema shape.
// Example: when STORAGE_VERSION becomes 2, add: 1: (data) => ({ ...data, newField: data.newField ?? defaultValue })
const MIGRATIONS: Record<number, (data: any) => any> = {
  // No migrations yet -- v1 is the first versioned schema
};
```

Then in `loadFromStorage`, after the version check and before validation:
```typescript
// Apply migrations from the stored version to the current version
if (parsed._v !== undefined && parsed._v < STORAGE_VERSION) {
  for (let v = parsed._v; v < STORAGE_VERSION; v++) {
    const migrator = MIGRATIONS[v];
    if (migrator) parsed = migrator(parsed);
  }
}
```

---

## Task 4: Run quality gates (eslint, tsc --noEmit, vitest, bun test)

**Requirement:** All gates must pass before cycle completion.

---

## Deferred Items (this cycle)

The following findings from this cycle's review are deferred per the repo's rules:

### C75-01 partial: The double-decode overhead in xlsx.ts parseXLSX for HTML-as-XLS files
- **Severity:** LOW / HIGH
- **File:** `apps/web/src/lib/parser/xlsx.ts:297`
- **Reason for deferral:** The double-decode is bounded by the 10MB file size limit. Using the prefix to avoid the 512-byte overlap would require complex buffer slicing and partial TextDecoder streaming that is not reliably supported across browsers. The current approach (decode full buffer once) is simple and correct. Task 1 addresses the dead code (unused `prefix` return) but the double-decode itself remains.
- **Exit criterion:** If HTML-as-XLS files consistently exceed 5MB and memory usage becomes problematic, implement partial streaming decode.

### C75-03 partial: No actual migration logic needed until schema v2
- **Severity:** LOW / MEDIUM
- **File:** `apps/web/src/lib/store.svelte.ts:219-225`
- **Reason for deferral:** The version check and warning are already in place from C74-02. Task 3 adds the migration framework (empty MIGRATIONS map) but actual migration functions should only be written when the schema actually changes. Writing speculative migration code for hypothetical future schema changes would be dead code.
- **Exit criterion:** When STORAGE_VERSION is incremented to 2, add a migration function for v1->v2.

---

## Progress

- [ ] Task 1: Remove dead `prefix` return from checkHTMLContent
- [ ] Task 2: Add missing subcategory entries to FALLBACK_CATEGORIES and fix label mismatches
- [ ] Task 3: Add migration framework to loadFromStorage
- [ ] Task 4: Quality gates
