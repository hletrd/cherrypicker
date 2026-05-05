# Security Review — cherrypicker (Cycle 19)

**Reviewer:** security-reviewer
**Scope:** OWASP Top 10, secrets, unsafe patterns, injection risks, XSS
**Date:** 2026-05-06

---

## Summary

Cycle 18 removed unnecessary backslash escaping from `esc()`. Cycle 19 review finds a latent XSS vector in the HTML report generator and a regex construction pattern in the OFX parser that would be dangerous if the tag names were ever dynamic.

---

## New Findings

### C19-SEC01 [MEDIUM] — Double-encoded HTML entity bypass in report generator

**File:** `packages/viz/src/report/generator.ts:31-42`
**Confidence:** Medium

The `esc()` function encodes `&` → `&amp;`, but if input contains pre-encoded entities like `&#x3C;script&#x3E;`, the browser's entity decoder will resolve `&amp;#x3C;` back to `<`. Current data sources (static card JSON, taxonomy) are trusted, but the `buildAssignments` function passes `cap.category` through `esc()`, and category keys originate from transaction data which is user-uploaded.

In practice, the MerchantMatcher normalizes categories to known taxonomy IDs, making exploitation unlikely. However, the architectural pattern is unsafe — a future change that bypasses the matcher could expose this vector.

**Fix:** Decode entities before escaping, or use a dedicated HTML encoding library.

---

### C19-SEC02 [LOW] — Dynamic regex construction in OFX parser

**File:** `packages/parser/src/ofx/index.ts:61-65` / `apps/web/src/lib/parser/ofx.ts:33-36`
**Confidence:** Low

```ts
const xmlRe = new RegExp(`<${tagName}[^>]*>\\s*([^<]+?)\\s*</${tagName}>`, 'i');
```

`tagName` is hardcoded to values like `'DTPOSTED'`, `'TRNAMT'`, `'NAME'` — not attacker-controlled. The pattern is safe today but would become a ReDoS vector if `tagName` were ever derived from user input. The `[^<]+?` reluctant quantifier mitigates catastrophic backtracking.

**Fix:** No immediate action needed. Add a comment warning against dynamic tagName values.

---

## Carry-overs from Previous Cycles

- **S-SEC-05** — Regex denial of service in column patterns (MEDIUM)
- **A-ARCH-01** — Server/web parser duplication increases attack surface (CRITICAL)

---

## Verdict

**FIX AND SHIP** — Address C19-SEC01 with proper HTML entity handling before the report generator processes any user-influenced data paths.
