# Cycle 61 Aggregate Review

## Findings (3 actionable, 1 deferred)

### F1: isAmountLike bare-integer threshold too loose in data inference (BUG - Medium)
Files: `packages/parser/src/csv/generic.ts`, `apps/web/src/lib/parser/csv.ts`
The AMOUNT_PATTERNS include `/^\d{5,}원?$/` which accepts 5-digit bare integers
(e.g., "12345", "67890") as amounts. During generic CSV data inference, this causes
false-positive amount column detection when columns contain transaction IDs, phone
suffixes, or serial numbers. Korean Won amounts of 5+ digits without thousand-separator
commas are uncommon in bank exports.
Fix: Raise threshold to 8 digits (`/^\d{8,}원?$/`) — bare amounts of 10,000,000 Won
without commas are plausible but rare, while 5-7 digit numbers are overwhelmingly
non-amount values. The comma-requiring pattern already handles "10,000,000".

### F2: Web-side CSV has 10 redundant hand-written bank adapters (TECH DEBT - Medium)
File: `apps/web/src/lib/parser/csv.ts` (lines 359-1056)
10 bank adapters (samsung, shinhan, kb, hyundai, lotte, hana, woori, nh, ibk, bc)
are hand-written with identical parse logic. The file already has `createBankAdapter()`
factory (lines 1074-1157) used by the remaining 14 banks. Converting the 10 adapters
to use the factory eliminates ~700 lines of duplicated code.
Fix: Replace all 10 hand-written adapters with createBankAdapter() factory calls.

### F3: Test gap for 8-digit bare integer amount threshold (TEST COVERAGE - Low)
Files: `packages/parser/__tests__/csv.test.ts`
After fixing F1, need a test to verify that 5-7 digit bare integers don't trigger
amount detection while 8+ digit bare integers do.

## Deferred
### D1: PDF multi-line header support
PDFs where header text wraps across 2+ lines remain unsupported. The table parser
detects single-row headers only. Low frequency, high complexity. Deferred to future cycle.

## Plan
1. Fix F1: Tighten AMOUNT_PATTERNS bare-integer threshold in server+web generic CSV
2. Fix F2: Replace 10 web-side hand-written adapters with factory calls
3. Fix F3: Add test for bare integer amount threshold
4. Run all gates
