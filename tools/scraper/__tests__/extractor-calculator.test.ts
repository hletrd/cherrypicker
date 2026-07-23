import { expect, test } from 'bun:test';
import type Anthropic from '@anthropic-ai/sdk';
import { calculateRewards } from '../../../packages/core/src/index.js';
import {
  PENDING_SOURCE_REVIEW_REASON,
  parseCardExtractionResponse,
} from '../src/extractor.js';
import { validateExtractedRules } from '../src/validators.js';
import { makeCardRule } from './fixtures.js';

const transaction = {
  id: 'tx-1',
  date: '2026-07-23',
  merchant: '테스트 가맹점',
  amount: 10_000,
  currency: 'KRW',
  category: 'dining',
  confidence: 1,
} as const;

test('an explicitly promoted 5% authored rule calculates 500 won', () => {
  const validation = validateExtractedRules(makeCardRule(), 'shinhan');
  if (!validation.valid || !validation.result) {
    throw new Error(validation.errors.join('\n'));
  }

  const output = calculateRewards({
    cardRule: validation.result,
    previousMonthSpending: 0,
    transactions: [transaction],
  });

  expect(output.totalReward).toBe(500);
  expect(output.unsupportedRules).toEqual([]);
});

test('a model-authored supported reward remains non-executable until promotion', () => {
  const response = {
    content: [
      {
        type: 'tool_use',
        id: 'tool_test',
        name: 'extract_card_rules',
        input: makeCardRule(),
      },
    ],
    stop_reason: 'end_turn',
  } as Anthropic.Message;
  const quarantined = parseCardExtractionResponse(
    response,
    'shinhan',
    () => new Date('2026-07-23T12:00:00.000Z'),
  );
  const output = calculateRewards({
    cardRule: quarantined,
    previousMonthSpending: 0,
    transactions: [transaction],
  });

  expect(quarantined.rewards[0]?.support).toEqual({
    status: 'unsupported',
    reason: PENDING_SOURCE_REVIEW_REASON,
  });
  expect(output.totalReward).toBe(0);
  expect(output.unsupportedRules).toHaveLength(1);
});
