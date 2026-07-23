import type Anthropic from '@anthropic-ai/sdk';
import { CARD_ID_MAX_LENGTH, CARD_ID_PATTERN } from '@cherrypicker/rules';
import {
  getCanonicalScraperRuleContract,
} from '../rule-contract.js';
import type { ScraperRuleContract } from '../rule-contract.js';

export function buildCardRuleExtractionTool(
  contract: ScraperRuleContract = getCanonicalScraperRuleContract(),
): Anthropic.Tool {
  return {
    name: 'extract_card_rules',
    description: '카드 혜택 규칙을 정규 분류·보상 계약으로 추출합니다',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: [
        'card',
        'performanceTiers',
        'performanceExclusions',
        'rewards',
        'globalConstraints',
      ],
      properties: {
        card: {
          type: 'object',
          additionalProperties: false,
          required: [
            'id',
            'name',
            'nameKo',
            'type',
            'annualFee',
          ],
          properties: {
            id: {
              type: 'string',
              minLength: 1,
              maxLength: CARD_ID_MAX_LENGTH,
              pattern: CARD_ID_PATTERN.source,
              description: '카드 고유 식별자 (영문 소문자, 숫자, 하이픈, 점)',
            },
            name: { type: 'string', description: '카드 영문명' },
            nameKo: { type: 'string', description: '카드 한글명' },
            type: {
              type: 'string',
              enum: ['credit', 'check', 'prepaid'],
              description: '카드 종류',
            },
            annualFee: {
              type: 'object',
              additionalProperties: false,
              required: ['domestic', 'international'],
              properties: {
                domestic: {
                  type: 'integer',
                  minimum: 0,
                  description: '국내 연회비 (원)',
                },
                international: {
                  type: 'integer',
                  minimum: 0,
                  description: '해외 연회비 (원)',
                },
              },
            },
            url: { type: 'string', description: '카드 상품 페이지 URL' },
          },
        },
        performanceTiers: {
          type: 'array',
          minItems: 1,
          description: '전월실적 구간 목록',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'label', 'minSpending', 'maxSpending'],
            properties: {
              id: { type: 'string', description: '구간 ID (예: tier1)' },
              label: { type: 'string', description: '구간 표시명' },
              minSpending: {
                type: 'integer',
                minimum: 0,
                description: '최소 전월실적 (원)',
              },
              maxSpending: {
                anyOf: [
                  { type: 'integer', minimum: 0 },
                  { type: 'null' },
                ],
                description: '최대 전월실적 (원, 없으면 null)',
              },
            },
          },
        },
        performanceExclusions: {
          type: 'array',
          description: '전월실적 제외 카테고리 ID 목록',
          items: { type: 'string' },
        },
        rewards: {
          type: 'array',
          minItems: 1,
          description: '정규 카테고리별 혜택 규칙 목록',
          items: contract.rewardInputSchema,
        },
        globalConstraints: {
          type: 'object',
          additionalProperties: false,
          required: [
            'monthlyTotalDiscountCap',
            'minimumAnnualSpending',
          ],
          properties: {
            monthlyTotalDiscountCap: {
              anyOf: [
                { type: 'integer', minimum: 0 },
                { type: 'null' },
              ],
              description: '월 전체 할인 한도 (원, 없으면 null)',
            },
            minimumAnnualSpending: {
              anyOf: [
                { type: 'integer', minimum: 0 },
                { type: 'null' },
              ],
              description: '최소 연간 실적 (원, 없으면 null)',
            },
            monthlyMileageCap: {
              type: 'integer',
              minimum: 0,
            },
            annualBonusMileage: {
              type: 'integer',
              minimum: 0,
            },
            note: { type: 'string' },
          },
        },
      },
    },
  };
}

export const CARD_RULE_EXTRACTION_TOOL = buildCardRuleExtractionTool();
