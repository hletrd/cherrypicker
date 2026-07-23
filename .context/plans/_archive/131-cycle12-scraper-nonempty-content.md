# Plan 131 — Cycle 12 Scraper Non-Empty Content Selection

**Finding:** C12-003 (`C12-CR-003`, Low/High)
**Status:** completed
**Deploy mode:** none

## Evidence

- The selector loop stops at the first existing element before trimming its
  text.
- A whitespace-only `<main>` prevents a populated `#content` from being used.
- The final empty string is passed to the extractor because only the maximum
  input size is guarded.

## Outcome

The scraper selects the first normalized non-empty candidate and fails locally
before an LLM request when no meaningful page content exists.

## Implementation

1. Add red cleaner tests for whitespace-first, empty-all-selectors, and body
   fallback cases.
2. Normalize each candidate before accepting it; continue past empty
   candidates.
3. Add an explicit non-empty extraction boundary or CLI guard before remote
   extraction.
4. Preserve noise removal, charset decoding, maximum input size, trust
   quarantine, and writer behavior.

## Acceptance

- [x] A populated later selector wins over an empty earlier selector.
- [x] Body fallback still works when no main selector contains content.
- [x] Fully empty pages fail before any extraction client request.
- [x] Existing SSRF, size-limit, and extraction-quarantine tests remain green.

## Execution note

The requested `ralph` skill is unavailable. Prompt 3 will use the approved
manual test-first fallback and will not make network requests or deploy.

## Completion evidence

- Red: the combined scraper regression set reported six failures while
  preserving 30 existing passes.
- Green: all 102 scraper tests and its TypeScript check passed; empty content
  now fails before an extraction client call.
- Commit:
  `3a22cbef8267c481dda8e5a6a392935df292c5f1`
  (`🐛 fix(scraper): require meaningful source content`).
