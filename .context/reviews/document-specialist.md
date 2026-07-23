# Cycle 3 — Document Specialist

**Review target:** `614ce5c`
**Lens:** public help, user-facing report prose, inline contracts, and their agreement with executable behavior.

## Coverage

Reviewed root README/policy material, CLI help and error usage, web upload/report text, standalone HTML template, public package comments, generated-data notices, all issuer READMEs, and the Cycle 1/2 documentation closure records. The durable-report disclosure gap is already recorded as `C3-CT-001` and is not duplicated here.

## Findings

### C3-DOC-001 — CLI subcommand help is unavailable and report usage omits correctness-critical options

- **Severity:** Medium
- **Confidence:** High
- **Status:** confirmed
- **Location:** `tools/cli/src/index.ts:8-33,40-65`; `tools/cli/src/commands/report.ts:31-79`; comparison `tools/cli/src/commands/optimize.ts:30-73`
- **Concrete failure scenario:** A report user needs to provide actual previous-month spending or a custom card/category catalog. They try `cherrypicker report --help`, but the CLI treats `--help` as the statement filename and returns a file-not-found error. The only report usage line lists `--output`, remote-LLM consent, and `--yes`, so the user cannot discover `--prev-spending`, `--cards`, `--bank`, or `--categories` from report help and may unknowingly accept the 0-won previous-spending assumption.
- **Evidence:** Top-level help handles `--help` only before a command and lists merely global `--help`/`--version`. `report` parses six value-bearing/behavior options plus consent flags, but its missing-file usage text omits four of those options. Executing both `report --help` and `optimize --help` produced `명세서 파일을 찾을 수 없습니다: --help ...`. There is no command-level help branch or complete option reference elsewhere in the root README.
- **Suggested fix:** Give every subcommand a side-effect-free `--help` path and generate usage from one option specification shared with argument parsing. For `report`, document output, cards, categories, bank, previous spending, remote fallback/consent, defaults, and the exact-calendar-month/0-won assumption. Add stdout/exit-code snapshot tests so parsed options and help cannot drift.

## Documentation consistency notes

- Web report prose correctly matches current previous-spending and unsupported-rule behavior.
- The root format list agrees with current upload support.
- Generated-data “do not edit” notices and issuer/catalog counts agree with `data:check`.
- The standalone report's generic disclaimer is factually harmless but insufficient for its actual exclusions; remediation belongs to `C3-CT-001` rather than a second documentation ID.

No other documentation mismatch met the finding threshold.
