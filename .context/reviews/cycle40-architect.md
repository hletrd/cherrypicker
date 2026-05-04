# Architecture Review -- Cycle 40

## Deferred Architecture Items

### D-01: Web CSV parser vs server-side duplication [DEFERRED - large refactor]
The web-side `csv.ts` duplicates 10 bank-specific adapters instead of sharing the factory. Requires shared module that works in both Bun and browser environments. Not actionable in a single cycle.

### D-02: Bank column config triplication [DEFERRED - depends on D-01]
Column configs are defined in 3 places: server XLSX adapters, server CSV adapter-factory, and web XLSX parser. Dedup requires D-01.

### D-03: Server/web PDF parser duplication [DEFERRED]
Both PDF parsers implement identical table parsing, header detection, and fallback scanning. Requires shared module.

## Actionable This Cycle

### A-1: Add 14 missing bank adapters to web CSV parser
Port the 14 bank configs from server adapter-factory to web csv.ts. Each adapter is just a config object.

### A-2: Add test coverage for the 14 new CSV adapters
Add bun tests verifying parsing works for at least a few representative new banks.
