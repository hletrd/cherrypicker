import { expect, test } from 'bun:test';
import { calculateRewards } from '../../../packages/core/src/index.js';
import { validateExtractedRules } from '../src/validators.js';
import { makeCardRule } from './fixtures.js';

test('a scraper-authored 5% rule calculates 500 won on 10,000 won', () => {
  const validation = validateExtractedRules(makeCardRule(), 'shinhan');
  if (!validation.valid || !validation.result) {
    throw new Error(validation.errors.join('\n'));
  }

  const output = calculateRewards({
    cardRule: validation.result,
    previousMonthSpending: 0,
    transactions: [
      {
        id: 'tx-1',
        date: '2026-07-23',
        merchant: '테스트 가맹점',
        amount: 10_000,
        currency: 'KRW',
        category: 'dining',
        confidence: 1,
      },
    ],
  });

  expect(output.totalReward).toBe(500);
  expect(output.unsupportedRules).toEqual([]);
});
