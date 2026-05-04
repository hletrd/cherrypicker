# Cycle 7 Aggregate Review

## Summary
8 new findings from code review. Baseline: 218 vitest + 201 bun tests passing.

## Critical Findings (Must Fix)

### F1: UTF-16 CSV Support [C7-02]
Korean Windows Excel commonly exports UTF-16 LE CSVs. The parser completely ignores UTF-16.
**Impact**: High — entire files unparseable
**Fix**: Detect UTF-16 LE/BE BOMs, decode with TextDecoder('utf-16le'/'utf-16be')

### F2: CP949 Encoding Before Bank Detection [C7-03, A7-02]
detectFormat() decodes CSV as UTF-8 for bank detection, garbling CP949 Korean text. Bank detection fails.
**Impact**: High — wrong adapter or generic fallback used
**Fix**: Detect encoding from raw bytes before decoding

### F3: BOM Literal Character [C7-01]
detect.ts uses invisible literal BOM instead of `﻿` escape.
**Impact**: Medium — maintenance hazard, inconsistency
**Fix**: Replace with explicit `﻿`

### F4: Won Sign in Column Inference [C7-06]
Generic parser's AMOUNT_PATTERNS don't recognize ₩/￦ prefixed amounts.
**Impact**: Medium — amount column not detected during inference
**Fix**: Add ₩/￦ to patterns

## Moderate Findings (Should Fix)

### F5: English Column Name Patterns [C7-07]
Column matcher only recognizes Korean headers. English headers ("Date", "Amount") not matched.
**Impact**: Medium — user-modified files fail
**Fix**: Add English alternatives to column regex patterns

### F6: Dead Legacy Adapter Files [C7-05]
10 files in packages/parser/src/csv/ are dead code.
**Impact**: Low — confusion, maintenance burden
**Fix**: Remove all 10 files

## Deferred Items

### D1: Web vs Server Parser Duplication [A7-03]
Requires shared module refactor. Deferred.

### D2: Input Size Limits [C7-S03]
Acceptable for CLI tool. Deferred for web upload.

### D3: PDF Amount Pattern Anchoring [C7-08]
Low severity, filterTransactionRows provides sufficient guard. Deferred.
