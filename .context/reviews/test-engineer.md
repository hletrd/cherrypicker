# Test Engineer -- Cycle 34

**Date:** 2026-05-05

## New Test Cases Needed

1. **Server PDF AMOUNT_PATTERN Won-sign** — Test that "₩500" and "￦500" match the server PDF AMOUNT_PATTERN (F-01)
2. **Server PDF fallback Won-sign** — Test fallbackAmountPattern catches "₩1,234" and "￦6,500" (F-02)
3. **Server XLSX 마이너스 prefix** — Test parseAmount("마이너스5000") returns -5000 (F-03)
4. **Web PDF 마이너스 prefix** — Test web parseAmount("마이너스6,500") returns -6500 (F-04)
5. **Won-sign column inference in PDF** — Verify Won-sign amounts in PDF text trigger correct amount column detection