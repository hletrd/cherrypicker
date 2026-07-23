<div align="center">

<img src="https://raw.githubusercontent.com/hletrd/cherrypicker/main/apps/web/public/icon.svg" width="100" alt="CherryPicker" />

# CherryPicker

내 소비에 맞는 카드 조합 찾기

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Astro](https://img.shields.io/badge/Astro-BC52EE?logo=astro&logoColor=white)](https://astro.build/)
[![Svelte](https://img.shields.io/badge/Svelte-FF3E00?logo=svelte&logoColor=white)](https://svelte.dev/)

[Demo](https://hletrd.github.io/cherrypicker/) · [카드 데이터](packages/rules/data/cards/)

</div>

---

## 뭐하는 건가요

카드마다 할인 항목도 다르고, 전월실적 조건도 다르고, 한도도 달라서 매번 어떤 카드를 써야 할지 헷갈려요. CherryPicker는 카드 명세서를 넣으면 항목별 월간 혜택이 큰 카드 조합을 계산해 줘요.

한 장만 쓸 때와 비교한 월간 혜택 차이도 볼 수 있어요. 결과는 추천에 포함된 모든 카드를 사용할 수 있다고 가정한 연회비 차감 전 월간 총혜택이며, 실제 순절약액이나 카드 보유 비용을 뜻하지 않아요.

> CherryPicker compares gross monthly rewards before annual fees, assuming access to every included card; it does not report net savings or card ownership costs.

---

## 주요 기능

- **명세서 분석**: CSV/TSV, XLS/XLSX, PDF, JSON, OFX/QFX, HTML/HTM 파일을 올리면 알아서 읽고 항목별로 분류
- **거래 분류**: 수천 개 키워드 매칭 기반 분류 + 수동 수정 지원
- **카드 추천**: 전월실적과 할인한도를 반영해 항목별 월간 혜택이 큰 카드 조합 계산
- **혜택 비교**: 카드 한 장으로 쓸 때와 조합해 쓸 때의 연회비 차감 전 월간 혜택 차이를 한눈에
- **카드 혜택 데이터**: 국내 카드사 혜택을 YAML로 정리
- **웹 대시보드**: GitHub Pages에서 바로 사용 가능. 기본 분석은 브라우저에서 처리돼요
- **CLI**: 터미널에서 명세서 분석

---

## 거래 분류 방식

명세서에서 읽은 거래를 항목별로 나누는 과정이에요.

1. **키워드 매칭** (수천 개): "스타벅스"는 카페, "쿠팡"은 온라인쇼핑처럼 가맹점 이름으로 바로 분류
2. **AI 임베딩** (미구현): 현재 로드맵에 없음
3. **수동 수정**: 거래 목록에서 드롭다운으로 직접 고칠 수 있어요. 고친 다음 "변경 적용"을 누르면 추천이 다시 계산돼요

키워드는 네 소스 파일에서 모은 뒤 정규화해요. 같은 키워드가 서로 다른
카테고리를 가리키면 `packages/core/src/categorizer/keyword-overrides.ts`에
검토한 선택을 기록합니다. 새 충돌에 선택이 없거나 엄격 검사에서 더 이상
필요하지 않은 선택이 남아 있으면 매처 생성을 중단해요.

---

## 지원 카드사

아래 수치는 `packages/rules/data/cards/`의 YAML 파일을 기준으로 해요.

<!-- BEGIN GENERATED ISSUER COUNTS -->
[![Cards](https://img.shields.io/badge/cards-683-2f81f7)](packages/rules/data/cards/)
[![Issuers](https://img.shields.io/badge/issuers-24-2f81f7)](packages/rules/data/issuers.yaml)

| 카드사 | ID | 카드 수 |
|---|---:|---:|
| 신한카드 | `shinhan` | 80 |
| KB국민카드 | `kb` | 67 |
| 현대카드 | `hyundai` | 63 |
| 하나카드 | `hana` | 61 |
| 삼성카드 | `samsung` | 58 |
| 롯데카드 | `lotte` | 55 |
| 우리카드 | `woori` | 52 |
| NH농협카드 | `nh` | 49 |
| IBK기업은행 | `ibk` | 43 |
| BC카드 | `bc` | 22 |
| iM뱅크(대구은행) | `dgb` | 21 |
| BNK부산은행 | `bnk` | 19 |
| 제주은행 | `jeju` | 19 |
| 전북은행 | `jb` | 11 |
| 광주은행 | `kwangju` | 10 |
| SC제일은행 | `sc` | 10 |
| 카카오뱅크 | `kakao` | 9 |
| MG새마을금고 | `mg` | 8 |
| Sh수협은행 | `suhyup` | 8 |
| 케이뱅크 | `kbank` | 5 |
| 토스뱅크 | `toss` | 5 |
| 신협 | `cu` | 4 |
| 우체국 | `epost` | 2 |
| KDB산업은행 | `kdb` | 2 |
<!-- END GENERATED ISSUER COUNTS -->

---

## 기술 스택

| | |
|---|---|
| 웹 | Astro 7, Svelte 5, Tailwind CSS 4 |
| 파싱 | 직접 만든 TypeScript 파서, SheetJS, pdfjs-dist, pdf-parse |
| 차트 | Svelte 5 컴포넌트, SVG |
| AI 분류 | 미구현 (로드맵에 없음) |
| 데이터 | Zod, YAML 카드 규칙 |
| 배포 | GitHub Pages (정적 사이트) |
| CLI/스크래퍼 | Bun, Claude API |
| 언어 | TypeScript 5.9 |

---

## 프로젝트 구조

```
cherrypicker/
├── apps/web/              # Astro 정적 웹앱 (GitHub Pages)
│   ├── src/lib/parser/    # 브라우저용 파서 (CSV/TSV, XLS/XLSX, PDF, JSON, OFX/QFX, HTML/HTM)
│   ├── src/lib/analyzer.ts # 분석 파이프라인
│   ├── src/lib/cards.ts   # 카드 카탈로그 로더
│   └── public/data/       # 생성된 카드·카테고리 JSON
├── packages/
│   ├── core/              # 분류기, 계산기, 옵티마이저 (순수 TS)
│   ├── parser/            # Bun용 파서 (CLI에서 사용)
│   ├── rules/data/cards/  # 카드사별 YAML
│   └── viz/               # 터미널 테이블, HTML 리포트
├── tools/
│   ├── cli/               # CLI 진입점
│   └── scraper/           # Claude API로 카드 혜택 수집
└── scripts/build-json.ts  # YAML → JSON 빌드
```

---

## 사용법

### 웹

[hletrd.github.io/cherrypicker](https://hletrd.github.io/cherrypicker/)에서 바로 써 볼 수 있어요. 명세서를 올리면 브라우저에서 바로 분석해요.

현재 GitHub Pages에서는 저장소가 사용자 지정 HTTP 응답 헤더를 설정할 수 없어요. 그래서 클라이언트 프레임 가드는 보조 방어일 뿐, 응답 헤더의 `Content-Security-Policy: frame-ancestors 'none'`이나 `X-Frame-Options: DENY`와 같은 보호는 아닙니다. 향후 호스트나 CDN을 바꾼다면 실제 응답에 CSP, `X-Content-Type-Options`, HSTS, `Referrer-Policy`를 설정하고 검증한 뒤에만 헤더로 보호된다고 설명해야 합니다. JavaScript를 끈 경우에는 `<noscript>`가 안내 화면을 드러내지만, 업로드와 분석을 포함한 대화형 기능은 동작하지 않습니다.

### 로컬 개발

필수 도구는 Bun 1.3.12예요. 설치된 버전은 `bun run toolchain:check`로 확인할 수 있습니다.

```bash
git clone https://github.com/hletrd/cherrypicker.git
cd cherrypicker
bun install

# 카드 데이터 빌드
bun run data:build

# 생성 데이터가 소스와 일치하는지 확인
bun run data:check

# CI와 같은 전체 검증
bun run verify

# 웹 개발 서버
bun run dev:web

# CLI로 명세서 분석
bun run analyze -- ./statement.csv

# ANTHROPIC_API_KEY를 셸 또는 비밀 관리자를 통해 환경 변수로 주입한 뒤,
# 로컬 파싱이 불가능한 PDF만 원격 LLM 폴백 허용
bun run analyze -- ./statement.pdf --allow-remote-llm
```

PDF의 원격 LLM 폴백은 기본적으로 꺼져 있어요. 사용하려면
`ANTHROPIC_API_KEY`를 현재 프로세스의 환경 변수로 주입해야 합니다.
키 값을 명령줄에 직접 적거나 `.env`, 로그, 저장소에 넣지 말고 셸의
비공개 환경 또는 비밀 관리자를 사용하세요. `--allow-remote-llm`을
지정해도 실제 전송 전에 동의를 묻고, CI 같은 비대화형 환경에서는
명시적인 `--yes`가 필요해요.

---

### 카드 규칙 스크래퍼

스크래퍼는 Claude API를 사용하므로 `ANTHROPIC_API_KEY`를 현재 프로세스의
환경 변수로 주입해야 해요. 키를 명령 인수, `.env`, 로그, 저장소에 넣지
말고 셸의 비공개 환경이나 비밀 관리자를 사용하세요. 모델을 바꾸려면
`ANTHROPIC_MODEL`을 설정합니다. 기본 모델은 `claude-sonnet-5`예요.

지원 대상은 스크래퍼의 정규 목록과 같은
`hyundai, kb, samsung, shinhan, lotte, hana, woori, ibk, nh, bc`입니다.
기본 URL과 공식 허용 호스트는 카드사 설정에서 읽어요. 공식 호스트 밖의
URL이 꼭 필요하면 `--allow-host`를 반복해서 명시적으로 추가하세요.

```bash
# ANTHROPIC_API_KEY를 셸의 비공개 환경이나 비밀 관리자에서 먼저 주입
bun run scrape -- --issuer hyundai
```

기본 출력은 `packages/rules/data/cards`예요. 같은 이름의 일반 카드 파일은
기본적으로 덮어쓰지 않으며, `--force`를 쓰면 기존 파일을 교체할 수 있으니
대상을 먼저 확인하세요. 실행 후에는 다음 순서로 게시 데이터를 검증합니다.

1. 생성된 YAML의 출처, 카드명, 전월실적, 혜택, 한도를 직접 검토합니다.
2. `bun run data:build`로 공개 JSON과 카드사 인덱스를 다시 만듭니다.
3. `bun run data:check`로 YAML, 생성 데이터, 문서가 일치하는지 확인합니다.

---

## 카드 데이터

카드 혜택은 `packages/rules/data/cards/{카드사}/{카드이름}.yaml` 파일로 관리돼요.

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

performanceTiers:
  - id: tier0
    label: "무실적"
    minSpending: 0
    maxSpending: null

performanceExclusions: []

rewards:
  - id: reward-001
    category: "dining"
    subcategory: "cafe"
    label: "카페 1% 할인"
    type: discount
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

카드 데이터 수정이나 새 카드 추가는 PR로 보내주세요.

스크래퍼가 자동으로 수집할 수 있는 대상은 현재 설정된 일부 카드사뿐이며, 카드 데이터 디렉터리에 등록된 전체 발급사 범위와는 다릅니다.

---

## 라이선스

[Apache License 2.0](LICENSE)
