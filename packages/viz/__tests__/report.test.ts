import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import {
  generateHTMLReport,
  renderReportTemplate,
  type ReportTemplateReplacements,
  type StandaloneReportContext,
} from '../src/report/generator.js';
import type { OptimizationResult, CategorizedTransaction } from '@cherrypicker/core';

const optimization: OptimizationResult = {
  assignments: [
    {
      category: 'uncategorized',
      categoryNameKo: '미분류',
      assignedCardId: 'simple-plan',
      assignedCardName: '심플플랜',
      spending: 100000,
      reward: 1000,
      rate: 0.01,
      alternatives: [],
    },
  ],
  totalReward: 1000,
  totalSpending: 100000,
  effectiveRate: 0.01,
  savingsVsSingleCard: 0,
  bestSingleCard: {
    cardId: 'simple-plan',
    cardName: '심플플랜',
    totalReward: 1000,
  },
  cardResults: [
    {
      cardId: 'simple-plan',
      cardName: '심플플랜',
      totalReward: 1000,
      totalSpending: 100000,
      effectiveRate: 0.01,
      byCategory: [],
      performanceTier: 'tier0',
      capsHit: [],
    },
  ],
};

const transactions: CategorizedTransaction[] = [
  {
    id: 't1',
    date: '2026-02-01',
    merchant: '<이마트>',
    amount: 100000,
    currency: 'KRW',
    category: 'uncategorized',
    confidence: 1,
  },
];

const categoryLabels = new Map([['uncategorized', '미분류']]);

const reportContext: StandaloneReportContext = {
  latestStatementPeriod: { start: '2026-02-01', end: '2026-02-28' },
  fullStatementPeriod: { start: '2026-01-01', end: '2026-02-28' },
  latestTransactionCount: 1,
  fullTransactionCount: 2,
  parserExclusions: [],
  calendarExclusions: [],
  previousSpendingBasis: { kind: 'statement-month', month: '2026-01' },
  unsupportedIssues: [],
};

