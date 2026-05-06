# Verifier — cherrypicker (Cycle 23)

**Reviewer:** verifier
**Scope:** Evidence-based correctness check against stated behavior
**Date:** 2026-05-05

---

## Summary

Verified the C22 fixes are in place. Confirmed C23-SEC01 by constructing a concrete reproduction.

---

## Verified Behaviors

| Claim | Evidence | Status |
|-------|----------|--------|
| C22-SEC01 fixed | `html.ts:40` has regex | PARTIAL — works for simple cases, fails with spaces |
| C22-CR01 fixed | `csv.ts:128` uses `０-９` range | CONFIRMED |
| C22-PERF01 fixed | `store.svelte.ts:170` uses Blob size | CONFIRMED |
| C22-TEST01 added | `parser-html.test.ts:85-114` has sanitization tests | CONFIRMED |
| C22-TEST03 added | Server-side date-utils tests for full-width dot | CONFIRMED |

## New Verification

### C23-SEC01: Event handler regex gap

**Reproduction:**
```ts
const html = '<td onclick="alert(1); console.log(2)">value</td>';
const result = html.replace(/\son\w+=[^>\s]*/gi, '');
// result === '<td console.log(2)">value</td>'
```

**Expected:** `<td>value</td>`
**Actual:** `<td console.log(2)">value</td>`

**Verdict:** CONFIRMED BUG. The regex does not fully strip event handler attributes containing spaces.

---

## Carry-overs

| ID | Description | Status |
|----|-------------|--------|
| C22-DEBUG01 | Truncation keeps original transactionCount | OPEN |
| C22-TEST02 | No test for sessionStorage truncation | OPEN |
| C22-ARCH01 | normalizeHTML duplication | OPEN |
| C22-CR03 | Negative amounts in JSON parser | OPEN |
