import { describe, test, expect } from 'bun:test';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import xlsx from 'xlsx';
import { parseXLSX } from '../src/xlsx/index.js';

const FIXTURE_DIR = join(import.meta.dir, 'fixtures', 'xlsx-gen');
let fileCounter = 0;

function createTempXLSX(rows: unknown[][], sheets?: { name: string; rows: unknown[][] }[]): string {
  mkdirSync(FIXTURE_DIR, { recursive: true });
  const wb = xlsx.utils.book_new();
  if (sheets) {
    for (const s of sheets) {
      const ws = xlsx.utils.aoa_to_sheet(s.rows);
      xlsx.utils.book_append_sheet(wb, ws, s.name);
    }
  } else {
    const ws = xlsx.utils.aoa_to_sheet(rows);
    xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
  }
  const raw = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const buf = Buffer.from(raw);
  const filePath = join(FIXTURE_DIR, `test-${++fileCounter}.xlsx`);
  writeFileSync(filePath, buf);
  return filePath;
}

function cleanup(filePath: string) {
  try { rmSync(filePath, { force: true }); } catch { /* ignore */ }
}

describe('parseXLSX', () => {
  test('parses basic KB-format XLSX', async () => {
    const filePath = createTempXLSX([
      ['KB국민카드 이용내역'],
      [],
      ['거래일시', '가맹점명', '이용금액', '할부개월', '업종'],
      ['2026-02-01', '스타벅스 서초점', 6000, 0, '카페'],
      ['2026-02-02', '맥도날드 역삼점', 8900, 0, '패스트푸드'],
      ['2026-02-03', '이마트', 45000, 0, '마트'],
    ]);
    try {
      const result = await parseXLSX(filePath);
      expect(result.format).toBe('xlsx');
      expect(result.bank).toBe('kb');
      expect(result.transactions).toHaveLength(3);
      expect(result.transactions[0]?.date).toBe('2026-02-01');
      expect(result.transactions[0]?.merchant).toBe('스타벅스 서초점');
      expect(result.transactions[0]?.amount).toBe(6000);
      expect(result.errors).toHaveLength(0);
    } finally {
      cleanup(filePath);
    }
  });

  test('parses Samsung-format XLSX', async () => {
    const filePath = createTempXLSX([
      ['삼성카드 이용내역'],
      [],
      ['이용일', '가맹점명', '이용금액', '할부', '업종'],
      ['2026-02-01', '스타벅스 강남점', 7000, 0, '카페'],
      ['2026-02-02', '이마트 마트', 120000, 3, '마트'],
    ]);
    try {
      const result = await parseXLSX(filePath);
      expect(result.bank).toBe('samsung');
      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[1]?.installments).toBe(3);
    } finally {
      cleanup(filePath);
    }
  });

  test('handles Excel serial date numbers', async () => {
    // 45323 = 2024-02-01 in Excel serial date system
    const filePath = createTempXLSX([
      ['거래일시', '가맹점명', '이용금액'],
      [45323, '테스트 가맹점', 10000],
    ]);
    try {
      const result = await parseXLSX(filePath);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]?.date).toBe('2024-02-01');
    } finally {
      cleanup(filePath);
    }
  });

  test('skips summary rows containing 합계', async () => {
    const filePath = createTempXLSX([
      ['거래일시', '가맹점명', '이용금액'],
      ['2026-02-01', '스타벅스', 6000],
      ['합계', '', 6000],
    ]);
    try {
      const result = await parseXLSX(filePath);
      expect(result.transactions).toHaveLength(1);
    } finally {
      cleanup(filePath);
    }
  });

  test('skips zero and negative amounts', async () => {
    const filePath = createTempXLSX([
      ['거래일시', '가맹점명', '이용금액'],
      ['2026-02-01', '스타벅스', 6000],
      ['2026-02-02', '잔액조회', 0],
      ['2026-02-03', '환불', -5000],
    ]);
    try {
      const result = await parseXLSX(filePath);
      expect(result.transactions).toHaveLength(1);
    } finally {
      cleanup(filePath);
    }
  });

  test('returns error for empty workbook', async () => {
    const filePath = createTempXLSX([]);
    try {
      const result = await parseXLSX(filePath);
      expect(result.transactions).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
    } finally {
      cleanup(filePath);
    }
  });

  test('parses parenthesized amounts as negative', async () => {
    const filePath = createTempXLSX([
      ['거래일시', '가맹점명', '이용금액'],
      ['2026-02-01', '환불', '(5000)'],
      ['2026-02-02', '스타벅스', 6000],
    ]);
    try {
      const result = await parseXLSX(filePath);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]?.amount).toBe(6000);
    } finally {
      cleanup(filePath);
    }
  });

  test('handles multi-sheet workbook by selecting best sheet', async () => {
    const filePath = createTempXLSX([], [
      {
        name: '요약',
        rows: [
          ['거래일시', '가맹점명', '이용금액'],
          ['2026-02-01', '스타벅스', 6000],
        ],
      },
      {
        name: '상세',
        rows: [
          ['거래일시', '가맹점명', '이용금액'],
          ['2026-02-01', '스타벅스', 6000],
          ['2026-02-02', '이마트', 45000],
          ['2026-02-03', 'GS25', 3200],
        ],
      },
    ]);
    try {
      const result = await parseXLSX(filePath);
      expect(result.transactions).toHaveLength(3);
    } finally {
      cleanup(filePath);
    }
  });

  test('handles amount with 원 suffix', async () => {
    const filePath = createTempXLSX([
      ['거래일시', '가맹점명', '이용금액'],
      ['2026-02-01', '스타벅스', '6,500원'],
    ]);
    try {
      const result = await parseXLSX(filePath);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]?.amount).toBe(6500);
    } finally {
      cleanup(filePath);
    }
  });

  test('detects bank from header content', async () => {
    const filePath = createTempXLSX([
      ['신한카드 이용내역'],
      ['이용일', '이용처', '이용금액', '할부개월수', '업종분류'],
      ['2026-02-01', '스타벅스', 6500, 0, '카페'],
    ]);
    try {
      const result = await parseXLSX(filePath);
      expect(result.bank).toBe('shinhan');
    } finally {
      cleanup(filePath);
    }
  });

  test('parses amounts with comma separators', async () => {
    const filePath = createTempXLSX([
      ['거래일시', '가맹점명', '이용금액'],
      ['2026-02-01', '이마트', '1,250,000'],
    ]);
    try {
      const result = await parseXLSX(filePath);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]?.amount).toBe(1250000);
    } finally {
      cleanup(filePath);
    }
  });

  test('parses amounts with Won sign prefix (C6-05)', async () => {
    const filePath = createTempXLSX([
      ['거래일시', '가맹점명', '이용금액'],
      ['2026-02-01', '스타벅스', '₩6,500'],
      ['2026-02-02', '이마트', '￦30,000'],
    ]);
    try {
      const result = await parseXLSX(filePath);
      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0]?.amount).toBe(6500);
      expect(result.transactions[1]?.amount).toBe(30000);
    } finally {
      cleanup(filePath);
    }
  });

  test('handles Date objects in cells (C6-04)', async () => {
    const filePath = createTempXLSX([
      ['이용일', '이용처', '이용금액'],
      [new Date(2024, 1, 1), '스타벅스', 5500],
    ]);
    try {
      const result = await parseXLSX(filePath);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]?.date).toBe('2024-02-01');
    } finally {
      cleanup(filePath);
    }
  });

  test('handles headers with parenthetical suffixes (C6-01)', async () => {
    const filePath = createTempXLSX([
      ['카드사 이용내역'],
      ['이용일', '이용처', '이용금액(원)', '할부(개월)'],
      ['2026-02-01', '스타벅스', 6500, 0],
    ]);
    try {
      const result = await parseXLSX(filePath);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]?.amount).toBe(6500);
    } finally {
      cleanup(filePath);
    }
  });

  test('handles headers with extra whitespace (C6-01)', async () => {
    const filePath = createTempXLSX([
      ['이용 일', '이용 처', '이용 금액'],
      ['2026-02-01', '스타벅스', 6500],
    ]);
    try {
      const result = await parseXLSX(filePath);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]?.merchant).toBe('스타벅스');
    } finally {
      cleanup(filePath);
    }
  });
});

