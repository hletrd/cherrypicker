<div align="center">

<img src="https://raw.githubusercontent.com/hletrd/cherrypicker/main/apps/web/public/icon.svg" width="100" alt="CherryPicker" />

# CherryPicker

내 소비에 맞는 카드 조합 찾기

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Astro](https://img.shields.io/badge/Astro-BC52EE?logo=astro&logoColor=white)](https://astro.build/)
[![Svelte](https://img.shields.io/badge/Svelte-FF3E00?logo=svelte&logoColor=white)](https://svelte.dev/)
[![Cards](https://img.shields.io/badge/Cards-561-DC2626)](packages/rules/data/cards/)
[![Issuers](https://img.shields.io/badge/Issuers-24-16A34A)](packages/rules/data/cards/)

[Demo](https://hletrd.github.io/cherrypicker/) · [카드 데이터](packages/rules/data/cards/)

</div>

---

## 뭐하는 건가요

카드마다 할인 항목도 다르고, 전월실적 조건도 다르고, 한도도 달라서 매번 어떤 카드를 써야 할지 헷갈려요. CherryPicker는 카드 명세서를 넣으면 항목별로 어떤 카드가 가장 이득인지 계산해 줘요.

한 장짜리로 밀어 쓸 때보다 얼마나 더 아낄 수 있는지도 비교해 볼 수 있어요.

> CherryPicker analyzes your credit card statement and finds the best card for each spending category — factoring in performance tiers, monthly caps, and reward types across 561 cards from 24 Korean issuers.

---

## 주요 기능

- **명세서 분석** — CSV, Excel, PDF 파일을 올리면 알아서 읽고 항목별로 분류
- **카드 추천** — 전월실적, 할인한도까지 따져서 항목별 최적 카드 조합 계산
- **절약 비교** — 카드 한 장 vs 체리피킹, 차이를 한눈에
- **561개 카드 데이터** — 24개 카드사 카드 혜택을 YAML로 정리
- **웹 대시보드** — Astro + Svelte 5 기반, GitHub Pages에서 바로 사용 가능
- **CLI** — 터미널에서 명세서 분석

---

## 지원 카드사

| 카드사 | 카드 수 | | 카드사 | 카드 수 |
|--------|---------|---|--------|---------|
| 신한카드 | 65 | | 카카오뱅크 | 9 |
| 현대카드 | 48 | | 수협은행 | 8 |
| 삼성카드 | 47 | | MG새마을금고 | 8 |
| 롯데카드 | 47 | | 토스뱅크 | 5 |
| KB국민카드 | 47 | | 케이뱅크 | 5 |
| 하나카드 | 45 | | 신협 | 4 |
| 우리카드 | 42 | | KDB산업은행 | 2 |
| IBK기업은행 | 35 | | 우체국 | 2 |
| NH농협카드 | 34 | | 제주은행 | 19 |
| iM뱅크 | 21 | | BNK | 19 |
| BC카드 | 18 | | 전북은행 | 11 |
| SC제일은행 | 10 | | 광주은행 | 10 |

---

## 기술 스택

| | |
|---|---|
| 웹 | Astro 6, Svelte 5, Tailwind CSS 4 |
| 파싱 | PapaParse, SheetJS, pdfjs-dist |
| 데이터 | Zod, YAML, 561 cards in structured YAML |
| 배포 | GitHub Pages (정적 사이트) |
| CLI/스크래퍼 | Bun, Claude API |
| 언어 | TypeScript 6 |

---

## 프로젝트 구조

```
cherrypicker/
├── apps/web/              # Astro 정적 웹앱 (GitHub Pages)
│   ├── src/lib/parser/    # 브라우저용 파서 (CSV, XLSX, PDF)
│   ├── src/lib/analyzer.ts # 클라이언트 분석 파이프라인
│   └── public/data/       # 빌드된 cards.json
├── packages/
│   ├── core/              # 분류기, 계산기, 옵티마이저 (순수 TS)
│   ├── parser/            # Node/Bun용 파서 (CLI에서 사용)
│   ├── rules/data/cards/  # 카드사별 YAML (561개)
│   └── viz/               # 터미널 테이블, HTML 리포트
├── tools/
│   ├── cli/               # CLI 진입점
│   └── scraper/           # Claude API로 카드 혜택 수집
└── scripts/build-json.ts  # YAML → JSON 빌드
```

---

## 사용법

### 웹

[hletrd.github.io/cherrypicker](https://hletrd.github.io/cherrypicker/)에서 바로 사용할 수 있어요. 명세서 파일을 올리면 브라우저에서 바로 분석해요. 서버로 데이터가 전송되지 않아요.

### 로컬 개발

```bash
git clone https://github.com/hletrd/cherrypicker.git
cd cherrypicker
bun install

# 카드 데이터 빌드
bun run scripts/build-json.ts

# 웹 개발 서버
bun run dev:web

# CLI로 명세서 분석
bun run analyze
```

---

## 카드 데이터

카드 혜택은 `packages/rules/data/cards/{카드사}/{카드이름}.yaml` 파일로 관리돼요.

```yaml
card:
  id: "shinhan-b-big"
  issuer: "shinhan"
  name: "B.Big"
  nameKo: "삑"
  type: credit
  annualFee:
    domestic: 10000
    international: 13000

performanceTiers:
  - id: tier1
    label: "전월 30만원 이상"
    minSpending: 300000

rewards:
  - category: "public_transit"
    type: discount
    tiers:
      - performanceTier: tier1
        fixedAmount: 200
        monthlyCap: 6000

globalConstraints:
  monthlyTotalDiscountCap: 15000
```

카드 데이터 수정이나 새 카드 추가는 PR로 보내주세요.

---

## 라이선스

[MIT](LICENSE)
