# Cycle 4 Aggregate Review

## Summary
11 agents reviewed the entire cherrypicker repository. 55 total findings: 9 critical, 26 high, 20 medium. Focus areas: code quality (13), performance (7), security (6), architecture (7), testing (6), debugging (5), observability (5), documentation (5), UX (4).

## Critical Findings (9)

| ID | Agent | Description | File |
|----|-------|-------------|------|
| C-CR-01 | code-reviewer | Library code emits console.warn | `packages/core/src/calculator/reward.ts` |
| C-CR-02 | code-reviewer | Non-null assertion on unsafe regex match | `packages/parser/src/pdf/index.ts:361` |
| C-CR-03 | code-reviewer | FileDropzone `errorMessage` vs `errorMessages` | `apps/web/src/components/upload/FileDropzone.svelte` |
| F-CRI-01 | critic | Server/web parser parity gap | `packages/parser/` vs `apps/web/src/lib/parser/` |
| F-CRI-02 | critic | CATEGORY_NAMES_KO hardcoded in optimizer | `packages/core/src/optimizer/greedy.ts` |
| S-SEC-01 | security-reviewer | LLM fallback API key exposure risk | `packages/parser/src/pdf/llm-fallback.ts` |
| V-VER-01 | verifier | No test catches FileDropzone ReferenceError | `apps/web/src/components/upload/FileDropzone.svelte` |
| T-TE-01 | test-engineer | Missing FileDropzone error path tests | `apps/web/src/components/upload/FileDropzone.svelte` |
| D-DEB-01 | debugger | FileDropzone crashes on error | `apps/web/src/components/upload/FileDropzone.svelte` |

## High Findings (26) — Grouped by Theme

### Parser Issues (8)
- P-PR-03: PDF LLM fallback truncates to 8000 chars
- C-CR-07: Web parsers drop refunds (amount <= 0 filter)
- D-DEB-03: OFX date parser corrupts timezone data
- S-SEC-03: No input validation on uploaded file size
- U-DES-01: FileDropzone rejects supported file types
- P-PR-05: SheetJS parses entire HTML document
- R-TRA-01: Parser errors lack file context
- F-DOC-01: No API contract between parser and optimizer

### Optimizer Issues (4)
- P-PR-01: Greedy sort is O(n^2 log n)
- C-CR-04: Duplicate CATEGORY_NAMES_KO
- C-CR-06: MerchantMatcher O(n*m) per transaction
- F-CRI-03: No optimization correctness proof

### Architecture Issues (5)
- A-ARCH-01: Server/web parser code duplication
- A-ARCH-02: CATEGORY_NAMES_KO hardcoded
- A-ARCH-03: Card rules type duplicated in web app
- A-ARCH-04: No clear parser/categorizer boundary
- A-ARCH-05: Store persistence no schema versioning

### Testing Issues (4)
- V-VER-02: No parity tests between server/web parsers
- V-VER-03: No tests for refund handling
- T-TE-02: No parser parity test suite
- T-TE-03: Missing refund transaction test fixtures

### Reliability Issues (3)
- P-PR-04: fetcher.ts loses abort timeout on second fetch
- D-DEB-04: AbortController timeout not cleared on success
- S-SEC-02: fetcher.ts abort timeout lost on EUC-KR retry

## Deferred from Previous Cycles
See `.context/reviews/_aggregate.md` from cycles 2-3 for deferred items. This cycle focuses on new findings and un-deferred criticals.

## Cross-Cutting Themes
1. **Parser Parity**: Server and web parsers diverge silently. Need shared utilities or automated parity checks.
2. **Error Handling**: Ad-hoc console.warn, missing context, no structured logging.
3. **Type Safety**: Non-null assertions, inline type redefinitions, Svelte template variable mismatches.
4. **Performance**: No benchmarks, unbounded scans, large-memory allocations.
5. **Testing**: Happy-path bias, no error-path coverage, no parity verification.

## Agent Coverage
- code-reviewer: 13 findings (3 critical, 5 high, 5 medium)
- perf-reviewer: 7 findings (2 critical, 3 high, 2 medium)
- security-reviewer: 6 findings (1 critical, 2 high, 3 medium)
- critic: 8 findings (2 critical, 3 high, 3 medium)
- verifier: 5 findings (1 critical, 2 high, 2 medium)
- test-engineer: 6 findings (2 critical, 2 high, 2 medium)
- tracer: 5 findings (1 critical, 2 high, 2 medium)
- architect: 7 findings (2 critical, 3 high, 2 medium)
- debugger: 5 findings (2 critical, 2 high, 1 medium)
- document-specialist: 5 findings (1 critical, 2 high, 2 medium)
- designer: 4 findings (1 critical, 1 high, 2 medium)

Total: 55 findings
