# Aggregate Review — CherryPicker Cycle 36

## Methodology
Reviews performed by: code-reviewer, security-reviewer, perf-reviewer.
All findings cross-referenced for duplicates. Multi-agent agreement noted.

---

## SUMMARY

| Severity | New | Carryover | Total |
|----------|-----|-----------|-------|
| Medium | 4 | 2 | 6 |
| Low | 8 | 7 | 15 |

Total unique findings: 21 (9 new, 12 carryover, 3 verified fixed)

---

## VERIFIED FIXED (from Cycle 35)

| ID | Finding | Status |
|----|---------|--------|
| CR-03 | `toCoreCardRuleSets` threw on unknown reward type | **FIXED** — now defaults to `'none'` |
| CR-04 | `console.warn` leaked into production | **FIXED** — warning removed |
| CR-06 | `performanceTiers` ordering not validated | **FIXED** — explicit sort added |

---

## CROSS-AGENT AGREEMENT

1. **I/O inefficiency in parser** (CR-11, PERF-08): **AGREED** by code-reviewer and perf-reviewer. `detectFormat` reads entire file into memory; buffer not reused for actual parsing.
2. **LLM fallback security gaps** (SEC-03, SEC-06, CR-10): **AGREED** by security-reviewer and code-reviewer. Regex-based sanitization is incomplete; model name is outdated.
3. **Silent data loss for non-KRW** (SEC-07): **AGREED** by security-reviewer alone. HIGH confidence — transactions disappear from results with no user indication.

---

## DEFERRED FINDINGS

### Deferred: PERF-01 (keywords.ts bundle size)
- **Severity**: Low | **Confidence**: High
- **Reason**: Requires measurement before action. Bundle impact may be negligible with tree-shaking.
- **Exit criterion**: Run bundle analysis and confirm >100KB impact.

### Deferred: PERF-02 (optimizer incremental update)
- **Severity**: Medium | **Confidence**: High
- **Reason**: Algorithmic change with risk of regression. Needs benchmarking before implementation.
- **Exit criterion**: Benchmark current O(N*M*T) vs proposed O(N*M) with real datasets.

### Deferred: SEC-08 (sessionStorage encryption)
- **Severity**: Low | **Confidence**: High
- **Reason**: Requires UX design for key management. Current threat model (single-user browser) accepts plaintext.
- **Exit criterion**: Security audit flags this as required.

### Deferred: CR-07, CR-17 (type unification, parser dedup)
- **Severity**: Low-Medium | **Confidence**: High
- **Reason**: Large refactoring with high regression risk. Requires dedicated cycle.
- **Exit criterion**: When >5 type adapter bugs accumulate or parser parity tests fail.

---

## SCHEDULED FOR IMPLEMENTATION (This Cycle)

### Medium Priority
1. **CR-01**: Silent JSON.parse error swallowing in detect.ts — add ParseError to result
2. **CR-02**: Silent error swallowing in HTML parser — add ParseError to result
3. **CR-05**: Add zero-amount guard in `scoreCardsForTransaction`
4. **CR-09**: Fix Windows path bug in CLI tools (`fileURLToPath`)
5. **CR-10**: Update hardcoded model name in scraper, add validation
6. **CR-12**: Fix CP949 detection for small buffers
7. **CR-15**: Decompose SUMMARY_ROW_PATTERN to avoid ReDoS
8. **SEC-01**: CSP unsafe-inline — add nonce-based CSP to Layout.astro
9. **SEC-07**: Surface non-KRW skipped transactions in output
10. **PERF-06**: Optimize `cardPreviousSpending` calculation in analyzer.ts

### Low Priority
11. **CR-08**: Validate categoryLabels Map is non-empty
12. **CR-11**: Reuse buffer between detectFormat and parseStatement
13. **CR-13**: Replace `any` with `unknown` + narrowing in store.svelte.ts
14. **CR-14**: Add timeout to fetch in cards.ts
15. **CR-16**: Add cancellation for in-flight analyze/reoptimize
16. **PERF-03**: Pre-size arrays in buildAssignments
17. **PERF-04**: Add debounce/isAnalyzing guard to FileDropzone
18. **PERF-05**: Debounce sessionStorage persistence
19. **PERF-07**: Document MerchantMatcher O(N) scan limitation
20. **PERF-08**: Read only header bytes for format sniffing
21. **SEC-03**: Add max-size guard before LLM fallback processing
22. **SEC-04**: Tighten Anthropic API key regex
23. **SEC-05**: Add rate limiting to LLM fallback
24. **SEC-06**: Replace regex-based LLM sanitization with allowlist approach

---

## AGENT NOTES
- No agent failures. All reviews completed manually due to unavailable Agent tool.
- Code-review and security-review have the highest confidence on findings with concrete file locations.
- Performance findings are largely theoretical; real-world impact requires profiling.
