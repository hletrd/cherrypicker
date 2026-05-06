# Critic Review — CherryPicker Cycle 41

**Date:** 2026-05-06
**Reviewer:** critic
**Cycle:** 41 / 100

---

## Observations

### C41-CRIT01: Cycle reference comments have become technical debt (Medium)

**Confidence:** High

Every function and fix is annotated with cycle references like `(C40-BUG02)`, `(C39-PERF01)`, `(C97-02)`. After 41+ cycles, these outnumber actual code lines in some files. They serve no runtime purpose, bloat diffs, and become inaccurate as code evolves.

**Impact:** New contributors must learn the cycle numbering convention. Code archaeology becomes harder because cycle numbers are not searchable in git history.

**Recommendation:** Remove cycle references older than Cycle 20. Use git commit messages for provenance.

---

### C41-CRIT02: Test for precision loss documents incorrect behavior (Medium)

**File:** `apps/web/__tests__/amount.test.ts:104-105`
**Confidence:** High

The test `expect(parseAmount('9999999999999999')).toBe(9999999999999999)` passes because both sides are the same imprecise float. This is not testing correct behavior — it's testing that JavaScript's float imprecision is consistent. A test should either:
- Assert that amounts above MAX_SAFE_INTEGER are rejected, OR
- Document the known precision limit

Current state: the test gives false confidence that large amounts are handled correctly.

---

### C41-CRIT03: `Promise.all` batch failure is poor UX (Medium)

**File:** `apps/web/src/lib/analyzer.ts:315-317`
**Confidence:** High

When a user uploads multiple files and one fails, all fail. The error message doesn't identify which file caused the problem. This is a product-level issue masquerading as an implementation detail.

**Recommendation:** Restructure batch analysis to return per-file results with individual error states.

---

### C41-CRIT04: OFX timezone handling is over-engineered and wrong (Medium)

**File:** `packages/parser/src/ofx/index.ts:88-115`
**Confidence:** High

The timezone conversion code is complex (UTC ms computation, KST shift, getUTC* reads) and produces wrong dates for time-only entries without timezone. Korean bank OFX exports rarely include time or timezone. The code handles a case that almost never occurs, and handles it incorrectly.

**Recommendation:** Simplify: if no timezone present, treat as KST directly. If timezone present, apply the offset.

---

## Cross-Agent Agreement

- **Precision loss test** (CR-41-01, BUG-41-03, C41-CRIT02): AGREED by code-reviewer, debugger, critic.
- **OFX timezone bug** (CR-41-03, BUG-41-01, C41-CRIT04): AGREED by code-reviewer, debugger, critic.
- **Batch error handling** (BUG-41-02, C41-CRIT03, ARCH-41-01): AGREED by debugger, architect, critic.