// ---------------------------------------------------------------------------
// Merged cell forward-fill tests (C4-04)
// ---------------------------------------------------------------------------

describe('XLSX merged cell forward-fill', () => {
  test('forward-fills date for rows with empty date cell', async () => {
    // Simulates merged cells: date appears only in first row of a group
    const filePath = createTempXLSX([
      ['이용일', '이용처', '이용금액'],
      ['2026-02-01', '스타벅스', 5500],
      ['', '이마트', 30000],
      ['', '편의점', 3500],
      ['2026-02-02', '카페', 4500],
    ]);
    try {
      const result = await parseXLSX(filePath);
      expect(result.transactions).toHaveLength(4);
      expect(result.transactions[0]?.date).toBe('2026-02-01');
      expect(result.transactions[1]?.date).toBe('2026-02-01');
      expect(result.transactions[2]?.date).toBe('2026-02-01');
      expect(result.transactions[3]?.date).toBe('2026-02-02');
      expect(result.transactions[1]?.merchant).toBe('이마트');
      expect(result.transactions[1]?.amount).toBe(30000);
    } finally {
      cleanup(filePath);
    }
  });

  test('does not forward-fill when date cells are all populated', async () => {
    const filePath = createTempXLSX([
      ['이용일', '이용처', '이용금액'],
      ['2026-02-01', '스타벅스', 5500],
      ['2026-02-02', '이마트', 30000],
    ]);
    try {
      const result = await parseXLSX(filePath);
      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0]?.date).toBe('2026-02-01');
      expect(result.transactions[1]?.date).toBe('2026-02-02');
    } finally {
      cleanup(filePath);
    }
  });

  test('forward-fills merchant for merged cells (C5-03)', async () => {
    const filePath = createTempXLSX([
      ['이용일', '이용처', '이용금액', '업종'],
      ['2026-02-01', '이마트', 10000, '마트'],
      ['2026-02-01', '', 20000, ''],
      ['2026-02-02', '스타벅스', 5500, '카페'],
    ]);
    try {
      const result = await parseXLSX(filePath);
      expect(result.transactions).toHaveLength(3);
      expect(result.transactions[0]?.merchant).toBe('이마트');
      expect(result.transactions[1]?.merchant).toBe('이마트');
      expect(result.transactions[2]?.merchant).toBe('스타벅스');
    } finally {
      cleanup(filePath);
    }
  });

  test('forward-fills category for merged cells (C5-03)', async () => {
    const filePath = createTempXLSX([
      ['이용일', '이용처', '이용금액', '업종'],
      ['2026-02-01', '이마트', 10000, '마트'],
      ['2026-02-01', '이마트 분점', 20000, ''],
      ['2026-02-02', '스타벅스', 5500, '카페'],
    ]);
    try {
      const result = await parseXLSX(filePath);
      expect(result.transactions).toHaveLength(3);
      expect(result.transactions[0]?.category).toBe('마트');
      expect(result.transactions[1]?.category).toBe('마트');
      expect(result.transactions[2]?.category).toBe('카페');
    } finally {
      cleanup(filePath);
    }
  });

  test('forward-fills all merged columns together (C5-03)', async () => {
    // Simulates installment groups: date, merchant, and category all merged
    const filePath = createTempXLSX([
      ['이용일', '이용처', '이용금액', '할부', '업종'],
      ['2026-02-01', '롯데백화점', 30000, 3, '쇼핑'],
      ['', '', 30000, '', ''],
      ['', '', 30000, '', ''],
      ['2026-02-02', '이마트', 50000, 0, '마트'],
    ]);
    try {
      const result = await parseXLSX(filePath);
      expect(result.transactions).toHaveLength(4);
      expect(result.transactions[0]?.merchant).toBe('롯데백화점');
      expect(result.transactions[1]?.merchant).toBe('롯데백화점');
      expect(result.transactions[2]?.merchant).toBe('롯데백화점');
      expect(result.transactions[0]?.category).toBe('쇼핑');
      expect(result.transactions[1]?.category).toBe('쇼핑');
      expect(result.transactions[2]?.category).toBe('쇼핑');
      expect(result.transactions[3]?.merchant).toBe('이마트');
      expect(result.transactions[3]?.category).toBe('마트');
    } finally {
      cleanup(filePath);
    }
  });
});

