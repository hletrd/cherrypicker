# Cycle 27 — Architecture Review

## Summary
The dominant architectural concern remains server/web parser duplication (A-ARCH-01). Cycle 27 finds additional intra-web duplication and a module coupling issue.

---

## Carry-over: A-ARCH-01 — Server/web parser duplication (CRITICAL)

Status: Unchanged. The duplication now spans 6 format modules (CSV, XLSX, HTML, JSON, OFX, PDF) plus detect.ts. The shared modules (column-matcher.ts, date-utils.ts) work well. The blocker for full dedup remains the `.js` extension import resolution difference between Bun and Vite/Astro.

---

## LOW: Intra-web parseAmount duplication (csv.ts vs pdf.ts)

**Files:** `apps/web/src/lib/parser/csv.ts:123-151`, `apps/web/src/lib/parser/pdf.ts:246-274`
**Confidence:** High

Within the web parser directory alone, `parseAmount` is defined twice with ~95% identical logic. This is separate from the server/web duplication. Extracting a shared `amount.ts` utility within `apps/web/src/lib/parser/` would eliminate this intra-web duplication and reduce the risk of drift.

---

## LOW: XLSX-to-HTML module coupling

**Files:** `apps/web/src/lib/parser/xlsx.ts:5`
**Confidence:** Medium

The web XLSX parser imports `normalizeHTML` from `./html.ts`, creating a dependency from XLSX to HTML. This is not ideal architecturally because XLSX parsing should not depend on HTML parsing logic. The dependency exists only for the HTML-as-XLS detection path.

**Fix:** Extract `normalizeHTML` to a shared utility (e.g., `./normalize-html.ts`) that both HTML and XLSX parsers can import without creating cross-parser dependencies.
