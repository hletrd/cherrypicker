# Cycle 9 — Code Reviewer

## C9-CR01: CATEGORY_COLORS in CategoryBreakdown.svelte is a fourth hardcoded taxonomy duplicate
- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:8-87`
- **Description:** `CATEGORY_COLORS` is an 80-entry Record mapping category IDs to hex colors. This is a fourth hardcoded duplicate of the YAML taxonomy (after CATEGORY_NAMES_KO, FALLBACK_CATEGORY_LABELS, FALLBACK_GROUPS). When the taxonomy adds or renames a category, this map must also be updated in lockstep, or new categories silently fall back to gray. The `entertainment.subscription` inconsistency from C7-04 is also present here (line 80).
- **Failure scenario:** A new category "coffee" is added to categories.yaml. CATEGORY_COLORS has no entry for it, so it renders gray, making it visually indistinguishable from "uncategorized".
- **Fix:** Generate CATEGORY_COLORS from the taxonomy data at build time or runtime, with a deterministic color assignment algorithm (e.g., hash-based) and manual overrides only for specific categories.

## C9-CR02: ALL_BANKS in FileDropzone.svelte duplicates detect.ts bank list
- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/upload/FileDropzone.svelte:80-105`
- **Description:** `ALL_BANKS` is a 24-entry array of bank IDs and labels that duplicates the bank ID list in `packages/parser/src/detect.ts`. If a new bank is added to detect.ts, it must also be added here. The order also differs (detect.ts has 'cu' listed as '신협' but FileDropzone labels it '신협' too, so labels match, but the list must stay in sync).
- **Failure scenario:** A new bank is added to the parser but not to the FileDropzone bank selector, making it impossible for users to manually select that bank.
- **Fix:** Generate the bank list from a shared source, or import the bank signatures from a shared module.

## C9-CR03: formatIssuerNameKo in formatters.ts duplicates issuer name data
- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/formatters.ts:52-79`
- **Description:** `formatIssuerNameKo` is a 23-entry Record mapping issuer IDs to Korean names, duplicating data that exists in cards.json's `issuers[].nameKo`. If a new issuer is added or a name changes, this map must be updated in lockstep.
- **Failure scenario:** A new issuer is added to cards.json but formatIssuerNameKo returns the raw ID (e.g., "newbank") instead of the Korean name.
- **Fix:** Build this map at runtime from cards.json data instead of hardcoding it.

## C9-CR04: getIssuerColor in formatters.ts duplicates issuer color data
- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/formatters.ts:115-143`
- **Description:** `getIssuerColor` is a 23-entry Record mapping issuer IDs to hex colors. This duplicates data that could be derived from the issuer data. Must be updated in lockstep when issuers are added.
- **Failure scenario:** Same as C9-CR03.
- **Fix:** Consider generating from a shared source or adding colors to the issuer data model.

## C9-CR05: buildConstraints creates an unnecessary shallow copy of transactions
- **Severity:** LOW
- **Confidence:** Medium
- **File:** `packages/core/src/optimizer/constraints.ts:16`
- **Description:** `const preservedTransactions = [...transactions]` creates a shallow copy of the transaction array. The comment says "keep original transactions intact" but the greedy optimizer only reads from this array (never mutates it). The spread is defensive but wasteful for large transaction sets.
- **Fix:** Either remove the spread (if confirmed the optimizer never mutates) or add a comment explaining the defensive copy is intentional for a specific reason.

## C9-CR06: getCategoryIconName in formatters.ts is another hardcoded taxonomy duplicate
- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/formatters.ts:85-110`
- **Description:** `getCategoryIconName` maps category IDs to icon names. Another hardcoded duplicate that must be updated in lockstep with the taxonomy. New categories fall through to 'credit-card'.
- **Fix:** Same class as C9-CR01 — generate from taxonomy or add icon mapping to the taxonomy data.

## Previously known (not re-reported)
- C7-01 (CATEGORY_NAMES_KO drift) — MEDIUM, unchanged
- C7-02 (FALLBACK_CATEGORY_LABELS drift) — MEDIUM, unchanged
- C7-03 (Dead UploadResult type) — LOW, unchanged
- C7-04 (entertainment.subscription inconsistency) — LOW, unchanged
- C8-01 (FALLBACK_GROUPS third duplicate) — LOW, deferred
- C8-02 (Bucket creation order) — DONE
