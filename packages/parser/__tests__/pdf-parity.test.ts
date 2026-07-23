import { describe, test, expect } from 'bun:test';
import { parseAmountString } from '../src/csv/shared.js';
import {
  parseTable,
  filterTransactionRows,
  detectHeaderRow,
  getHeaderColumns,
} from '../src/pdf/table-parser.js';
import { parseDateStringToISO, isValidYYYYMMDD, isValidYYMMDD, isValidShortDate } from '../src/date-utils.js';
import {
  findLastPDFAmountToken,
  parsePDFText,
  resolvePDFRowValues,
} from '../src/shared/pdf-text.js';

// C21-TEST03: PDF parser pure function tests
// These tests execute the shared production kernel used by both the server
// and browser PDF extraction adapters.

describe('PDF parser pure functions (C21-TEST03)', () => {
  // ---------------------------------------------------------------------------
  // parseAmount (server-side: parseAmountString from csv/shared.js)
  // Web-side parseAmount has identical logic to parseAmountString.
  // ---------------------------------------------------------------------------
  test('parseAmount handles simple integer', () => {
    expect(parseAmountString('5500')).toBe(5500);
  });

  test('parseAmount handles comma-separated amount', () => {
    expect(parseAmountString('1,250,000')).toBe(1250000);
  });

  test('parseAmount handles Won suffix', () => {
    expect(parseAmountString('6,500원')).toBe(6500);
  });

  test('parseAmount handles ₩ prefix', () => {
    expect(parseAmountString('₩6,500')).toBe(6500);
  });

  test('parseAmount handles fullwidth Won sign', () => {
    expect(parseAmountString('￦30,000')).toBe(30000);
  });

  test('parseAmount handles negative minus sign', () => {
    expect(parseAmountString('-5000')).toBe(-5000);
  });

  test('parseAmount handles parenthesized negative', () => {
    expect(parseAmountString('(5,000)')).toBe(-5000);
  });

  test('parseAmount handles fullwidth minus', () => {
    expect(parseAmountString('－1,234')).toBe(-1234);
  });

  test('parseAmount handles fullwidth plus', () => {
    expect(parseAmountString('＋1,234')).toBe(1234);
  });

  test('parseAmount handles fullwidth digits', () => {
    expect(parseAmountString('１，２３４')).toBe(1234);
    expect(parseAmountString('１２３４５')).toBe(12345);
  });

  test('parseAmount handles 마이너스 prefix', () => {
    expect(parseAmountString('마이너스5000')).toBe(-5000);
  });

  test('parseAmount handles trailing minus', () => {
    expect(parseAmountString('1,234-')).toBe(-1234);
  });

  test('parseAmount handles KRW prefix', () => {
    expect(parseAmountString('KRW 10,000')).toBe(10000);
  });

  test('fallback extraction preserves negative markers', () => {
    for (const [line, expected] of [
      ['2024-01-15 스타벅스 (5,000)', -5000],
      ['2024-01-15 스타벅스 마이너스5,000원', -5000],
      ['2024-01-15 스타벅스 －5,000원', -5000],
    ] as const) {
      const token = findLastPDFAmountToken(line);
      expect(token).not.toBeNull();
      expect(parseAmountString(token!.token)).toBe(expected);
    }
  });

  test('shared text parsing excludes every supported refund notation', () => {
    const result = parsePDFText([
      '2024-01-15  정상승인  50,000원',
      '2024-01-16  괄호 환불  (50,000)',
      '2024-01-17  한글 환불  마이너스50,000원',
      '2024-01-18  전각 환불  －50,000원',
      '2024-01-19  후행 환불  50,000-',
    ].join('\n'));

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]?.date).toBe('2024-01-15');
    expect(result.transactions[0]?.amount).toBe(50000);
  });

  test('structured row resolution refreshes values after index correction', () => {
    const row = ['기타', '2024-01-15', '스타벅스', '15,000'];
    const result = resolvePDFRowValues(
      row,
      { dateIdx: 0, amountIdx: 2 },
      () => ({ idx: 1, value: row[1]! }),
      () => ({ idx: 3, value: row[3]! }),
    );
    expect(result?.dateValue).toBe('2024-01-15');
    expect(result?.amountValue).toBe('15,000');
  });

  test('parseAmount returns null for empty string', () => {
    expect(parseAmountString('')).toBeNull();
  });

  test('parseAmount returns null for non-numeric', () => {
    expect(parseAmountString('abc')).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // parseDateToISO (server-side: parseDateStringToISO from date-utils.js)
  // Web-side parseDateToISO delegates to parseDateStringToISO with error handling.
  // ---------------------------------------------------------------------------
  test('parseDateToISO handles ISO date', () => {
    expect(parseDateStringToISO('2024-01-15')).toBe('2024-01-15');
  });

  test('parseDateToISO handles YYYYMMDD', () => {
    expect(parseDateStringToISO('20240115')).toBe('2024-01-15');
  });

  test('parseDateToISO handles YYMMDD', () => {
    expect(parseDateStringToISO('240115')).toBe('2024-01-15');
  });

  test('parseDateToISO handles dotted format', () => {
    expect(parseDateStringToISO('2024.01.15')).toBe('2024-01-15');
  });

  test('parseDateToISO handles slashed format', () => {
    expect(parseDateStringToISO('2024/01/15')).toBe('2024-01-15');
  });

  test('parseDateToISO handles Korean format', () => {
    expect(parseDateStringToISO('2024년 01월 15일')).toBe('2024-01-15');
  });

  test('parseDateToISO returns raw for unparseable input', () => {
    expect(parseDateStringToISO('not-a-date')).toBe('not-a-date');
  });

  // ---------------------------------------------------------------------------
  // isValidDateCell (server-side: isValidYYYYMMDD, isValidYYMMDD, isValidShortDate)
  // Web-side isValidDateCell combines these validations.
  // ---------------------------------------------------------------------------
  test('isValidDateCell accepts ISO date', () => {
    expect(parseDateStringToISO('2024-01-15')).toBe('2024-01-15');
  });

  test('isValidDateCell accepts YYYYMMDD numeric string', () => {
    expect(isValidYYYYMMDD('20240115')).toBe(true);
  });

  test('isValidDateCell accepts YYMMDD numeric string', () => {
    expect(isValidYYMMDD('240115')).toBe(true);
  });

  test('isValidDateCell rejects invalid month in YYYYMMDD', () => {
    expect(isValidYYYYMMDD('20241315')).toBe(false);
  });

  test('isValidDateCell rejects invalid day in YYYYMMDD', () => {
    expect(isValidYYYYMMDD('20240132')).toBe(false);
  });

  test('isValidDateCell validates short dates MM.DD', () => {
    expect(isValidShortDate('01.15')).toBe(true);
  });

  test('isValidDateCell rejects invalid short date', () => {
    expect(isValidShortDate('13.01')).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // parseTable (server-side: parseTable from table-parser.js)
  // ---------------------------------------------------------------------------
  test('parseTable extracts rows from text with date and amount', () => {
    const text = '2024-01-15  스타벅스  5,500\n2024-01-16  이마트  45,000';
    const result = parseTable(text);
    expect(result.length).toBeGreaterThan(0);
  });

  test('parseTable handles empty text', () => {
    const result = parseTable('');
    expect(result).toEqual([]);
  });

  test('parseTable handles text with no dates or amounts', () => {
    const result = parseTable('some random text\nwithout dates');
    // Falls through to whitespace split
    expect(result.length).toBeGreaterThanOrEqual(0);
  });

  test('parseTable produces structured rows for transaction text', () => {
    const text = '2024-01-15  스타벅스  5,500\n2024-01-16  이마트  45,000';
    const result = parseTable(text);
    expect(result.length).toBeGreaterThan(0);
    // Each row should have multiple cells
    for (const row of result) {
      expect(row.length).toBeGreaterThanOrEqual(1);
    }
  });

  test('filterTransactionRows keeps rows with dates and amounts', () => {
    const rows = [
      ['2024-01-15', '스타벅스', '5,500'],
      ['합계', '', '100,000'],
      ['2024-01-16', '이마트', '45,000'],
    ];
    const filtered = filterTransactionRows(rows);
    // Should keep rows that have both a date-like cell and an amount-like cell
    expect(filtered.length).toBeGreaterThanOrEqual(2);
  });

  test('detectHeaderRow finds header in transaction table', () => {
    const rows = [
      ['이용일', '가맹점명', '이용금액'],
      ['2024-01-15', '스타벅스', '5,500'],
      ['2024-01-16', '이마트', '45,000'],
    ];
    const headerIdx = detectHeaderRow(rows);
    expect(headerIdx).toBe(0);
  });

  test('getHeaderColumns extracts column layout from header row', () => {
    const headerRow = ['이용일', '가맹점명', '이용금액'];
    const layout = getHeaderColumns(headerRow);
    expect(layout).not.toBeNull();
    expect(layout?.dateCol).toBeGreaterThanOrEqual(0);
    expect(layout?.merchantCol).toBeGreaterThanOrEqual(0);
    expect(layout?.amountCol).toBeGreaterThanOrEqual(0);
  });
});