describe('generateHTMLReport', () => {
  test('renders summary values and escapes transaction content', () => {
    const html = generateHTMLReport(
      optimization,
      transactions,
      categoryLabels,
      reportContext,
    );

    expect(html).toContain('100,000원');
    expect(html).toContain('1,000원');
    expect(html).toContain('심플플랜');
    expect(html).toContain('분석 범위와 제한');
    expect(html).toContain('2026-02-01 ~ 2026-02-28');
    expect(html).toContain('2026-01-01 ~ 2026-02-28');
    expect(html).toContain('명세서의 직전 달(2026-01) 거래 합계');
    expect(html).toContain('연회비 차감 전 월간 총혜택');
    expect(html).toContain('포함된 모든 카드를 사용할 수 있다고 가정');
    expect(html).not.toContain('추가 절약');
    expect(html).not.toContain('<이마트>');
  });

  test.each([
    [
      'same category',
      [
        {
          ...transactions[0]!,
          id: 'max',
          amount: Number.MAX_SAFE_INTEGER,
        },
        {
          ...transactions[0]!,
          id: 'two',
          amount: 2,
        },
      ],
    ],
    [
      'different categories',
      [
        {
          ...transactions[0]!,
          id: 'max',
          amount: Number.MAX_SAFE_INTEGER,
        },
        {
          ...transactions[0]!,
          id: 'two',
          amount: 2,
          category: 'dining',
        },
      ],
    ],
  ] as const)('rejects an unsafe %s spending aggregate', (_name, unsafe) => {
    expect(() =>
      generateHTMLReport(
        optimization,
        [...unsafe] as CategorizedTransaction[],
        categoryLabels,
        reportContext,
      ),
    ).toThrow('안전한 정수 범위');
  });

  test('renders the exact-safe boundary and filters refunds from the report total', () => {
    const exactSafe: CategorizedTransaction[] = [
      {
        ...transactions[0]!,
        id: 'near-max',
        amount: Number.MAX_SAFE_INTEGER - 1,
      },
      {
        ...transactions[0]!,
        id: 'one',
        amount: 1,
      },
      {
        ...transactions[0]!,
        id: 'refund',
        amount: -100,
      },
    ];
    const html = generateHTMLReport(
      optimization,
      exactSafe,
      categoryLabels,
      reportContext,
    );

    expect(html).toContain(
      `${Number.MAX_SAFE_INTEGER.toLocaleString('ko-KR')}원`,
    );
    expect(html).toContain('<td class="right">2건</td>');
  });

  test('escapes HTML entities including quotes, slashes, and null bytes', () => {
    const evilOptimization: OptimizationResult = {
      ...optimization,
      bestSingleCard: { cardId: 'evil', cardName: "O'Brien / Test \\0", totalReward: 0 },
      cardResults: [
        {
          cardId: 'evil',
          cardName: "O'Brien / Test \\0",
          totalReward: 0,
          totalSpending: 0,
          effectiveRate: 0,
          byCategory: [],
          performanceTier: 'tier0',
          capsHit: [],
        },
      ],
    };
    const html = generateHTMLReport(
      evilOptimization,
      transactions,
      categoryLabels,
      reportContext,
    );
    expect(html).toContain('O&#39;Brien');   // single quote escaped
    expect(html).not.toContain("O'Brien");   // raw single quote not present
  });

  test('authorizes exactly the fixed inline stylesheet and disables scripts', () => {
    const html = generateHTMLReport(
      optimization,
      transactions,
      categoryLabels,
      reportContext,
    );
    const styleMatches = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)];
    const csp = html.match(
      /<meta http-equiv="Content-Security-Policy" content="([^"]+)" \/>/,
    )?.[1];

    expect(styleMatches).toHaveLength(1);
    const style = styleMatches[0]?.[1];
    expect(style).toBeDefined();
    const expectedHash = createHash('sha256')
      .update(style!, 'utf8')
      .digest('base64');

    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("script-src 'none'");
    expect(csp).toContain(`style-src 'sha256-${expectedHash}'`);
    expect(csp).not.toContain("'unsafe-inline'");
    expect(html).not.toContain('{{STYLE_SHA256}}');
    expect(html).not.toMatch(/<script\b/i);
  });

  test('uses the CherryPicker identity throughout the generated report', () => {
    const html = generateHTMLReport(
      optimization,
      transactions,
      categoryLabels,
      reportContext,
    );

    expect(html).toContain('<title>CherryPicker 분석 보고서</title>');
    expect(html).toContain('<h1>CherryPicker 분석 보고서</h1>');
    expect(html).toContain(
      '<p>CherryPicker — 한국 신용카드 최적화 도구',
    );
    expect(html).not.toContain('CardPick');
  });

  test('renders durable parser, calendar, and unsupported-calculation disclosures', () => {
    const context: StandaloneReportContext = {
      ...reportContext,
      parserExclusions: [
        {
          file: 'statement.csv',
          format: 'csv',
          line: 7,
          code: 'BAD_AMOUNT',
          message: '금액을 해석할 수 없어 제외',
        },
      ],
      calendarExclusions: [
        {
          kind: 'invalid-date',
          count: 2,
          message: '날짜를 확인할 수 없어 추천에서 제외',
        },
        {
          kind: 'outside-latest-month',
          count: 3,
          message: '최신 명세서 월 밖의 거래를 제외',
        },
      ],
      previousSpendingBasis: {
        kind: 'missing-calendar-month',
        month: '2026-01',
        assumedAmount: 0,
      },
      unsupportedIssues: [
        {
          cardId: 'card-a',
          transactionId: 'tx-1',
          ruleId: 'rule-1',
          category: 'shopping',
          reason: 'missing_payment_type',
          detail: '결제 유형 없음',
        },
      ],
    };

    const html = generateHTMLReport(
      optimization,
      transactions,
      categoryLabels,
      context,
    );

    expect(html).toContain('statement.csv');
    expect(html).toContain('BAD_AMOUNT');
    expect(html).toContain('금액을 해석할 수 없어 제외');
    expect(html).toContain('날짜를 확인할 수 없어 추천에서 제외 (2건)');
    expect(html).toContain('최신 명세서 월 밖의 거래를 제외 (3건)');
    expect(html).toContain('직전 달(2026-01) 거래가 없어 0원으로 가정');
    expect(html).toContain('missing_payment_type');
    expect(html).toContain('결제 유형 없음');
  });

  test('treats invalid and script-shaped numeric entities as text in every dynamic text family', () => {
    const entities = [
      '&#not-decimal;',
      '&#999999999999999999999999;',
      '&#xNOTHEX;',
      '&#xFFFFFFFFFFFFFFFF;',
      '&#xD800;',
      '&#x110000;',
      '&#12',
      '&#x3C;script&#x3E;',
    ];
    const hostile = entities.join('|');
    const hostileOptimization: OptimizationResult = {
      ...optimization,
      bestSingleCard: {
        cardId: 'hostile',
        cardName: hostile,
        totalReward: 0,
      },
      assignments: [
        {
          ...optimization.assignments[0]!,
          categoryNameKo: hostile,
          assignedCardName: hostile,
          alternatives: [
            {
              cardId: 'alternative',
              cardName: hostile,
              reward: 0,
              rate: 0,
            },
          ],
        },
      ],
      cardResults: [
        {
          ...optimization.cardResults[0]!,
          cardName: hostile,
          performanceTier: hostile,
          capsHit: [
            {
              category: hostile,
              capType: 'monthly_category',
              capAmount: 1,
              actualReward: 2,
              appliedReward: 1,
            },
          ],
        },
      ],
    };
    const hostileContext: StandaloneReportContext = {
      latestStatementPeriod: { start: hostile, end: hostile },
      fullStatementPeriod: { start: hostile, end: hostile },
      latestTransactionCount: 1,
      fullTransactionCount: 1,
      parserExclusions: [
        {
          message: hostile,
          code: hostile,
          line: 1,
          file: hostile,
          format: hostile,
        },
      ],
      calendarExclusions: [
        { kind: 'invalid-date', count: 1, message: hostile },
      ],
      previousSpendingBasis: {
        kind: 'statement-month',
        month: hostile as `${number}-${string}`,
      },
      unsupportedIssues: [
        {
          cardId: hostile,
          transactionId: hostile,
          ruleId: hostile,
          category: hostile,
          reason: hostile,
          detail: hostile,
        },
      ],
    };

    const html = generateHTMLReport(
      hostileOptimization,
      transactions,
      new Map([['uncategorized', hostile]]),
      hostileContext,
    );

    for (const entity of entities) {
      expect(html).not.toContain(entity);
      expect(html).toContain(entity.replaceAll('&', '&amp;'));
    }
    expect(html).not.toMatch(/<script\b/i);
  });

  test('does not interpret placeholder-shaped user text as a report section', () => {
    const collision = '{{ASSIGNMENTS}}';
    const collisionOptimization: OptimizationResult = {
      ...optimization,
      bestSingleCard: {
        ...optimization.bestSingleCard,
        cardName: collision,
      },
    };
    const html = generateHTMLReport(
      collisionOptimization,
      transactions,
      categoryLabels,
      reportContext,
    );

    expect(html).toContain(
      `<div class="sub">단일 최적: ${collision}</div>`,
    );
    expect(html.match(/카테고리별 추천 카드 배분/g)).toHaveLength(1);
  });
});

