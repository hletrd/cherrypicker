# Designer Review — CherryPicker Web Frontend (Cycle 37)

**Reviewer:** designer
**Scope:** UI/UX, visual design, accessibility, responsive design, component patterns
**Date:** 2026-05-06

---

## Summary

No new UI components or visual changes in Cycle 37. The designer review focuses on verifying prior findings and identifying UX implications of parser behavior. Two new UX issues identified related to silent data loss across all parsers.

| Category | Count | Severity |
|---|---|---|
| New Findings | 2 | 1 Medium, 1 Low |
| Carryover (still open) | 26 | — |
| Verified Safe | 4 | — |

---

## NEW FINDINGS (Cycle 37)

### U-DES-37-01: No User Feedback When Transactions Are Filtered Out
**File:** All parsers → `FileDropzone.svelte`, `store.svelte.ts`
**Severity:** Medium | **Confidence:** High

All six parsers (CSV, XLSX, PDF, HTML, JSON, OFX) silently filter out certain transactions:
- Refunds/credits (negative or positive amounts)
- Zero-amount rows
- Unparseable rows

The UI shows a transaction count but does NOT indicate how many transactions were filtered. A user uploading a statement with 3 refunds sees "42 transactions" instead of "45 transactions (3 filtered)". This is confusing and erodes trust.

**Fix:** Add a dismissible info banner when filtered transactions exist: `"3개의 환불/입금 거래가 최적화에 포함되지 않았습니다."`

---

### U-DES-37-02: Parser Error Messages Are Not Differentiated by Format
**File:** `apps/web/src/lib/store.svelte.ts`
**Severity:** Low | **Confidence:** Medium

The `parseErrors` array from `analyzeMultipleFiles` is displayed as a flat list. When multiple files are uploaded with different formats, errors from CSV, HTML, and OFX are indistinguishable. A user sees:
- `금액을 해석할 수 없습니다: abc`
- `날짜를 해석할 수 없습니다: `  

Without knowing which file produced which error.

**Fix:** Prefix parse errors with the file format and index: `"[파일 2 - HTML] 날짜를 해석할 수 없습니다..."`

---

## CARRYOVER (still open from prior cycles)

See Cycle 32 designer review for the complete list of 26 open findings. Key high-priority carryovers:

| Priority | Finding | File |
|----------|---------|------|
| High | 2.1 — KB issuer badge contrast | `formatters.ts:150` |
| High | 2.2 — Rate bars too thin | `OptimalCardMap.svelte:125` |
| High | 2.5 — Hover tooltip not touch-friendly | `CategoryBreakdown.svelte:201` |
| High | 3.1 — Tables on mobile | Multiple |
| High | 1.1 — Hardcoded colors bypass tokens | Multiple |
| Medium | 4.2 — Error states lack visual richness | `CardGrid.svelte:175` |
| Medium | 6.2 — Dashboard animation replay | `dashboard.astro:54` |

---

## Verified Safe (No Change)

- Empty states remain consistent with icon + title + subtitle + CTA pattern
- Loading skeletons still use appropriate gray scales
- Dark mode toggle functions correctly
- File dropzone step indicator provides clear upload progress
