# Designer — cherrypicker (Cycle 20)

**Reviewer:** designer (sonnet)
**Scope:** UX, component API, visual consistency, interaction design
**Date:** 2026-05-05

---

## Summary

No new UI components were added in cycle 19. Cycle 20 review identifies a small UX gap in error message consistency and a potential accessibility issue in the HTML report generator.

---

## New Findings

### [C20-UI01-LOW] HTML report lacks semantic table structure for screen readers

**Files:** `packages/viz/src/report/generator.ts:75-136`
**Confidence:** Medium

The generated HTML tables use `<table>`, `<thead>`, `<tbody>`, `<th>` elements — good. But there are no `scope="col"` attributes on header cells, no `caption` elements, and no `aria-label` on the tables. Screen readers may struggle with multi-column data tables.

**Fix:** Add `scope="col"` to `<th>` elements and `caption` to each table.

---

### [C20-UI02-LOW] Error messages mix technical and user-friendly Korean

**Files:** `apps/web/src/lib/parser/` (all formats)
**Confidence:** Medium

Parser error messages are in Korean but use technical terms:
- "금액을 해석할 수 없습니다" (good)
- "헤더 행을 찾을 수 없습니다" (technical — "header row" is jargon)
- "OFX 파일에서 거래 내역을 찾을 수 없습니다" (mixes English "OFX" with Korean)

**Fix:** Standardize error messages. Use "파일" instead of format names. Use "첫 줄" instead of "헤더 행".

---

## Previously Reported — Status

| ID | Description | Status |
|----|-------------|--------|
| U-DES-02 | Error messages not user-friendly | **OPEN** |
| U-DES-03 | No loading state during analysis | **OPEN** |
| U-DES-04 | Results display lacks transaction detail | **OPEN** |

---

## Verdict

**FIX AND SHIP** — C20-UI01 is bounded. C20-UI02 is part of the ongoing U-DES-02 effort.
