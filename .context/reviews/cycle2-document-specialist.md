# Cycle 2 Document-Specialist Review — Doc/Code Mismatches

---

## F-DOC-01: Server-side BOM stripping uses literal BOM character instead of unicode escape
**Severity: Low | Confidence: High**
**File**: `packages/parser/src/csv/index.ts` line 35

The code comment says "Strip UTF-8 BOM" but the actual regex uses a literal BOM character embedded in the source code (`﻿`). This works but is invisible in most editors. The web-side equivalent (`apps/web/src/lib/parser/csv.ts` line 969) also uses a literal character. Both should use `/﻿/` for clarity and robustness against source file encoding changes.

---

## F-DOC-02: Comments reference cycle numbers that don't correspond to current code
**Severity: Low | Confidence: High**
**Files**: Various

Many comments reference cycle numbers like "(C1-02)", "(C86-05)", "(C42-01)" etc. These are useful for tracing history but can confuse new contributors. The cycle numbers are opaque without access to the historical review documents. Consider replacing with more descriptive comments or linking to specific review files.

---

## F-DOC-03: CLAUDE.md mentions "Bun" for parser but parser tsconfig targets NodeNext
**Severity: Low | Confidence: High**
**File**: `packages/parser/tsconfig.json`

CLAUDE.md says parser runs on Bun. The tsconfig should be checked to confirm it's compatible with both Bun and Node. This is a minor documentation concern since the parser likely works on both.

---

## F-DOC-04: Column-matcher patterns are documented as "shared" but only used by adapter-factory
**Severity: Low | Confidence: High**
**File**: `packages/parser/src/csv/column-matcher.ts` line 1

The module comment says it "Provides header normalization and regex-based column detection so that bank adapters tolerate column name variations." The exported pattern constants are described as "Reusable column pattern constants -- shared across all bank adapters." In practice, only the adapter-factory imports and uses these. The generic CSV parser and XLSX parser have their own inline copies.

---

## F-DOC-05: Cycle 1 plan references deferred items without exit criteria
**Severity: Low | Confidence: High**
**File**: `.context/plans/cycle1-parser-diversity-plan.md`

The plan has deferred items like "Task 2.3: Refactor web-side bank adapters" and "Task 3.1: Create shared bank adapter config module" with brief reasons but no specific exit criteria for when they should be picked up. The plan format should include explicit exit criteria per deferred item.