import { describe, expect, test } from 'bun:test';

import { parseGenericCSV } from '../src/csv/generic.js';
import { parseJSON } from '../src/json/index.js';
import { parseDateCell } from '../src/shared/date-cell.js';
import { parsePDFText } from '../src/shared/pdf-text.js';

const damagedDate = '2024-01-15oops';
const validDatetime = '2024-01-15T10:30:00';

describe('shared date grammar consumer conformance', () => {
  test('JSON rejects an arbitrary date suffix with a diagnostic', () => {
    const parsed = parseJSON(JSON.stringify([
      { date: damagedDate, merchant: '스타벅스', amount: 5_500 },
    ]));

    expect(parsed.transactions).toHaveLength(0);
    expect(parsed.errors.some(({ message }) => message.includes(damagedDate))).toBe(true);
  });

  test('generic CSV rejects an arbitrary date suffix with a diagnostic', () => {
    const parsed = parseGenericCSV([
      '거래일시,가맹점명,이용금액',
      `${damagedDate},스타벅스,5500`,
    ].join('\n'), null);

    expect(parsed.transactions).toHaveLength(0);
    expect(parsed.errors.some(({ message }) => message.includes(damagedDate))).toBe(true);
  });

  test('XLSX date-cell coercion rejects an arbitrary date suffix', () => {
    expect(parseDateCell(damagedDate)).toEqual({
      value: damagedDate,
      error: `날짜를 해석할 수 없습니다: ${damagedDate}`,
    });
  });

  test('PDF-adjacent text cannot turn a damaged date token into a transaction', () => {
    const parsed = parsePDFText([
      '거래일  가맹점명  이용금액',
      `${damagedDate}  스타벅스  5,500원`,
    ].join('\n'));

    expect(parsed.transactions).toHaveLength(0);
    expect(parsed.errors.some(({ message }) => message.includes(damagedDate))).toBe(true);
  });

  test('explicit datetimes remain conformant across JSON, CSV, and date cells', () => {
    const json = parseJSON(JSON.stringify([
      { date: validDatetime, merchant: '스타벅스', amount: 5_500 },
    ]));
    const csv = parseGenericCSV([
      '거래일시,가맹점명,이용금액',
      `${validDatetime},스타벅스,5500`,
    ].join('\n'), null);

    expect(json.transactions[0]?.date).toBe('2024-01-15');
    expect(csv.transactions[0]?.date).toBe('2024-01-15');
    expect(parseDateCell(validDatetime)).toEqual({ value: '2024-01-15' });
  });
});
