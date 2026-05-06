# Security Review — CherryPicker Cycle 41

**Date:** 2026-05-06
**Reviewer:** security-reviewer
**Cycle:** 41 / 100

---

## New Findings

### SEC-41-01: `normalizeHTML` regex can be bypassed by nested/malformed script tags (Low)

**File:** `packages/parser/src/csv/shared.ts:210-228` and `apps/web/src/lib/parser/html.ts:29-54`
**Confidence:** Medium

The server-side `normalizeHTML` uses a single-pass `.replace(/<script[\s\S]*?<\/script>/gi, '')`. For input like `<script>alert('</script>')</script>`, the regex matches up to the first `</script>`, leaving `')</script>` in the output. While SheetJS strips tags during parsing and the HTML is never rendered in a browser, this pattern is fragile.

The web-side version uses a while-loop that repeatedly scans, which is slightly more robust but still not guaranteed to catch all variants.

**Note:** This is defense-in-depth only — the HTML is parsed by SheetJS, not rendered. Actual XSS risk is low.

**Fix:** Use an HTML parser (like DOMParser) for security-critical stripping, or document that `normalizeHTML` is a best-effort sanitization for SheetJS input only.

---

### SEC-41-02: `safeJSONParse` forbids only specific prototype-pollution keys (Low)

**File:** `apps/web/src/lib/store.svelte.ts:220-231`
**Confidence:** Low

The forbidden key list is:
```typescript
const FORBIDDEN_KEYS = new Set([
  '__proto__', 'constructor', 'prototype',
  '__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__',
]);
```

This misses other prototype-pollution vectors like `__proto` (without trailing underscore, used by some pollution chains) and pollution via array indices. The reviver callback is a good defense but the key list is not comprehensive.

**Fix:** Expand the forbidden key list or use a more comprehensive JSON sanitization library.

---

## Carryover

| ID | Description | File | Severity |
|----|-------------|------|----------|
| SEC-01 | CSP unsafe-inline | `Layout.astro:50` | Medium |
| SEC-07 | Non-KRW transactions silently skipped | `reward.ts:220` | Medium |
| SEC-08 | sessionStorage encryption | Deferred | Low |
