# Debugger — cherrypicker (Cycle 23)

**Reviewer:** debugger
**Scope:** Root-cause analysis, edge cases, failure modes
**Date:** 2026-05-05

---

## Summary

Cycle 22 fixed several correctness issues. Cycle 23 finds that the C22-SEC01 HTML sanitization fix introduced a regression where event handler attribute values containing spaces are only partially stripped.

---

## New Findings

### [C23-DEBUG01-HIGH] Event handler regex strips only prefix when value contains spaces

**Files:** `apps/web/src/lib/parser/html.ts:40`
**Confidence:** High

**Root cause:** The regex `\son\w+=[^>\s]*` uses a negated character class `[^>\s]*` that terminates at any whitespace character. In HTML attribute values, spaces are common (e.g., separating statements in JavaScript).

**Failure scenario:**
```
Input:  <td onclick="alert(1); console.log(2)">value</td>
Regex:  \son\w+=[^>\s]*
Match:   onclick="alert(1);   (stops at space before console)
Output: <td console.log(2)">value</td>
```

**Impact:** The remaining `console.log(2)"` is malformed HTML that SheetJS may parse unexpectedly. While SheetJS doesn't execute JavaScript, the sanitization boundary is weakened, and future changes to SheetJS or other consumers of `normalizeHTML` could be at risk.

**Fix:** Replace with the server-side's two-pattern approach:
```ts
.replace(/\son\w+=["'][^"']*["']/gi, '')
.replace(/\son\w+=\w+/gi, '')
```

---

## Carry-overs

| ID | Description | Severity | Status |
|----|-------------|----------|--------|
| C22-DEBUG01 | Truncation keeps original transactionCount | LOW | **OPEN** |

---

## Verdict

**FIX AND SHIP** — The regex regression is a bounded, high-confidence fix.