describe('renderReportTemplate', () => {
  const replacements: ReportTemplateReplacements = {
    STYLE_SHA256: 'style',
    GENERATED_DATE: 'date',
    ANALYSIS_LIMITATIONS: 'limitations',
    SUMMARY: 'summary',
    CATEGORY_TABLE: 'categories',
    CARD_COMPARISON: 'cards',
    ASSIGNMENTS: 'assignments',
  };
  const completeTemplate = Object.keys(replacements)
    .map((name) => `{{${name}}}`)
    .join('|');

  test('replaces the original template in one pass', () => {
    const html = renderReportTemplate(completeTemplate, {
      ...replacements,
      SUMMARY: '{{ASSIGNMENTS}}',
    });

    expect(html).toBe(
      'style|date|limitations|{{ASSIGNMENTS}}|categories|cards|assignments',
    );
  });

  test('rejects missing, duplicated, and unknown template placeholders', () => {
    expect(() =>
      renderReportTemplate(
        completeTemplate.replace('{{SUMMARY}}', ''),
        replacements,
      ),
    ).toThrow('SUMMARY must occur exactly once; found 0');
    expect(() =>
      renderReportTemplate(
        `${completeTemplate}|{{SUMMARY}}`,
        replacements,
      ),
    ).toThrow('SUMMARY must occur exactly once; found 2');
    expect(() =>
      renderReportTemplate(
        `${completeTemplate}|{{SURPRISE}}`,
        replacements,
      ),
    ).toThrow('Unknown report template placeholder: SURPRISE');
  });
});
