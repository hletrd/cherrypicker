# Cycle 30 Aggregate Review

## Review Agents Participated
- code-reviewer (existing review from prior session)
- security-reviewer
- architect
- debugger
- test-engineer (existing review from prior session)

## Agent Failure Notes
- perf-reviewer: Not spawned (Agent tool unavailable)
- critic: Not spawned (Agent tool unavailable)
- verifier: Not spawned (Agent tool unavailable)
- tracer: Not spawned (Agent tool unavailable)
- document-specialist: Not spawned (Agent tool unavailable)
- designer: Not spawned (Agent tool unavailable)

## Cross-Agent Agreement

| Finding | Agents Flagging | Severity |
|---------|----------------|----------|
| JSON normalizeAmount swallows booleans | code-reviewer, debugger, test-engineer | High |
| OFX imports from csv.js not amount.js | code-reviewer, architect | High |
| Double HTML decode in xlsx.ts | architect, debugger | Medium |
| sessionStorage JSON.parse without reviver | security-reviewer | Medium |
| Weak Anthropic API key validation | security-reviewer | Medium |
| JSON description alias conflict | code-reviewer | Medium |
| Stale build-stats fallbacks | code-reviewer, debugger | Medium |
| SUMMARY_ROW_PATTERN false positives | code-reviewer, test-engineer | High |
| Type assertion in analyzer.ts | code-reviewer | Medium |
| Missing empty-string guard | debugger | Low |
| Numeric literal precision warning | debugger | Low |

## Highest Priority Fixes

### HIGH-01: JSON normalizeAmount silently swallows boolean/null values
- **Files:** `apps/web/src/lib/parser/json.ts:67-76`, `packages/parser/src/json/index.ts:79-88`
- **Problem:** `normalizeAmount` returns `null` for boolean values without any error. A JSON export with `amount: true` silently drops the transaction.
- **Fix:** Add explicit error reporting for unexpected types.

### HIGH-02: Web-side OFX parser imports parseAmountString from csv.js
- **File:** `apps/web/src/lib/parser/ofx.ts:10`
- **Problem:** Unnecessary transitive dependency on csv.ts. Should import from amount.js like html.ts does.
- **Fix:** Change import to `./amount.js`.

### HIGH-03: SUMMARY_ROW_PATTERN false-positive on merchant names
- **File:** `packages/parser/src/csv/column-matcher.ts:55`
- **Problem:** Pattern matches "합계" inside "합계마트", "소비" inside "소비마트". A legitimate merchant name containing these keywords would be incorrectly filtered as a summary row.
- **Fix:** Add word boundary constraints to the regex.

## Medium Priority Fixes

### MED-01: Double HTML decode in xlsx.ts
- **Files:** `apps/web/src/lib/parser/xlsx.ts:327-353`, `packages/parser/src/xlsx/index.ts:30-37`
- **Fix:** Refactor isHTMLContent to return decoded prefix, avoiding second decode.

### MED-02: sessionStorage JSON.parse without reviver
- **File:** `apps/web/src/lib/store.svelte.ts:218`
- **Fix:** Add safeJSONParse with forbidden key rejection.

### MED-03: Weak Anthropic API key validation
- **File:** `packages/parser/src/pdf/llm-fallback.ts:42-46`
- **Fix:** Use stricter regex: `/^sk-ant-api[0-9]{2}-[A-Za-z0-9_-]{40,}$/`.

### MED-04: JSON description alias conflict undocumented
- **Files:** `apps/web/src/lib/parser/json.ts:51-52`, `packages/parser/src/json/index.ts:56-57`
- **Fix:** Add comments explaining scan-order precedence.

### MED-05: Stale fallback values in build-stats.ts
- **File:** `apps/web/src/lib/build-stats.ts:16-18`
- **Fix:** Add console.warn when fallbacks are used.

### MED-06: Type assertion after manual validation
- **File:** `apps/web/src/lib/analyzer.ts:307`
- **Fix:** Remove `as AnalysisResult` cast.

## Low Priority Fixes

### LOW-01: Missing findField comment in web JSON parser
- **File:** `apps/web/src/lib/parser/json.ts:56-64`

### LOW-02: analyzer.ts throws on empty transactions
- **File:** `apps/web/src/lib/analyzer.ts:117-119`

### LOW-03: parseInt without Number.isFinite guard
- **File:** `apps/web/src/lib/parser/html.ts:259`

### LOW-04: Numeric literal precision warning
- **File:** `apps/web/__tests__/amount.test.ts:104-105`
