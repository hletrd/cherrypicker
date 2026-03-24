export const CARD_RULE_EXTRACTION_TOOL = {
  name: 'extract_card_rules',
  description: '카드 혜택 규칙을 구조화된 형식으로 추출합니다',
  input_schema: {
    type: 'object' as const,
    required: ['card', 'performanceTiers', 'performanceExclusions', 'rewards', 'globalConstraints'],
    properties: {
      card: {
        type: 'object',
        required: ['id', 'issuer', 'name', 'nameKo', 'type', 'annualFee', 'lastUpdated', 'source'],
        properties: {
          id: { type: 'string', description: '카드 고유 식별자 (영문 소문자, 하이픈)' },
          issuer: {
            type: 'string',
            enum: ['hyundai', 'kb', 'samsung', 'shinhan', 'lotte', 'hana', 'woori', 'ibk', 'nh', 'bc'],
            description: '카드사 ID',
          },
          name: { type: 'string', description: '카드 영문명' },
          nameKo: { type: 'string', description: '카드 한글명' },
          type: { type: 'string', enum: ['credit', 'check'], description: '카드 종류' },
          annualFee: {
            type: 'object',
            required: ['domestic', 'international'],
            properties: {
              domestic: { type: 'integer', description: '국내 연회비 (원)' },
              international: { type: 'integer', description: '해외 연회비 (원)' },
            },
          },
          url: { type: 'string', description: '카드 상품 페이지 URL' },
          lastUpdated: { type: 'string', description: '마지막 업데이트 날짜 (YYYY-MM-DD)' },
          source: { type: 'string', enum: ['manual', 'llm-scrape'], description: '데이터 출처' },
        },
      },
      performanceTiers: {
        type: 'array',
        description: '전월실적 구간 목록',
        items: {
          type: 'object',
          required: ['id', 'label', 'minSpending'],
          properties: {
            id: { type: 'string', description: '구간 ID (예: tier1, tier2)' },
            label: { type: 'string', description: '구간 표시명 (예: 30만원 이상)' },
            minSpending: { type: 'integer', description: '최소 전월실적 (원)' },
            maxSpending: {
              oneOf: [{ type: 'integer' }, { type: 'null' }],
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
        description: '카테고리별 혜택 규칙 목록',
        items: {
          type: 'object',
          required: ['category', 'type', 'tiers'],
          properties: {
            category: {
              type: 'string',
              description: '정규 카테고리 ID (* = 전 가맹점)',
            },
            type: {
              type: 'string',
              enum: ['discount', 'points', 'cashback', 'mileage'],
              description: '혜택 유형',
            },
            tiers: {
              type: 'array',
              items: {
                type: 'object',
                required: ['performanceTier', 'rate'],
                properties: {
                  performanceTier: { type: 'string', description: '전월실적 구간 ID' },
                  rate: {
                    type: 'number',
                    minimum: 0,
                    maximum: 1,
                    description: '혜택률 (소수, 예: 0.05 = 5%)',
                  },
                  monthlyCap: {
                    oneOf: [{ type: 'integer' }, { type: 'null' }],
                    description: '월 최대 혜택 한도 (원)',
                  },
                  perTransactionCap: {
                    oneOf: [{ type: 'integer' }, { type: 'null' }],
                    description: '건당 최대 혜택 한도 (원)',
                  },
                },
              },
            },
            conditions: {
              type: 'object',
              properties: {
                minTransaction: { type: 'integer', description: '최소 결제 금액 (원)' },
                excludeOnline: { type: 'boolean', description: '온라인 결제 제외 여부' },
                specificMerchants: {
                  type: 'array',
                  items: { type: 'string' },
                  description: '특정 가맹점 목록',
                },
              },
            },
          },
        },
      },
      globalConstraints: {
        type: 'object',
        required: ['monthlyTotalDiscountCap', 'minimumAnnualSpending'],
        properties: {
          monthlyTotalDiscountCap: {
            oneOf: [{ type: 'integer' }, { type: 'null' }],
            description: '월 전체 할인 한도 (원)',
          },
          minimumAnnualSpending: {
            oneOf: [{ type: 'integer' }, { type: 'null' }],
            description: '최소 연간 실적 (원)',
          },
        },
      },
    },
  },
} as const;
