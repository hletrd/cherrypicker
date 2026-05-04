# Architect — Cycle 7

## Architecture Review

### A7-01: Dead Code Elimination
10 legacy adapter files in packages/parser/src/csv/{bank}.ts are superseded by adapter-factory.ts. No imports. Remove.

### A7-02: Encoding Architecture
detectFormat() always assumes UTF-8 for bank detection. CP949 files get garbled Korean text, causing bank detection failure. Fix: detect encoding before bank detection.

### A7-03: Web vs Server Parser Duplication [DEFERRED]
Significant duplication remains. Requires shared module refactor for Bun+browser compatibility.

### A7-04: Column Pattern Extensibility
Adding English patterns to regex-based column matcher is straightforward. No architecture change needed.
