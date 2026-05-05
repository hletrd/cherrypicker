# Designer — Cycle 4 Findings

## Summary
4 findings on UX, component API, and visual consistency. 1 critical, 1 high, 2 medium.

## Findings

### U-DES-01 [CRITICAL] FileDropzone rejects supported file types
- **File**: `apps/web/src/components/upload/FileDropzone.svelte` lines 97-103
- **Issue**: `ACCEPTED_EXTENSIONS` only includes csv/xlsx/pdf. Parser supports json/ofx/qfx/html/htm but UI blocks them.
- **Impact**: Users cannot upload supported formats. Confusing error message.
- **Fix**: Derive accepted extensions from parser capability map.

### U-DES-02 [HIGH] Error messages are not user-friendly
- **File**: `apps/web/src/components/upload/FileDropzone.svelte`
- **Issue**: Parse errors show raw technical messages. No Korean localization for error states.
- **Fix**: Add localized error message map with friendly descriptions.

### U-DES-03 [MEDIUM] No loading state during analysis
- **File**: `apps/web/src/components/upload/FileDropzone.svelte`
- **Issue**: Large files parse synchronously with no progress indication. Browser appears frozen.
- **Fix**: Add progress bar or spinner with parse stage labels.

### U-DES-04 [MEDIUM] Results display lacks transaction detail
- **File**: `apps/web/src/pages/` (inferred)
- **Issue**: Optimization results show category totals but not per-transaction card assignments. Users cannot audit recommendations.
- **Fix**: Add expandable transaction list in results view.

## Recommendations
1. Sync UI accepted formats with parser capabilities automatically
2. Add Korean error messages for all parser failure modes
3. Consider Web Workers for file parsing to keep UI responsive
4. Add transaction-level breakdown to results view
