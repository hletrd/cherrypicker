# CherryPicker Agent Guidelines

## 카드 데이터 관리

### 카드 추가 절차
1. 나무위키 `{카드사}/카드 상품` 페이지에서 현재 신규 발급 가능한 카드 확인
2. 카드고릴라, 뱅크샐러드에서 혜택 상세 확인
3. `packages/rules/data/cards/{issuer}/{slug}.yaml` 파일 생성
4. `bun run data:build`로 전체 공개 데이터를 다시 생성
5. `bun run data:check`로 YAML, JSON, 발급사 인덱스가 서로 맞는지 확인

`data:build`는 `cards.json`, 카드 요약, 최적화 데이터, 발급사별 상세
파일, 카테고리, 폴백 레이블, 발급사 README를 한 번에 갱신한다. 생성된
파일을 따로 복사하거나 직접 고치지 않는다.

### YAML 스키마
<!-- BEGIN VALIDATED CARD EXAMPLE -->
```yaml
card:
  id: "shinhan-example-basic"
  issuer: "shinhan"
  name: "Example Basic"
  nameKo: "예시 베이직"
  type: credit
  annualFee:
    domestic: 10000
    international: 10000
  url: "https://www.shinhancard.com/"
  lastUpdated: "2026-07-23"
  source: manual
  discontinued: false

performanceTiers:
  - id: tier0
    label: "무실적"
    minSpending: 0
    maxSpending: null

performanceExclusions: []

rewards:
  - id: reward-001
    category: dining
    subcategory: cafe
    label: "카페 할인"
    type: discount  # 또는 points, cashback, mileage
    tiers:
      - performanceTier: tier0
        rate: 1.0
        monthlyCap: null
        perTransactionCap: null
    priority: 1
    combination: exclusive
    stackingGroup: base
    capGroup: reward-001
    support:
      status: supported

globalConstraints:
  monthlyTotalDiscountCap: null
  minimumAnnualSpending: null
```
<!-- END VALIDATED CARD EXAMPLE -->

### 카드사 목록 (24개)
hyundai, kb, samsung, shinhan, lotte, hana, woori, ibk, nh, bc, kakao, toss, kbank, bnk, dgb, suhyup, jb, kwangju, jeju, sc, mg, cu, kdb, epost

### 항목(카테고리) ID
최상위 ID와 하위 ID를 섞어 쓰지 않는다. 예를 들어 카페는
`category: dining`, `subcategory: cafe`, 주유는
`category: transportation`, `subcategory: fuel`로 적는다. 최상위 ID와
유효한 조합의 기준은 `packages/rules/data/categories.yaml`이다. 모든
가맹점에 적용되는 규칙만 `category: '*'`를 쓴다.

### 단종 카드 처리
- 신규 발급이 중단된 카드는 `card.discontinued: true`로 표시하거나 삭제
- 나무위키 `/발급 중단` 페이지에서 단종 여부 확인

### 리서치 소스 (우선순위)
1. 나무위키 `{카드사}/카드 상품` (가장 포괄적)
2. 카드사 공식 홈페이지
3. 카드고릴라 (card-gorilla.com)
4. 뱅크샐러드 (banksalad.com)

## 파서 관리

### 키워드 파일 구조
- `packages/core/src/categorizer/keywords.ts` (기본 키워드 묶음)
- `packages/core/src/categorizer/keywords-locations.ts` (체인+지역 조합)
- `packages/core/src/categorizer/keywords-english.ts` (영문/글로벌)
- `packages/core/src/categorizer/keywords-niche.ts` (니치 한국어)
- 전체 소스는 수천 개 규모다.
- `matcher.ts`가 네 파일을 모아 정규화한 뒤 사용한다.

### 키워드 추가 시 주의
- 같은 키워드가 서로 다른 정규 카테고리를 가리키면
  `packages/core/src/categorizer/keyword-overrides.ts`에 검토한 선택을
  기록한다.
- 선택이 없는 충돌은 매처 생성에 실패한다. 엄격 모드에서는 더 이상
  충돌이 아닌 오래된 선택도 실패한다.
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
