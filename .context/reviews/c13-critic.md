# Critic — cherrypicker (Cycle 13)

**Reviewer:** critic
**Date:** 2026-05-05

---

## Multi-Perspective Critique

### Correctness: Strong (one regression risk)
The C13-04 PDF trailing-minus bug is a genuine correctness issue: refunds parsed as positive spending in the fallback path. The structured table path is unaffected. Severity is bounded by the fallback path being infrequently reached.

### Maintainability: Moderate (known deferred items)
Four hardcoded taxonomy duplicates remain. The double semicolon debris (C13-CR01) is a hygiene issue. Parser duplication (D-01) unchanged.

### Performance: Adequate
No new performance concerns. Test suite grew from ~540 to ~1730 tests; test runtime remains acceptable.

### Security: Acceptable
No HIGH/MEDIUM security findings. LLM fallback opt-in remains correctly implemented.

### UX: Good
No new UX regressions. Prior LOW items deferred.

### Testing: Improved but uneven
Server-side parser tests are now excellent (1408 tests, 14 files). Web-side parser tests remain sparse (4 files, no HTML/OFX/JSON coverage). This is the primary testing gap.

---

## Findings

### C13-CT01: Web-side parser test coverage is the new testing bottleneck [MEDIUM]

The web-side has 4 test files (`analyzer-adapter`, `formatters`, `parser-date`, `parser-encoding`). Missing: `parser-html`, `parser-ofx`, `parser-json`, `parser-xlsx`, `parser-pdf`, `parser-csv`. Server-side covers all 7 formats. The gap is a parity and regression risk.

### C13-CT02: Review cycle is approaching convergence [INFORMATIONAL]

After 13 cycles, new actionable findings are increasingly specific and bounded. The codebase is mature. Future high-value work should focus on deferred architectural items (D-01, C7-01) rather than incremental review.

---

## Recommendation

1. Fix C13-04 (PDF trailing-minus) — highest new actionable finding
2. Add web-side parser tests (T13-01) — highest testing gap
3. Schedule dedicated refactor cycle for D-01 (parser unification)
