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
});