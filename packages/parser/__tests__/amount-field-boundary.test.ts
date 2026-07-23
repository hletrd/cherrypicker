import { describe, expect, test } from 'bun:test';
import {
  classifyAmountFieldName,
  compileAmountFieldPlan,
  resolveAmountField,
} from '../src/shared/amount-fields.js';

describe('amount-field direction boundaries', () => {
  test.each([
    '입출금액',
    '출입금액',
    '입/출금액',
    '출/입금액',
    '입금/출금액',
    '출금ㆍ입금액',
  ])('classifies compact Korean compound header %s as ambiguous', (header) => {
    expect(classifyAmountFieldName(header)).toBe('ambiguous');
  });

  test('allows equal normalized same-role values deterministically', () => {
    const plan = compileAmountFieldPlan(['출금액', '출금금액'], '출금금액');
    expect(resolveAmountField(plan, (index) => ['-1,000', '1,000원'][index]))
      .toMatchObject({
        kind: 'spending',
        index: 1,
        role: 'outgoing',
      });
  });

  test('rejects unequal same-role values even when one is configured', () => {
    const plan = compileAmountFieldPlan(['출금액', '출금금액'], '출금금액');
    expect(resolveAmountField(plan, (index) => ['1,000', '2,000'][index]))
      .toEqual({
        kind: 'ambiguous',
        indexes: [0, 1],
      });
  });

  test('rejects incomparable populated same-role values', () => {
    const plan = compileAmountFieldPlan(['금액', '이용금액'], '이용금액');
    expect(resolveAmountField(plan, (index) => ['1,000', 'not-an-amount'][index]))
      .toEqual({
        kind: 'ambiguous',
        indexes: [0, 1],
      });
  });
});
