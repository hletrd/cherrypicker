# Cycle 38 High Priority Implementation Plan

**Source:** `.context/reviews/cycle38-aggregate.md`, `.context/reviews/cycle38-code-reviewer.md`, `.context/reviews/cycle38-debugger.md`, `.context/reviews/cycle38-critic.md`

---

## Task 1: Add ParseError for non-positive amounts in HTML parser (server-side)

**Finding:** BUG-38-01
**File:** `packages/parser/src/html/index.ts:249`
**Change:** Replace `if (amount <= 0) continue;` with error-reporting block consistent with JSON/OFX parsers.

```typescript
// Before:
if (amount <= 0) continue;

// After:
if (amount <= 0) {
  errors.push(new ParseError(
    `지출로 처리되지 않는 금액입니다: ${merchantRaw || '알 수 없는 거래'} ${amount}원`,
    { line: i + 1, raw: rowText },
  ));
  continue;
}
```

**Risk:** Low — adds error reporting, no logic change
**Tests:** Existing HTML parser tests should pass; add test for negative amount error

---

## Task 2: Add ParseError for non-positive amounts in HTML parser (web-side)

**Finding:** BUG-38-01
**File:** `apps/web/src/lib/parser/html.ts:259`
**Change:** Same pattern as Task 1.

```typescript
if (amount <= 0) {
  errors.push(new ParseError(
    `지출로 처리되지 않는 금액입니다: ${merchantRaw || '알 수 없는 거래'} ${amount}원`,
    { line: i + 1, raw: rowText },
  ));
  continue;
}
```

**Risk:** Low
**Tests:** Existing web HTML parser tests should pass

---

## Task 3: Add ParseError for non-positive amounts in XLSX parser (server-side)

**Finding:** BUG-38-02
**File:** `packages/parser/src/xlsx/index.ts:416`
**Change:** Replace `if (amount <= 0) continue;` with error-reporting block.

```typescript
if (amount <= 0) {
  errors.push(new ParseError(
    `지출로 처리되지 않는 금액입니다: ${String(merchantRaw ?? '').trim() || '알 수 없는 거래'} ${amount}원`,
    { line: i + 1, raw: rowText },
  ));
  continue;
}
```

**Risk:** Low
**Tests:** Existing XLSX parser tests should pass

---

## Task 4: Add ParseError for non-positive amounts in CSV isValidCSVAmount

**Finding:** CR-38-01
**File:** `packages/parser/src/csv/shared.ts:122`
**Change:** Add ParseError push in `isValidCSVAmount` before returning false for amount <= 0.

```typescript
if (amount <= 0) {
  if (amountRaw.trim()) {
    errors.push(new ParseError(
      `지출로 처리되지 않는 금액입니다: ${amountRaw} ${amount}원`,
      { line: lineIdx + 1 },
    ));
  }
  return false;
}
```

**Risk:** Low — but affects all CSV adapters that use isValidCSVAmount
**Tests:** CSV adapter tests, CSV generic parser tests

---

## Task 5: Verify and fix web-side XLSX parser

**Finding:** CR-38-02
**File:** `apps/web/src/lib/parser/xlsx.ts`
**Action:** Check if web-side XLSX parser also silently skips non-positive amounts. If so, add ParseError.

---

## Deferred from Cycle 38

| ID | Severity | Reason | Exit Criterion |
|----|----------|--------|----------------|
| BUG-37-02 | Medium | OFX timezone math works for KST (only timezone used) | Cross-timezone OFX support needed |
| BUG-37-03 | Low | normalizeHTML false positives rare | User report of stripped content |
| BUG-4 | High | EUC-KR detection requires larger refactor | Dedicated encoding detection cycle |
| SEC-01 | Medium | CSP nonce requires Astro build changes | Security hardening cycle |
| PERF-02 | Medium | Needs benchmarking before optimization | Performance measurement cycle |
