# Verifier -- Cycle 34

**Date:** 2026-05-05

## Status
Pending implementation of 5 findings.

## Pre-verification Checklist
- [ ] F-01: Server PDF AMOUNT_PATTERN has ╋ alternation
- [ ] F-02: Both server and web PDF fallback regex have Won-sign alternations
- [ ] F-03: Server XLSX parseAmount handles "마이너스" prefix
- [ ] F-04: Web PDF parseAmount handles "마이너스" prefix
- [ ] F-05: All new tests pass
- [ ] All existing tests still pass (no regressions)