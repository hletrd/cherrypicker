# Plan: Cycle 36 Fixes -- Web PDF parseAmount Parity + DRY Consolidation

**Status:** IN PROGRESS
**Source findings:** C36-01 (MEDIUM, High), C36-02 (LOW, High), C36-03 (LOW, High)

---

## Task 1: Fix web-side PDF parseAmount to handle parenthesized negative amounts (C36-01)

**Priority:** HIGH
**Severity:** MEDIUM
**Confidence:** High
**File:** `apps/web/src/lib/parser/pdf.ts:169-179`

### Problem

The web-side PDF `parseAmount` does not handle parenthesized negatives like `(1,234)`. Every other parser in the codebase (web CSV, web XLSX, server CSV, server XLSX, server PDF) correctly handles this format. For an input like `(1,234)`, the current code produces `NaN` which maps to `null`, silently dropping refund/cancellation transactions.

### Implementation

Replace the current `parseAmount` in `apps/web/src/lib/parser/pdf.ts`:

Current:
```typescript
function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/원$/, '').replace(/,/g, '');
  if (!cleaned.trim()) return null;
  const n = Math.round(parseFloat(cleaned));
  if (Number.isNaN(n)) return null;
  return n;
}
```

Fixed (matching the server-side PDF pattern at `packages/parser/src/pdf/index.ts:39-51`):
```typescript
function parseAmount(raw: string): number | null {
  let cleaned = raw.replace(/원$/, '').replace(/,/g, '');
  const isNeg = cleaned.startsWith('(') && cleaned.endsWith(')');
  if (isNeg) cleaned = cleaned.slice(1, -1);
  if (!cleaned.trim()) return null;
  const n = Math.round(parseFloat(cleaned));
  if (Number.isNaN(n)) return null;
  return isNeg ? -n : n;
}
```

### Verification

- `bun test` from repo root should pass
- `parseAmount("(1,234)")` returns `-1234`
- `parseAmount("1,234")` returns `1234` (no regression)
- `parseAmount("abc")` returns `null` (no regression)

---

## Task 2: Extract shared `splitLine` and `parseAmount` from server-side CSV adapters into utility module (C36-02)

**Priority:** MEDIUM
**Severity:** LOW
**Confidence:** High
**Files:**
- NEW: `packages/parser/src/csv/shared.ts`
- `packages/parser/src/csv/hyundai.ts`
- `packages/parser/src/csv/kb.ts`
- `packages/parser/src/csv/shinhan.ts`
- `packages/parser/src/csv/woori.ts`
- `packages/parser/src/csv/samsung.ts`
- `packages/parser/src/csv/hana.ts`
- `packages/parser/src/csv/nh.ts`
- `packages/parser/src/csv/lotte.ts`
- `packages/parser/src/csv/ibk.ts`
- `packages/parser/src/csv/bc.ts`
- `packages/parser/src/csv/generic.ts`

### Problem

`splitLine` (RFC 4180 compliant CSV line splitter) and `parseAmount` (amount parser with Math.round, null-for-NaN, parenthesized negatives) are copy-pasted identically across 11 files. If a bug is found in either function, it must be fixed in all locations independently.

### Implementation

1. Create `packages/parser/src/csv/shared.ts` with the shared functions:

```typescript
import type { ParseError } from '../types.js';

/** RFC 4180 compliant CSV line splitter. Handles quoted fields and
 *  doubled-quote escapes for comma-delimited content; falls back to
 *  simple split for other delimiters. */
export function splitCSVLine(line: string, delimiter: string): string[] {
  if (delimiter !== ',') return line.split(delimiter).map((v) => v.trim());
  const result: string[] = [];
  let inQuotes = false;
  let current = '';
  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/** Parse an amount string from CSV data. Returns null for unparseable inputs
 *  (NaN), handles parenthesized negatives, uses Math.round(parseFloat(...))
 *  for correct rounding, and strips Korean Won suffix and comma separators. */
export function parseCSVAmount(raw: string): number | null {
  let cleaned = raw.trim().replace(/원$/, '').replace(/,/g, '');
  const isNeg = cleaned.startsWith('(') && cleaned.endsWith(')');
  if (isNeg) cleaned = cleaned.slice(1, -1);
  if (!cleaned) return null;
  const n = Math.round(parseFloat(cleaned));
  if (Number.isNaN(n)) return null;
  return isNeg ? -n : n;
}

/** Parse an installment value from a CSV cell. Returns undefined for
 *  non-numeric values (e.g., "일시불" for lump-sum). Returns the
 *  installment count only when > 1. */
export function parseCSVInstallments(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const inst = parseInt(raw, 10);
  if (Number.isNaN(inst)) return undefined;
  return inst > 1 ? inst : undefined;
}
```

2. Update each of the 10 bank adapters to import from `shared.ts` and remove their local `splitLine`, `parseAmount`, and installment-parsing inline code.

3. Update `generic.ts` to import `splitCSVLine` from `shared.ts` and remove its local copy.

### Verification

- `bun test` from repo root should pass
- Bank adapter parsing behavior is unchanged (same functions, now centralized)
- No regressions in CSV parsing

---

## Task 3: Extract shared `buildCategoryLabelMap` utility (C36-03)

**Priority:** LOW
**Severity:** LOW
**Confidence:** High
**Files:**
- NEW: `apps/web/src/lib/category-labels.ts`
- `apps/web/src/lib/store.svelte.ts:316-329`
- `apps/web/src/lib/analyzer.ts:218-231, 274-295`
- `apps/web/src/components/cards/CardDetail.svelte:23-30`

### Problem

The categoryLabels Map construction (id + sub.id + dot-notation key) is duplicated in 4 locations. If the Map construction logic changes, all locations must be updated independently.

### Implementation

1. Create `apps/web/src/lib/category-labels.ts`:

```typescript
import type { CategoryNode } from './cards.js';

/** Build a Map from category IDs (including dot-notation subcategory keys)
 *  to their Korean labels. Used by the analyzer, store, and CardDetail. */
export function buildCategoryLabelMap(nodes: CategoryNode[]): Map<string, string> {
  const labels = new Map<string, string>();
  for (const node of nodes) {
    labels.set(node.id, node.labelKo);
    if (node.subcategories) {
      for (const sub of node.subcategories) {
        labels.set(sub.id, sub.labelKo);
        labels.set(`${node.id}.${sub.id}`, sub.labelKo);
      }
    }
  }
  return labels;
}
```

2. Replace inline Map construction in all 4 locations with calls to `buildCategoryLabelMap(nodes)`.

### Verification

- `bun test` from repo root should pass
- Category labels are still correctly resolved in dashboard, optimization, and card detail views

---

## Deferred Items

| Finding | Reason for Deferral |
|---|---|
| None | All findings have tasks scheduled above |

---

## Completion Tracking

| Task | Status |
|---|---|
| 1 | PENDING |
| 2 | PENDING |
| 3 | PENDING |
