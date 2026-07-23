import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import {
  describePreviousSpendingBasis,
  summarizeUnsupportedRules,
} from '../src/lib/analysis-disclosures.js';

describe('previous-spending provenance disclosure', () => {
  test('describes an explicit user total without inventing a statement month', () => {
    expect(
      describePreviousSpendingBasis({
        kind: 'user-total',
        amount: 300_000,
      }),
    ).toEqual({
      kind: 'user-total',
      tone: 'neutral',
      text: '직접 입력한 전월실적 300,000원을 기준으로 계산했어요.',
    });
  });

  test('describes the exact previous calendar statement month', () => {
    expect(
      describePreviousSpendingBasis({
        kind: 'statement-month',
        month: '2025-12',
      }),
    ).toEqual({
      kind: 'statement-month',
      tone: 'neutral',
      text: '2025년 12월 명세서에서 카드별 실적 제외 항목을 반영해 계산했어요.',
    });
  });

  test('exposes a January-plus-March gap as a missing-February zero assumption', () => {
    const disclosure = describePreviousSpendingBasis({
      kind: 'missing-calendar-month',
      month: '2026-02',
      assumedAmount: 0,
    });

    expect(disclosure?.tone).toBe('warning');
    expect(disclosure?.text).toContain('2026년 2월 명세서가 없어');
    expect(disclosure?.text).toContain('0원으로 가정');
    expect(disclosure?.text).not.toContain('1월');
  });
});

describe('unsupported optimizer disclosure', () => {
  test('deduplicates repeated artifacts and groups user-facing reasons', () => {
    const duplicate = {
      cardId: 'card-1',
      transactionId: 'tx-1',
      ruleId: 'fuel-rule',
      category: 'transportation',
      reason: 'missing_fuel_volume',
    };
    const summary = summarizeUnsupportedRules([
      duplicate,
      duplicate,
      {
        cardId: 'card-2',
        transactionId: 'tx-2',
        ruleId: 'overseas-rule',
        category: 'travel',
        reason: 'missing_payment_type',
      },
    ]);

    expect(summary).toEqual({
      issueCount: 2,
      transactionCount: 2,
      ruleCount: 2,
      reasons: [
        {
          reason: 'missing_fuel_volume',
          label: '주유량 정보 부족',
          count: 1,
        },
        {
          reason: 'missing_payment_type',
          label: '국내·해외 결제 정보 부족',
          count: 1,
        },
      ],
    });
  });

  test('filters malformed restored entries and safely labels unknown reasons', () => {
    const summary = summarizeUnsupportedRules([
      null,
      { reason: 'missing_channel' },
      {
        cardId: 'card-3',
        transactionId: 'tx-3',
        ruleId: 'future-rule',
        category: 'other',
        reason: 'future_reason',
      },
    ]);

    expect(summary?.issueCount).toBe(1);
    expect(summary?.reasons[0]?.label).toBe(
      '계산에 필요한 거래 정보 또는 혜택 조건 부족',
    );
    expect(summarizeUnsupportedRules([])).toBeNull();
  });

  test('labels missing performance-exclusion facts specifically', () => {
    const summary = summarizeUnsupportedRules([
      {
        cardId: 'card-1',
        transactionId: 'performance-basis',
        ruleId: 'card-1:performance-exclusions',
        category: 'performance',
        reason: 'missing_performance_exclusion_fact',
      },
    ]);

    expect(summary?.reasons).toEqual([
      {
        reason: 'missing_performance_exclusion_fact',
        label: '전월실적 제외 여부를 확인할 거래 정보 부족',
        count: 1,
      },
    ]);
  });

  test('keeps the same rule ID from different cards as distinct issues', () => {
    const summary = summarizeUnsupportedRules([
      {
        cardId: 'card-a',
        transactionId: 'tx-1',
        ruleId: 'reward-001',
        category: 'dining',
        reason: 'rule_marked_unsupported',
      },
      {
        cardId: 'card-b',
        transactionId: 'tx-1',
        ruleId: 'reward-001',
        category: 'dining',
        reason: 'rule_marked_unsupported',
      },
    ]);

    expect(summary).toEqual(
      expect.objectContaining({
        issueCount: 2,
        transactionCount: 1,
        ruleCount: 2,
      }),
    );
  });
});

describe('analysis disclosure production wiring', () => {
  test('uses provenance and unsupported-rule helpers in dashboard and report', async () => {
    const [summarySource, reportSource] = await Promise.all([
      readFile(
        new URL(
          '../src/components/dashboard/SpendingSummary.svelte',
          import.meta.url,
        ),
        'utf8',
      ),
      readFile(
        new URL(
          '../src/components/report/ReportContent.svelte',
          import.meta.url,
        ),
        'utf8',
      ),
    ]);

    for (const source of [summarySource, reportSource]) {
      expect(source).toContain('describePreviousSpendingBasis');
      expect(source).toContain('summarizeUnsupportedRules');
      expect(source).toContain('previousSpendingBasis');
      expect(source).toContain('unsupportedRules');
    }
    expect(summarySource).not.toContain('const prevMonth = mb[mb.length - 2]');
    expect(summarySource).toContain('data-testid="previous-spending-basis"');
    expect(reportSource).toContain(
      'data-testid="report-unsupported-rules-summary"',
    );
  });
});
