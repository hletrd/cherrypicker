# Debugger Review — Cycle 38

## New Findings

### BUG-38-01: HTML parser silent data loss inconsistency
**Severity:** Medium | **Confidence:** High | **Files:**
- `packages/parser/src/html/index.ts:249`
- `apps/web/src/lib/parser/html.ts:259`

Both HTML parsers use `if (amount <= 0) continue;` to skip non-spending transactions without reporting an error. This is inconsistent with JSON and OFX parsers which now emit ParseErrors (commit 4672848).

**Failure scenario:** User uploads HTML statement with refund transactions. Refunds silently disappear with no UI feedback. Same file in JSON format would show "지출로 처리되지 않는 금액입니다" errors.

### BUG-38-02: XLSX parser silent data loss
**Severity:** Medium | **Confidence:** High | **File:** `packages/parser/src/xlsx/index.ts:416`

Same pattern: `if (amount <= 0) continue;` without ParseError.

## Verified Fixed

- BUG-37-01: JSON ParseError for non-spending amounts (commit 4672848)
- C37-V04: isOnline dead code removed (commit b5c393d)
- C37-V07: NaN validation in analyzer (commit 589af72)

## Carryover

- BUG-37-02 (OFX timezone): Still fragile but works for KST
- BUG-37-03 (normalizeHTML): Could strip legitimate content — low impact
