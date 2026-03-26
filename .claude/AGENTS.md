# CherryPicker Agent Guidelines

## 카드 데이터 관리

### 카드 추가 절차
1. 나무위키 `{카드사}/카드 상품` 페이지에서 현재 신규 발급 가능한 카드 확인
2. 카드고릴라, 뱅크샐러드에서 혜택 상세 확인
3. `packages/rules/data/cards/{issuer}/{slug}.yaml` 파일 생성
4. `scripts/build-json.ts` 실행해서 cards.json 재생성
5. `apps/web/public/data/cards.json`에 복사

### YAML 스키마
```yaml
card:
  id: "{issuer}-{slug}"
  issuer: "{issuer}"
  name: "{English Name}"
  nameKo: "{한국어 이름}"
  type: credit  # 또는 check
  annualFee:
    domestic: {숫자}
    international: {숫자}
  url: ""
  lastUpdated: "{YYYY-MM-DD}"
  source: manual

performanceTiers:
  - id: tier0
    label: "무실적"
    minSpending: 0
    maxSpending: null

performanceExclusions: []

rewards:
  - category: "{category_id}"
    type: discount  # 또는 points, cashback, mileage
    tiers:
      - performanceTier: tier0
        rate: {퍼센트 숫자, 10% = 10.0}
        monthlyCap: {숫자 또는 null}
        perTransactionCap: {숫자 또는 null}

globalConstraints:
  monthlyTotalDiscountCap: {숫자 또는 null}
  minimumAnnualSpending: null
```

### 카드사 목록 (24개)
hyundai, kb, samsung, shinhan, lotte, hana, woori, ibk, nh, bc, kakao, toss, kbank, bnk, dgb, suhyup, jb, kwangju, jeju, sc, mg, cu, kdb, epost

### 항목(카테고리) ID
dining, restaurant, cafe, fast_food, delivery, grocery, supermarket, traditional_market, online_grocery, convenience_store, online_shopping, offline_shopping, department_store, fashion, public_transit, subway, bus, taxi, transportation, fuel, parking, toll, telecom, insurance, medical, hospital, pharmacy, education, academy, books, entertainment, movie, streaming, subscription, travel, airline, hotel, utilities, electricity, gas, water, uncategorized

### 단종 카드 처리
- 신규 발급이 중단된 카드는 YAML 파일에 `discontinued: true` 추가하거나 삭제
- 나무위키 `/발급 중단` 페이지에서 단종 여부 확인

### 리서치 소스 (우선순위)
1. 나무위키 `{카드사}/카드 상품` (가장 포괄적)
2. 카드사 공식 홈페이지
3. 카드고릴라 (card-gorilla.com)
4. 뱅크샐러드 (banksalad.com)

## 파서 관리

### 키워드 파일 구조
- `packages/core/src/categorizer/keywords.ts` (기본 ~10,000개)
- `packages/core/src/categorizer/keywords-locations.ts` (체인+지역 조합)
- `packages/core/src/categorizer/keywords-english.ts` (영문/글로벌)
- `packages/core/src/categorizer/keywords-niche.ts` (니치 한국어)
- `matcher.ts`에서 `ALL_KEYWORDS`로 합쳐서 사용

### 키워드 추가 시 주의
- 중복 키가 있으면 나중 파일이 덮어씀
- 소문자로 통일 (matcher가 toLowerCase 처리)
- 카테고리 ID는 위 목록에서만 사용

## 한국어 작성 규칙

### 말투
- AI 말투 금지: "~를 제공합니다", "~가 가능합니다" 같은 표현 쓰지 않기
- 번역체 금지: "오류가 발생했습니다" → "문제가 생겼어요"
- 영문 직역 금지: "최적화 도구" → 자연스러운 한국어로
- 짧고 자연스럽게

### 문장부호
- 느낌표(!) 쓰지 않기
- 말줄임표(...) 쓰지 않기
- em dash(—) 한국어 문장에 쓰지 않기
- vs 같은 영문 약어 쓰지 않기
