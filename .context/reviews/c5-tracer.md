# Cycle 5 — Tracer

**Date:** 2026-04-24
**Reviewer:** tracer
**Scope:** Causal tracing of suspicious flows

---

## C5-TR01: Astro page URL construction bypasses the `buildPageUrl()` safety layer

- **Severity:** MEDIUM
- **Confidence:** High
- **File+line:** `apps/web/src/pages/dashboard.astro:15,39,113`, `apps/web/src/pages/results.astro:12,36,89,108,117`, `apps/web/src/pages/report.astro:13,44`
- **Description:** Tracing the URL construction flow:
  1. User clicks "명세서 올리러 가기" link on empty dashboard state
  2. href is `${import.meta.env.BASE_URL}` → resolves to `/cherrypicker/` in production
  3. Works correctly because Astro ensures trailing slash

  Alternative trace:
  1. Developer sets `BASE_URL=/cherrypicker` (no trailing slash) during local development
  2. User clicks "추천 결과 보기" link on dashboard
  3. href is `${import.meta.env.BASE_URL}results` → resolves to `/cherrypickerresults`
  4. 404 error — navigation broken

  Competing hypotheses:
  - H1 (confirmed): Raw concatenation lacks trailing-slash handling that `buildPageUrl()` provides
  - H2 (rejected): Astro always normalizes BASE_URL at build time, so the trailing slash is guaranteed. While true for production builds, the `buildPageUrl()` helper was created specifically as a defensive measure for this edge case.

- **Fix:** Migrate Astro page hrefs to use `buildPageUrl()`.

---

## Final Sweep

No other suspicious data flows identified. The sessionStorage persistence flow, the reoptimize flow, and the parser/categorizer pipeline all have proper guards and validation.
