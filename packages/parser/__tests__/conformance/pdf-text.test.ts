import { describe, expect, test } from 'bun:test';

import {
  findLastPDFAmountToken,
  parseAmount,
  parsePDFText,
} from '../../src/browser.js';

describe('shared PDF text kernel', () => {
  test.each([
    ['50,000원', 50000],
    ['(50,000)', -50000],
    ['마이너스50,000원', -50000],
    ['－50,000원', -50000],
    ['50,000-', -50000],
  ])('preserves %s as a complete signed token', (raw, expected) => {
    const match = findLastPDFAmountToken(`2024-01-15 가맹점 ${raw}`);
    expect(match?.token).toBe(raw);
    expect(parseAmount(match?.token)).toBe(expected);
  });

  test('positive spending excludes every refund notation', () => {
    const parsed = parsePDFText([
      '2024-01-15  승인  50,000원',
      '2024-01-16  환불1  (50,000)',
      '2024-01-17  환불2  마이너스50,000원',
      '2024-01-18  환불3  －50,000원',
      '2024-01-19  환불4  50,000-',
    ].join('\n'));

    expect(parsed.transactions).toHaveLength(1);
    expect(parsed.transactions[0]?.amount).toBe(50000);
  });
});
