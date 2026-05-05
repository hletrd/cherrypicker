# Security Review — cherrypicker (Cycle 6)

**Reviewer:** security-reviewer
**Scope:** Changes since Cycle 5 + residual security posture
**Date:** 2026-05-06

---

## Summary

Cycle 6 made meaningful security improvements: explicit LLM consent flow (addresses S-SEC-01) and path traversal validation (addresses S-SEC-04). Two HIGH findings from Cycle 5 remain open, and one new MEDIUM finding was introduced.

---

## Verified Fixed

| Finding | Commit | Evidence |
|---------|--------|----------|
| S-SEC-01: LLM transmits financial data without consent | 41fb34c | `requireRemoteLLMConsent()` enforces `--allow-remote-llm`; interactive prompt for confirmation |
| S-SEC-04: Path traversal in CLI file args | ce91407 | `validateFilePath()` rejects `..` segments; tests cover `../foo`, `foo/../bar`, `/tmp/../etc/passwd` |

---

## New Findings (Cycle 6)

### [S6-01-MEDIUM] Path validation gaps: null bytes, symlinks, URL-encoded traversal

**File:** `tools/cli/src/validation.ts:7-29`
**Confidence:** High

`validateFilePath()` blocks `..` segments but has three gaps:

1. **Null byte injection:** `path.replace(/\\/g, '/')` does not strip null bytes (`\x00`). On Linux, `open("/etc/passwd\x00.txt")` resolves to `/etc/passwd` due to C-string null termination. A path like `/tmp/evil\x00../etc/passwd` would pass validation.

2. **Symlink traversal:** No `lstat()` or `realpath()` check. A path like `/tmp/legit/evil-symlink -> /etc/passwd` passes both `..` checks and existence checks.

3. **URL-encoded traversal:** A path containing `%2e%2e%2f` (URL-encoded `../`) is not decoded before checking.

**Failure scenario:** An attacker creates a symlink in a directory the user is expected to access, pointing to sensitive files. The user runs `cherrypicker analyze /tmp/legit/evil-symlink`. Validation passes, and the file is read.

**Fix:** Add null-byte stripping (`path.replace(/\x00/g, '')`), and use `realpath()` or `lstat()` to detect symlinks. Consider adding a `--no-symlinks` flag or always rejecting symlinks with a clear error.

---

### [S6-02-MEDIUM] LLM consent prompt has no timeout — process hangs on piped stdin

**File:** `tools/cli/src/consent.ts:16-28`
**Confidence:** Medium

If stdin is redirected from a file or pipe that does not contain a newline (e.g., `echo -n '' | cherrypicker analyze file.pdf --allow-remote-llm`), the process hangs indefinitely. In CI pipelines or scripted environments, this causes build/job timeouts rather than clean errors.

**Fix:** Add a timeout to the readline prompt, defaulting to 30 seconds. Reject with a clear error message when the timeout fires.

---

## Still Open from Cycle 5

| ID | Description | Severity | Status |
|----|-------------|----------|--------|
| S-SEC-02 | HTML report `esc()` only handles 7 entities — XSS risk | HIGH | **OPEN** |
| S-SEC-03 | API key format validation before use | MEDIUM | **PARTIAL** — `llm-fallback.ts:42-46` validates `sk-ant-` prefix and length >= 20 |
| S-SEC-05 | Regex denial of service in column patterns | MEDIUM | **OPEN** |
| S-SEC-06 | Missing CSP in generated HTML reports | MEDIUM | **OPEN** |

---

## Notes

The `ANTHROPIC_API_KEY` validation (`sk-ant-` prefix, length >= 20) is a good first step but insufficient. Anthropic API keys are longer (typically 100+ chars). Consider adding a more precise length check (e.g., >= 80) and documenting the expected format.
