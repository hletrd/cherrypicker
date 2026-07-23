import { describe, expect, test } from 'bun:test';
import type { OptimizationResult } from '@cherrypicker/core';
import {
  buildOptimizationDisclosures,
  printOptimizationDisclosures,
} from '../src/disclosures.js';

function result(
  unsupportedRules: OptimizationResult['unsupportedRules'] = [],
): OptimizationResult {
  return {
    assignments: [],
    totalReward: 0,
    totalSpending: 0,
    effectiveRate: 0,
    savingsVsSingleCard: 0,
    bestSingleCard: { cardId: '', cardName: '', totalReward: 0 },
    cardResults: [],
    unsupportedRules,
  };
}

describe('optimization disclosures', () => {
  test('discloses the assumed-zero previous-spending basis', () => {
    expect(buildOptimizationDisclosures(result(), undefined)).toEqual([
      expect.stringContaining('0원을 가정'),
    ]);
  });

  test('discloses the user-provided previous-spending basis', () => {
    expect(buildOptimizationDisclosures(result(), 300_000)).toEqual([
      expect.stringContaining('사용자 입력 300000원'),
    ]);
  });

  test('summarizes unsupported reward assumptions with bounded detail', () => {
    const issues = Array.from({ length: 5 }, (_, index) => ({
      transactionId: `tx-${index}`,
      ruleId: `rule-${index}`,
      category: 'transportation',
      reason: 'missing_fuel_volume',
      detail: '리터 정보 없음',
    }));
    const messages = buildOptimizationDisclosures(result(issues), 0);

    expect(messages).toContainEqual(expect.stringContaining('5건'));
    expect(messages).toContainEqual(expect.stringContaining('rule-0'));
    expect(messages).toContainEqual(expect.stringContaining('그 외 2건'));
  });

  test('prints every disclosure through the injected warning sink', () => {
    const messages: string[] = [];
    printOptimizationDisclosures(result(), undefined, (message) => {
      messages.push(message);
    });
    expect(messages).toEqual([expect.stringContaining('전월실적 기준')]);
  });
});