// ---------------------------------------------------------------------------
// Invalid serial date error reporting (C5-01)
// ---------------------------------------------------------------------------

describe('XLSX invalid serial date error reporting', () => {
  test('reports error for out-of-range serial number', async () => {
    // Serial 200000 is > 100000 (the max guard), so it should be reported
    // as an error since it's clearly not a valid date.
    const filePath = createTempXLSX([
      ['이용일', '이용처', '이용금액'],
      [200000, '테스트', 10000],
    ]);
    try {
      const result = await parseXLSX(filePath);
      expect(result.transactions).toHaveLength(1);
      // Should have an error about the date
      expect(result.errors.some((e) => e.message.includes('날짜'))).toBe(true);
    } finally {
      cleanup(filePath);
    }
  });

  test('reports error for unparseable date string', async () => {
    const filePath = createTempXLSX([
      ['이용일', '이용처', '이용금액'],
      ['날짜아님', '테스트', 10000],
    ]);
    try {
      const result = await parseXLSX(filePath);
      expect(result.transactions).toHaveLength(1);
      expect(result.errors.some((e) => e.message.includes('날짜'))).toBe(true);
    } finally {
      cleanup(filePath);
    }
  });

  test('no error for valid serial dates', async () => {
    // 45323 = 2024-02-01
    const filePath = createTempXLSX([
      ['이용일', '이용처', '이용금액'],
      [45323, '테스트', 10000],
    ]);
    try {
      const result = await parseXLSX(filePath);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]?.date).toBe('2024-02-01');
      expect(result.errors).toHaveLength(0);
    } finally {
      cleanup(filePath);
    }
  });

  test('parses string amounts with Won sign (₩)', async () => {
    const filePath = createTempXLSX([
      ['이용일', '이용처', '이용금액'],
      ['2026-02-01', '스타벅스', '₩6,000'],
      ['2026-02-02', '이마트', '₩120,000'],
    ]);
    try {
      const result = await parseXLSX(filePath);
      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0]?.amount).toBe(6000);
      expect(result.transactions[1]?.amount).toBe(120000);
    } finally {
      cleanup(filePath);
    }
  });

  test('parses string amounts with fullwidth Won sign (￦)', async () => {
    const filePath = createTempXLSX([
      ['이용일', '이용처', '이용금액'],
      ['2026-02-01', '스타벅스', '￦6,000'],
    ]);
    try {
      const result = await parseXLSX(filePath);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]?.amount).toBe(6000);
    } finally {
      cleanup(filePath);
    }
  });

  test('forward-fills date in merged cells', async () => {
    const filePath = createTempXLSX([
      ['이용일', '이용처', '이용금액', '할부'],
      ['2026-02-01', '스타벅스', 6000, 0],
      ['', '맥도날드', 8900, 0],
      ['', '이마트', 45000, 3],
    ]);
    try {
      const result = await parseXLSX(filePath);
      expect(result.transactions).toHaveLength(3);
      expect(result.transactions[0]?.date).toBe('2026-02-01');
      expect(result.transactions[1]?.date).toBe('2026-02-01');
      expect(result.transactions[2]?.date).toBe('2026-02-01');
    } finally {
      cleanup(filePath);
    }
  });

  test('forward-fills merchant in merged cells', async () => {
    const filePath = createTempXLSX([
      ['이용일', '이용처', '이용금액', '할부'],
      ['2026-02-01', '스타벅스', 6000, 0],
      ['2026-02-01', '', 3000, 3],
    ]);
    try {
      const result = await parseXLSX(filePath);
      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0]?.merchant).toBe('스타벅스');
      expect(result.transactions[1]?.merchant).toBe('스타벅스');
    } finally {
      cleanup(filePath);
    }
  });

  test('returns graceful error for corrupted XLSX bytes (F4)', async () => {
    // Write garbage bytes that look like XLSX (PK magic) but aren't valid
    mkdirSync(FIXTURE_DIR, { recursive: true });
    const filePath = join(FIXTURE_DIR, `corrupt-${++fileCounter}.xlsx`);
    // PK magic bytes followed by garbage
    writeFileSync(filePath, Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]));
    try {
      const result = await parseXLSX(filePath);
      expect(result.transactions).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]?.message).toContain('XLSX 파일을 읽을 수 없습니다');
    } finally {
      cleanup(filePath);
    }
  });

  test('uses shared findColumn for column matching (F6)', async () => {
    // Test that column matching uses the shared ColumnMatcher which handles
    // parenthetical suffixes and whitespace normalization
    const filePath = createTempXLSX([
      ['이용일', '이용처', '이용금액(원)', '할부'],
      ['2026-02-01', '스타벅스', 6000, 0],
      ['2026-02-02', '이마트', 45000, 0],
    ]);
    try {
      const result = await parseXLSX(filePath);
      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0]?.amount).toBe(6000);
      expect(result.transactions[1]?.amount).toBe(45000);
    } finally {
      cleanup(filePath);
    }
  });

  test('handles Date objects in cells (C10-02)', async () => {
    const filePath = createTempXLSX([
      ['거래일시', '가맹점명', '이용금액'],
      [new Date(2026, 1, 1), '스타벅스', 6000],
      [new Date(2026, 1, 2), '이마트', 45000],
    ]);
    try {
      const result = await parseXLSX(filePath);
      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0]?.date).toBe('2026-02-01');
      expect(result.transactions[1]?.date).toBe('2026-02-02');
    } finally {
      cleanup(filePath);
    }
  });

  test('forward-fills installments in merged cells (C10-03)', async () => {
    // Simulates a Korean bank XLSX where installment value is only in the
    // first row of a merged group, with subsequent rows having empty cells.
    const filePath = createTempXLSX([
      ['거래일시', '가맹점명', '이용금액', '할부개월', '업종'],
      ['2026-02-01', '이마트', 30000, 3, '마트'],
      ['', '', 10000, '', ''],
      ['', '', 10000, '', ''],
      ['2026-02-05', '스타벅스', 6000, 0, '카페'],
    ]);
    try {
      const result = await parseXLSX(filePath);
      // All 3 rows of the merged group should be parsed
      expect(result.transactions).toHaveLength(4);
      // First row has explicit installments
      expect(result.transactions[0]?.installments).toBe(3);
      // Second and third rows inherit installments from forward-fill
      expect(result.transactions[1]?.installments).toBe(3);
      expect(result.transactions[2]?.installments).toBe(3);
      // Fourth row has no installments (0 parsed as undefined)
      expect(result.transactions[3]?.installments).toBeUndefined();
    } finally {
      cleanup(filePath);
    }
  });

  test('forward-fills merchant name in merged cells (C10-03b)', async () => {
    const filePath = createTempXLSX([
      ['거래일시', '가맹점명', '이용금액', '할부개월'],
      ['2026-02-01', '이마트', 30000, 3],
      ['', '', 10000, ''],
      ['2026-02-05', '스타벅스', 6000, 0],
    ]);
    try {
      const result = await parseXLSX(filePath);
      expect(result.transactions).toHaveLength(3);
      expect(result.transactions[0]?.merchant).toBe('이마트');
      expect(result.transactions[1]?.merchant).toBe('이마트');
      expect(result.transactions[2]?.merchant).toBe('스타벅스');
    } finally {
      cleanup(filePath);
    }
  });

  test('forward-fills memo in merged cells (C15-01)', async () => {
    const filePath = createTempXLSX([
      ['거래일시', '가맹점명', '이용금액', '비고'],
      ['2026-02-01', '이마트', 30000, '온라인결제'],
      ['', '', 10000, ''],
      ['', '', 5000, ''],
      ['2026-02-05', '스타벅스', 6000, '오프라인'],
    ]);
    try {
      const result = await parseXLSX(filePath);
      expect(result.transactions).toHaveLength(4);
      // First row has explicit memo
      expect(result.transactions[0]?.memo).toBe('온라인결제');
      // Second and third rows inherit memo via forward-fill
      expect(result.transactions[1]?.memo).toBe('온라인결제');
      expect(result.transactions[2]?.memo).toBe('온라인결제');
      // Fourth row has its own memo
      expect(result.transactions[3]?.memo).toBe('오프라인');
    } finally {
      cleanup(filePath);
    }
  });

  // ---------------------------------------------------------------------------
  // Formula error cells — C11-04
  // ---------------------------------------------------------------------------

  test('handles formula error cells gracefully (C11-04)', async () => {
    // Create an XLSX with a string that looks like a formula error (#REF!, etc.)
    // SheetJS with raw:true returns error strings as-is for string-type cells.
    const filePath = createTempXLSX([
      ['거래일시', '가맹점명', '이용금액'],
      ['2026-02-01', '스타벅스', '#REF!'],
      ['2026-02-02', '이마트', 45000],
    ]);
    try {
      const result = await parseXLSX(filePath);
      // The #REF! cell should be unparseable → error reported, row skipped
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      expect(result.errors.some((e) => e.message.includes('금액'))).toBe(true);
      // Valid row should still parse
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]?.amount).toBe(45000);
    } finally {
      cleanup(filePath);
    }
  });

  test('handles string formula results with decimal amounts (C11-04)', async () => {
    // Some formula cells render as strings like "6500.50" — should round
    const filePath = createTempXLSX([
      ['거래일시', '가맹점명', '이용금액'],
      ['2026-02-01', '스타벅스', '6500.50'],
      ['2026-02-02', '이마트', '45000.3'],
    ]);
    try {
      const result = await parseXLSX(filePath);
      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0]?.amount).toBe(6501); // rounded
      expect(result.transactions[1]?.amount).toBe(45000); // rounded
    } finally {
      cleanup(filePath);
    }
  });

  test('handles negative numeric amounts (refunds) (C11-04)', async () => {
    const filePath = createTempXLSX([
      ['거래일시', '가맹점명', '이용금액'],
      ['2026-02-01', '환불', -5000],
      ['2026-02-02', '이마트', 45000],
    ]);
    try {
      const result = await parseXLSX(filePath);
      // Negative amounts should be filtered out (amount <= 0)
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]?.amount).toBe(45000);
    } finally {
      cleanup(filePath);
    }
  });

  test('handles Excel formula error cells gracefully (C14-01)', async () => {
    // When raw: true is used, formula errors are returned as strings like "#VALUE!"
    // This test verifies that such cells produce specific "셀 수식 오류" error
    // messages rather than generic "날짜를 해석할 수 없습니다" errors.
    const filePath = createTempXLSX([
      ['거래일시', '가맹점명', '이용금액'],
      ['#VALUE!', '스타벅스', 6000],
      ['2026-02-02', '이마트', '#REF!'],
      ['2026-02-03', '마트', 45000],
    ]);
    try {
      const result = await parseXLSX(filePath);
      // Row 1: #VALUE! date (error) + valid amount => parsed with invalid date + error
      // Row 2: valid date + #REF! amount => skipped (amount is null)
      // Row 3: fully valid => parsed
      expect(result.transactions.length).toBeGreaterThanOrEqual(1);
      // The last transaction should be fully valid
      const lastTx = result.transactions.find((t) => t.date === '2026-02-03');
      expect(lastTx).toBeDefined();
      expect(lastTx?.amount).toBe(45000);
      // Should have specific formula error messages (not generic date parse errors)
      const formulaErrors = result.errors.filter((e) => e.message.includes('셀 수식 오류'));
      expect(formulaErrors.length).toBeGreaterThanOrEqual(1);
      expect(formulaErrors.some((e) => e.message.includes('#VALUE!'))).toBe(true);
    } finally {
      cleanup(filePath);
    }
  });

  test('handles multiple Excel error types in date cells (C14-01)', async () => {
    const errorTypes = ['#REF!', '#DIV/0!', '#N/A', '#NAME?', '#NULL!', '#NUM!'];
    for (const errorStr of errorTypes) {
      const filePath = createTempXLSX([
        ['거래일시', '가맹점명', '이용금액'],
        ['2026-02-01', '테스트', 10000],
        [errorStr, '에러 테스트', 5000],
      ]);
      try {
        const result = await parseXLSX(filePath);
        // First row is valid, second row has formula error in date
        expect(result.transactions.length).toBeGreaterThanOrEqual(1);
        expect(result.transactions[0]?.date).toBe('2026-02-01');
        const formulaError = result.errors.find((e) => e.message.includes('셀 수식 오류'));
        expect(formulaError).toBeDefined();
        expect(formulaError?.message).toContain(errorStr);
      } finally {
        cleanup(filePath);
      }
    }
  });

  test('reports formula error for amount column (C14-01)', async () => {
    // Formula errors in the amount column produce null from parseAmount,
    // which triggers a "금액을 해석할 수 없습니다" error (not the formula-specific
    // error, since parseAmount doesn't have Excel error detection).
    const filePath = createTempXLSX([
      ['거래일시', '가맹점명', '이용금액'],
      ['2026-02-01', '스타벅스', '#VALUE!'],
      ['2026-02-02', '이마트', 45000],
    ]);
    try {
      const result = await parseXLSX(filePath);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]?.amount).toBe(45000);
      // Amount error is reported as generic parse error
      expect(result.errors.some((e) => e.message.includes('금액을 해석할 수 없습니다'))).toBe(true);
    } finally {
      cleanup(filePath);
    }
  });
});

