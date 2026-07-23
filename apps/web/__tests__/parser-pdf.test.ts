import { describe, expect, it } from 'bun:test';
import {
  findLastPDFAmountToken,
  parseAmount,
  parsePDFText,
  resolvePDFRowValues,
} from '@cherrypicker/parser/browser';

describe('browser-safe PDF text helpers', () => {
  it.each([
    ['2024-01-15 스타벅스 (1,234)', '(1,234)', -1234],
    ['2024-01-15 스타벅스 마이너스1,234원', '마이너스1,234원', -1234],
    ['2024-01-15 스타벅스 －1,234원', '－1,234원', -1234],
    ['2024-01-15 스타벅스 1,234-', '1,234-', -1234],
    ['2024-01-15 스타벅스 ₩1,234원', '₩1,234원', 1234],
  ])('preserves the complete last amount token in %s', (line, token, amount) => {
    const match = findLastPDFAmountToken(line);
    expect(match?.token).toBe(token);
    expect(parseAmount(match?.token)).toBe(amount);
  });

  it('reads values again after correcting stale header indices', () => {
    const row = ['기타', '2024-01-15', '스타벅스', '15,000'];
    const result = resolvePDFRowValues(
      row,
      { dateIdx: 0, amountIdx: 2 },
      () => ({ idx: 1, value: row[1]! }),
      () => ({ idx: 3, value: row[3]! }),
    );

    expect(result).toEqual({
      dateIdx: 1,
      amountIdx: 3,
      dateValue: '2024-01-15',
      amountValue: '15,000',
    });
  });

  it('exposes the complete shared PDF text parser through the browser entrypoint', () => {
    const result = parsePDFText([
      '2024-01-15  정상 승인  50,000원',
      '2024-01-16  취소  (50,000)',
    ].join('\n'));

    expect(result.transactions).toEqual([
      { date: '2024-01-15', merchant: '정상 승인', amount: 50000 },
    ]);
  });
});
