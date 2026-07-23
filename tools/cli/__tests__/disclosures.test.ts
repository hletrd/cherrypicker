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
    unassignedSpending: 0,
    unassignedTransactionCount: 0,
    effectiveRate: 0,
    savingsVsSingleCard: 0,
    bestSingleCard: null,
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

  test('discloses an exact previous statement month', () => {
    expect(
      buildOptimizationDisclosures(result(), {
        kind: 'statement-month',
        month: '2026-01',
      }),
    ).toEqual([
      expect.stringContaining('2026-01 명세서'),
    ]);
  });

  test('summarizes unsupported reward assumptions with bounded detail', () => {
    const issues = Array.from({ length: 5 }, (_, index) => ({
      cardId: `card-${index}`,
      transactionId: `tx-${index}`,
      ruleId: `rule-${index}`,
      category: 'transportation',
      reason: 'missing_fuel_volume',
      detail: '리터 정보 없음',
    }));
    const messages = buildOptimizationDisclosures(result(issues), 0);

    expect(messages).toContainEqual(expect.stringContaining('5건'));
    expect(messages).toContainEqual(expect.stringContaining('card-0/rule-0'));
    expect(messages).toContainEqual(expect.stringContaining('그 외 2건'));
  });

  test('prints every disclosure through the injected warning sink', () => {
    const messages: string[] = [];
    printOptimizationDisclosures(result(), undefined, (message) => {
      messages.push(message);
    });
    expect(messages).toEqual([expect.stringContaining('전월실적 기준')]);
  });

  test('removes terminal controls from every optimization disclosure field', () => {
    const control =
      '\u001b]8;;https://example.invalid\u0007LINK\u001b]8;;\u0007' +
      '\u001b]52;c;Y2xpcGJvYXJk\u0007' +
      '\u001b[31mCOLOR\u001b[0m\r\n\u009b31m\u202e';
    const messages = buildOptimizationDisclosures(
      result([
        {
          cardId: control,
          transactionId: 'tx',
          ruleId: control,
          category: 'shopping',
          reason: control,
          detail: control,
        },
      ]),
      {
        kind: 'statement-month',
        month: control as `${number}-${string}`,
      },
    );
    const output = messages.join('\n');

    expect(output).not.toContain('https://example.invalid');
    expect(output).not.toContain('Y2xpcGJvYXJk');
    expect(output).not.toMatch(/[\u001b\r\u009b\u202e]/);
    expect(output).toContain('LINK');
    expect(output).toContain('COLOR');
  });
});