// ---------------------------------------------------------------------------
// Spaced summary row skip (C16-03)
// ---------------------------------------------------------------------------

describe('XLSX spaced summary row skip', () => {
  test('skips "총 합계" row with spaces (C16-03)', async () => {
    const filePath = createTempXLSX([
      ['거래일시', '가맹점명', '이용금액'],
      ['2026-02-01', '스타벅스', 6000],
      ['총 합계', '', 6000],
    ]);
    try {
      const result = await parseXLSX(filePath);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]?.merchant).toBe('스타벅스');
    } finally {
      cleanup(filePath);
    }
  });

  test('skips "소 계" row with space (C16-03)', async () => {
    const filePath = createTempXLSX([
      ['거래일시', '가맹점명', '이용금액'],
      ['2026-02-01', '스타벅스', 6000],
      ['소 계', '', 3000],
      ['2026-02-02', '이마트', 45000],
    ]);
    try {
      const result = await parseXLSX(filePath);
      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0]?.merchant).toBe('스타벅스');
      expect(result.transactions[1]?.merchant).toBe('이마트');
    } finally {
      cleanup(filePath);
    }
  });

  test('skips "합 계" row with space (C16-03)', async () => {
    const filePath = createTempXLSX([
      ['거래일시', '가맹점명', '이용금액'],
      ['2026-02-01', '스타벅스', 6000],
      ['합 계', '', 6000],
    ]);
    try {
      const result = await parseXLSX(filePath);
      expect(result.transactions).toHaveLength(1);
    } finally {
      cleanup(filePath);
    }
  });
});