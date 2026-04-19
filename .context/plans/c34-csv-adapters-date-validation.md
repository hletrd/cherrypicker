# Plan: C34-03 — Bank-specific CSV adapters lack month/day range validation in parseDateToISO

**Status:** DONE
**Finding:** C34-03 (LOW, High confidence)
**Files:**
- `packages/parser/src/csv/hyundai.ts:4-10`
- `packages/parser/src/csv/kb.ts:4-10`
- `packages/parser/src/csv/ibk.ts:4-10`
- `packages/parser/src/csv/woori.ts:4-10`
- `packages/parser/src/csv/samsung.ts:4-10`
- `packages/parser/src/csv/shinhan.ts:4-10`
- `packages/parser/src/csv/lotte.ts:4-10`
- `packages/parser/src/csv/hana.ts:4-10`
- `packages/parser/src/csv/nh.ts:4-10`
- `packages/parser/src/csv/bc.ts:4-10`

## Problem

Each bank-specific CSV adapter has its own local `parseDateToISO` function that handles YYYY-MM-DD and YYYYMMDD formats but does not validate month/day ranges. The main `packages/parser/src/csv/index.ts` (which provides the generic fallback) does have range validation, but bank-specific adapters are called first.

## Implementation

### Step 1: Add month/day range validation to each bank adapter's parseDateToISO

For each adapter, update the full-date handler to validate month/day:

Current pattern (e.g., bc.ts):
```ts
function parseDateToISO(raw: string): string {
  const cleaned = raw.trim();
  const fullMatch = cleaned.match(/^(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/);
  if (fullMatch) return `${fullMatch[1]}-${fullMatch[2]!.padStart(2, '0')}-${fullMatch[3]!.padStart(2, '0')}`;
  if (/^\d{8}$/.test(cleaned)) return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`;
  return cleaned;
}
```

Fixed pattern:
```ts
function parseDateToISO(raw: string): string {
  const cleaned = raw.trim();
  const fullMatch = cleaned.match(/^(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/);
  if (fullMatch) {
    const month = parseInt(fullMatch[2]!, 10);
    const day = parseInt(fullMatch[3]!, 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${fullMatch[1]}-${fullMatch[2]!.padStart(2, '0')}-${fullMatch[3]!.padStart(2, '0')}`;
    }
  }
  if (/^\d{8}$/.test(cleaned)) {
    const month = parseInt(cleaned.slice(4, 6), 10);
    const day = parseInt(cleaned.slice(6, 8), 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`;
    }
  }
  return cleaned;
}
```

### Step 2: Apply to all 10 adapters

Apply the same validation pattern to all 10 bank adapters listed above. The only variation is that `kb.ts` and `samsung.ts` use `[.\-\/\s]` instead of `[.\-\/]` in their regex — preserve that difference.

### Step 3: Verify bun test passes

Run `bun test` from the repo root. All 266 tests should pass.

## Verification

- `bun test` from repo root should pass with 0 errors and 0 failures
- Each adapter's parseDateToISO rejects invalid month/day values
