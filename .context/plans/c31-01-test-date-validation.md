# Plan: C31-01 — Update test file's parseDateToISO and add missing test cases

**Status:** DONE
**Finding:** C31-01 (MEDIUM, High confidence)
**Files:** `apps/web/__tests__/parser-date.test.ts`

## Problem

The test file reproduces `parseDateToISO` locally (since it is a private function), but the local copy has drifted from the production code:

1. Line 35: YYYYMMDD handler lacks range validation (production csv.ts:46-54 and xlsx.ts:212-220 validate)
2. Lines 30-32: Full-date handler lacks range validation (production code being fixed in C32-02)
3. Lines 37-43: Short-year handler lacks range validation (production code being fixed in C32-03)

The test file also has no test cases for:
- Invalid YYYYMMDD strings (e.g., "20261399")
- Invalid full-date strings (e.g., "2026/13/99")
- Invalid short-year strings (e.g., "99/13/99")

## Implementation

### Step 1: Update the test file's local parseDateToISO

Update lines 30-43 to add range validation matching the production code:
- YYYYMMDD: add month/day range check before formatting
- Full-date: add month/day range check before formatting
- Short-year: add month/day range check before formatting

### Step 2: Add YYYYMMDD invalid-date test cases

```typescript
test('YYYYMMDD with month > 12 is rejected', () => {
  expect(parseDateToISO('20261399')).toBe('20261399');
});

test('YYYYMMDD with day > 31 is rejected', () => {
  expect(parseDateToISO('20260132')).toBe('20260132');
});

test('YYYYMMDD with month 0 is rejected', () => {
  expect(parseDateToISO('20260015')).toBe('20260015');
});

test('YYYYMMDD with day 0 is rejected', () => {
  expect(parseDateToISO('20260100')).toBe('20260100');
});
```

### Step 3: Add full-date invalid-date test cases

```typescript
test('full-date with month > 12 is rejected', () => {
  expect(parseDateToISO('2026/13/99')).toBe('2026/13/99');
});

test('full-date with day > 31 is rejected', () => {
  expect(parseDateToISO('2026/01/32')).toBe('2026/01/32');
});
```

### Step 4: Add short-year invalid-date test cases

```typescript
test('short-year with month > 12 is rejected', () => {
  expect(parseDateToISO('99/13/99')).toBe('99/13/99');
});

test('short-year with day > 31 is rejected', () => {
  expect(parseDateToISO('99/01/32')).toBe('99/01/32');
});
```

## Verification

- Run `bun test apps/web/__tests__/parser-date.test.ts` — all tests should pass
- Invalid dates should be returned unchanged (fall through to the final `return cleaned`)
