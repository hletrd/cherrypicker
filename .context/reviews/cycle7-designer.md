# Cycle 7 Designer Review

**Date:** 2026-05-05
**Scope:** UI/UX of web app — accessibility, forms, error states
**Reviewer:** designer

---

## Summary

Web app has Astro + Svelte frontend. No new UI components were added in Cycle 6. Existing accessibility fixes (scope attrs, aria-labels) from previous cycles remain intact. No new UI/UX regressions detected.

---

## LOW

### U7-DES-01: `FALLBACK_CATEGORY_LABELS` can show raw English IDs to users

**File:** `apps/web/src/lib/category-labels.ts:25-103`
**Confidence:** Low

If categories.json fails to load (e.g., network error, AbortError), the fallback Map is used. If the taxonomy has been updated with new categories not in this hardcoded Map, users see raw English category IDs like `subscription.general` instead of Korean labels.

**Fix:** Generate fallback labels at build time from the canonical taxonomy YAML.

### U7-DES-02: HTML report lacks CSP meta tag

**File:** `packages/viz/src/report/generator.ts` (template)
**Confidence:** Low

Generated HTML reports have no Content-Security-Policy. While reports are local files, opening them in a browser with compromised data could theoretically execute scripts.

**Fix:** Add CSP meta tag to report template.

---

## Verified (Previous Cycles)

| Fix | Status |
|-----|--------|
| Table header scope attrs | Verified — `scope="col"` on th elements |
| ARIA labels on Icon | Verified |
| FileDropzone accept attributes | Verified — includes .ofx, .html, .json |
| buildPageUrl() for nav | Verified — no raw BASE_URL |

---

## No Issues Found

- Focus/keyboard navigation: no changes
- Responsive breakpoints: no changes
- Loading/empty/error states: no changes
- Form validation: no changes
- Dark/light mode: no changes
- i18n/RTL: not applicable (Korean-only)
