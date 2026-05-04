# Code Reviewer — Cycle 7

## Findings

### C7-01: BOM Literal vs Escape in detect.ts [BUG]
**File**: `packages/parser/src/detect.ts:214`
**Severity**: Medium
BOM stripped using invisible literal character instead of `﻿`. Inconsistent with all other BOM handling.

### C7-02: No UTF-16 CSV Support [FEATURE GAP]
**Severity**: High
Korean Windows environments commonly produce UTF-16 LE CSVs from Excel. Current code only handles UTF-8 and CP949.

### C7-03: CP949 Detection Heuristic Is Fragile [QUALITY]
**Severity**: Medium
Replacement-character-ratio heuristic is arbitrary. Short files with 1 replacement char trigger false positives.

### C7-04: Encoding Not Propagated in DetectionResult [QUALITY]
**Severity**: Low
`encoding: 'utf-8'` is always returned for CSV regardless of actual encoding.

### C7-05: Dead Legacy Adapter Files [CODE HYGIENE]
**Severity**: Low
10 individual bank adapter files are not imported by csv/index.ts. Dead code superseded by adapter-factory.ts.

### C7-06: Won Sign Missing from Generic Parser Column-Inference [BUG]
**Severity**: Medium
AMOUNT_PATTERNS in generic.ts don't recognize `₩`/`￦` prefixed amounts for column detection.

### C7-07: English Column Names Not Recognized [FEATURE GAP]
**Severity**: Medium
All column patterns only match Korean. User-reformatted CSVs with English headers fail column detection.

### C7-08: PDF Table Parser Amount Pattern Matches Dates [QUALITY]
**Severity**: Low
`/[\d,]+원?/` has no anchors, matches digit sequences in dates.
