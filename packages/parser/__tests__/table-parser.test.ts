import { describe, test, expect } from 'bun:test';
import { parseTable, filterTransactionRows } from '../src/pdf/table-parser.js';

describe('parseTable', () => {
  test('returns empty array for empty input', () => {
    expect(parseTable('')).toEqual([]);
  });

  test('returns empty array for text with no table structure', () => {
    expect(parseTable('Just some random text\nwithout any dates or amounts')).toEqual([]);
  });

  test('detects table lines with dates and amounts', () => {
    const text = [
      '카드 이용내역',
      '2024-01-15 스타벅스 강남점    6,500원',
      '2024-01-16 이마트 서초점     45,000원',
      '2024-01-17 GS25 편의점       3,200원',
    ].join('\n');
    const rows = parseTable(text);
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });

  test('parses Korean full date format in table', () => {
    const text = [
      '2024년 1월 15일 스타벅스    6,500원',
      '2024년 1월 16일 이마트     45,000원',
    ].join('\n');
    const rows = parseTable(text);
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  test('falls back to whitespace splitting when no date/amount patterns found', () => {
    // Use text without digits to avoid triggering the amount pattern
    const text = 'Alpha  Beta  Gamma\nDelta  Epsilon  Zeta';
    const rows = parseTable(text);
    expect(rows.length).toBe(2);
    expect(rows[0]).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  test('handles single-column lines', () => {
    const text = 'Just text\nMore text';
    const rows = parseTable(text);
    // Single-column lines should not be included (cells.length > 1 check)
    expect(rows.length).toBe(0);
  });

  test('does not stop at single blank line within table', () => {
    const text = [
      '2024-01-15 스타벅스    6,500원',
      '',
      '2024-01-16 이마트     45,000원',
      '2024-01-17 GS25       3,200원',
    ].join('\n');
    const rows = parseTable(text);
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });

  test('handles multiple date lines with column boundaries', () => {
    const text = [
      '날짜        가맹점          금액',
      '2024-01-15  스타벅스 강남    6,500원',
      '2024-01-16  이마트 서초     45,000원',
    ].join('\n');
    const rows = parseTable(text);
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });
});

describe('filterTransactionRows', () => {
  test('returns empty for empty input', () => {
    expect(filterTransactionRows([])).toEqual([]);
  });

  test('filters rows that have both date and amount', () => {
    const rows = [
      ['2024-01-15', '스타벅스', '6,500원'],
      ['header', 'name', 'value'],
      ['2024-01-16', '이마트', '45,000원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(2);
  });

  test('excludes rows without date', () => {
    const rows = [
      ['스타벅스', '6,500원'],
      ['2024-01-16', '이마트', '45,000원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(1);
  });

  test('handles Korean full date format', () => {
    const rows = [
      ['2024년 1월 15일', '스타벅스', '6,500원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(1);
  });

  test('handles amount without 원 suffix', () => {
    const rows = [
      ['2024-01-15', '스타벅스', '6500'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(1);
  });
});
