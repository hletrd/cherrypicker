# Cycle 25 — Document Specialist (2026-05-06)

## Documentation Assessment

### Code Comments

The web-side HTML parser at `apps/web/src/lib/parser/html.ts:163-165` has a clear comment explaining why forward-fill is reset:
```typescript
// Reset forward-fill state so summary row values don't propagate
// to merged data cells below (C20-04).
```

The server-side HTML parser at `packages/parser/src/html/index.ts:156` lacks a corresponding comment. A reader might assume the `continue` is sufficient, not realizing the reset is missing.

**Recommendation:** When fixing C25-COR01, add a comment matching the web-side explanation.

### Commit References

- C20-04 introduced the forward-fill reset on the web side
- C98-02 added server-side HTML parsing (without the reset)
- C24-SEC01 claimed to fix BOTH regexes but only fixed the quoted pattern

These historical references are tracked in code comments but the cross-cycle consistency is not documented anywhere except the review files.

## No other documentation findings
