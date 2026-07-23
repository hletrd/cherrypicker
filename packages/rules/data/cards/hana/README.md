# 하나카드 (Hana Card)

> 이 디렉터리에는 총 61개 카드 YAML이 있습니다. 아래 표는 대표 상품만 요약합니다.

## 대표 카드

| 카드명 | 연회비 | 주요 혜택 | 전월실적 |
|--------|--------|-----------|----------|
| 원더카드 2.0 FREE | 1.2만원 | 전 가맹점 0.7% 할인, 간편결제 1.2%, 마트/베이커리 2%, 대중교통 3% | 없음 |
| 원더카드 2.0 LIFE | 1.99만원 | 스트리밍 40%, 생활요금/배달/교통/편의점/커피 10% 할인 | 40만원 이상 |
| 원더카드 2.0 LIVING | 1.99만원 | 생활요금/병원/주유/택시/커피/세탁 10% 할인 | 40만원 이상 |
| 원더카드 2.0 YOUNG | 1.99만원 | 스트리밍 70%, 배달/교통/온라인패션/편의점 10% 할인 | 40만원 이상 |
| 원더카드 2.0 HAPPY | 1.2만원 | 간편결제/마트/주유/커피/뷰티 5%, 전 가맹점 0.5% 할인 | 40만원 이상 |
| 토스뱅크 하나카드 Day | 2만원 | 관리비/통신/마트/병원/학원/보험 등 10% 할인 (월 최대 5만원) | 50만원 이상 |
| JADE Classic | 12만원 | 전 가맹점 1.0% 하나머니 적립, 프리미엄 바우처 연 10만원, 공항라운지 연 3회 | 50만원 이상 |
| 원큐카드 | 1.5만원 | 하나원큐페이 1.8% 적립, 전 가맹점 0.8% 적립, 해외 1.8% (무실적) | 없음 |
| 스카이패스 아멕스 플래티늄 | 4.5만원 | 국내 1,000원당 1마일, 해외 1,000원당 2마일, 공항라운지 무료 | 50만원 이상 (특별적립) |
| 원큐 K패스 | 1.7만원 | 대중교통 10%, 다이소/올리브영 10%, 스타벅스/커피빈 10% 할인 | 30만원 이상 |
| 트래블로그 신용카드 | 2만원 | 해외 3% 적립 (월 5만), 전 가맹점 1% 적립 (무실적, 무제한) | 없음 |
| 달달하나 All | 2.5만원 | 전 가맹점 1% 무제한 적립, 공과금 1.3%, 해외/교통/의료 10% 적립 | 30만원 이상 |
| 달달하나 Sweet | 2.5만원 | 음식점 5~10%, 커피/베이커리 10~20%, 배달 5~10% 적립 | 30만원 이상 |
| 달달하나 Fun | 2.5만원 | 스트리밍 20~50%, 온라인쇼핑 5~10%, 멤버십 10~20%, 영화 10~20% 적립 | 30만원 이상 |
| Simple Life | 국내 1.5만원 / 해외 2만원 | Simple: 전 가맹점 0.7% 무제한 할인, Life: 선택영역 할인 | 없음 (Simple) / 30만원 이상 (Life) |
| 네이버페이 머니 하나 체크 | 무연회비 | 전 가맹점 1.2% 네이버페이 포인트 적립 (월 1만) | 25만원 이상 |

## 카드 파일

- `wonder-2.0-free.yaml` - 무실적 기본 할인
- `wonder-2.0-life.yaml` - 구독/생활 할인 특화
- `wonder-2.0-living.yaml` - 생활비/의료/주유 할인 특화
- `wonder-2.0-young.yaml` - 스트리밍/배달/패션 청년 특화
- `wonder-2.0-happy.yaml` - 간편결제/마트/주유/커피 종합 할인
- `tossbank-day.yaml` - 토스뱅크 PLCC 고정비 할인
- `jade-classic.yaml` - 프리미엄 적립/여행 카드
- `1q-card.yaml` - 무실적 하나원큐페이 적립 특화
- `skypass-amex-platinum.yaml` - 대한항공 마일리지 적립 특화
- `k-pass-1q.yaml` - K패스 대중교통 + 생활할인
- `travellog-credit.yaml` - 무실적 해외 여행 적립 특화
- `daltal-all.yaml` - 전 가맹점 1% 무제한 적립 + 생활
- `daltal-sweet.yaml` - 음식/커피/베이커리 적립 특화
- `daltal-fun.yaml` - 스트리밍/온라인쇼핑/엔터 적립 특화
- `simple-life.yaml` - 무실적 0.7% 범용 할인
- `naverpay-check.yaml` - 네이버페이 포인트 적립 체크카드

## 참고

- 원더카드 2.0 FREE는 무실적 카드로 혜택 영역을 앱에서 자유롭게 변경 가능
- 원더카드 LIFE/LIVING/YOUNG은 전월실적 40만원 구간부터 혜택 적용
- 원더카드 HAPPY는 영역별 통합한도 5만원, 전 가맹점 0.5% 기본 할인
- 토스뱅크 하나카드 Day는 전월 100만원 이상 시 영역별 한도 1만원으로 확대
- JADE Classic은 연회비 12만원이나 바우처 10만원 제공으로 실질 부담 적음
- 원큐카드는 하나원큐페이 결제 시 1.8% 적립, 적립한도 월 10만 하나머니
- 스카이패스 아멕스 플래티늄은 전월실적 무관 기본 적립, 50만원 이상 시 해외 2마일 특별적립
- 원큐 K패스는 대중교통 월 최대 2만원 할인 (60만원 이상 실적 시)
- 트래블로그 신용카드는 무실적 전 가맹점 1% + 해외 3% 적립으로 해외여행 필수 카드
- 달달하나 3종은 직장인 맞춤 카드로 All(범용), Sweet(먹거리), Fun(구독/쇼핑) 선택 가능
- Simple Life는 Simple 서비스(0.7% 무제한) 또는 Life 서비스(선택영역 할인) 중 택 1
- 네이버페이 머니 하나 체크는 전월 25만원 실적 시 전 가맹점 1.2% 네이버포인트 적립

<!-- BEGIN GENERATED CARD INDEX -->
## 전체 카드 인덱스

> YAML 기준 **61개** · 최신 업데이트: `2026-03-26`

| 카드명 | 유형 | YAML |
|---|---:|---|
| K-패스 하나 체크카드 | 체크 | [k-pass-check.yaml](./k-pass-check.yaml) |
| 네이버페이 머니 하나 체크카드 | 체크 | [naverpay-check.yaml](./naverpay-check.yaml) |
| 네이버페이 하나카드 | 신용 | [naverpay-credit.yaml](./naverpay-credit.yaml) |
| 달달 하나 체크카드 | 체크 | [daltal-check.yaml](./daltal-check.yaml) |
| 달달하나 All | 신용 | [daltal-all.yaml](./daltal-all.yaml) |
| 달달하나 Fun | 신용 | [daltal-fun.yaml](./daltal-fun.yaml) |
| 달달하나 Sweet | 신용 | [daltal-sweet.yaml](./daltal-sweet.yaml) |
| 밀리언달러 하나카드 | 신용 | [million-dollar.yaml](./million-dollar.yaml) |
| 심플라이프 | 신용 | [simple-life.yaml](./simple-life.yaml) |
| 토스뱅크 하나카드 Day | 신용 | [tossbank-day.yaml](./tossbank-day.yaml) |
| 토스뱅크 하나카드 Wide | 신용 | [tossbank-wide.yaml](./tossbank-wide.yaml) |
| 트래블로그 SKYPASS 신용카드 | 신용 | [travellog-skypass.yaml](./travellog-skypass.yaml) |
| 트래블로그 신용카드 | 신용 | [travellog-credit.yaml](./travellog-credit.yaml) |
| 하나 1Q Daily+ | 신용 | [1q-daily-plus.yaml](./1q-daily-plus.yaml) |
| 하나 1Q My Cafe | 신용 | [1q-my-cafe.yaml](./1q-my-cafe.yaml) |
| 하나 1Q My Edu | 신용 | [1q-my-edu.yaml](./1q-my-edu.yaml) |
| 하나 1Q My Lunch | 신용 | [1q-my-lunch.yaml](./1q-my-lunch.yaml) |
| 하나 1Q Shopping+ | 신용 | [1q-shopping-plus.yaml](./1q-shopping-plus.yaml) |
| 하나 1Q Special Auto | 신용 | [1q-special-auto.yaml](./1q-special-auto.yaml) |
| 하나 스카이패스 아멕스 플래티늄 | 신용 | [skypass-amex-platinum.yaml](./skypass-amex-platinum.yaml) |
| 하나 트래블로그 체크카드 | 체크 | [travellog-check.yaml](./travellog-check.yaml) |
| 하나멤버스 1Q카드 ALL in | 신용 | [1q-all-in.yaml](./1q-all-in.yaml) |
| 하나멤버스 1Q카드 Living | 신용 | [1q-living.yaml](./1q-living.yaml) |
| 하나멤버스 1Q카드 Shopping | 신용 | [1q-shopping.yaml](./1q-shopping.yaml) |
| 하나카드 | 신용 | [tag1-navy.yaml](./tag1-navy.yaml) |
| 하나카드 | 신용 | [tag1-orange.yaml](./tag1-orange.yaml) |
| 하나카드 1Q Daily 기본 | 신용 | [1q-daily.yaml](./1q-daily.yaml) |
| 하나카드 1Q Special 기본 | 신용 | [1q-special.yaml](./1q-special.yaml) |
| 하나카드 1Q Special+ | 신용 | [1q-special-plus.yaml](./1q-special-plus.yaml) |
| 하나카드 Any Plus | 신용 | [any-plus.yaml](./any-plus.yaml) |
| 하나카드 CLUB Premier | 신용 | [club-premier.yaml](./club-premier.yaml) |
| 하나카드 CLUB Primus Skypass | 신용 | [club-primus-skypass.yaml](./club-primus-skypass.yaml) |
| 하나카드 CLUB SK | 신용 | [club-sk.yaml](./club-sk.yaml) |
| 하나카드 JADE Classic | 신용 | [jade-classic.yaml](./jade-classic.yaml) |
| 하나카드 JADE Prime | 신용 | [jade-prime.yaml](./jade-prime.yaml) |
| 하나카드 MULTI Any 체크카드 | 체크 | [multi-any-check.yaml](./multi-any-check.yaml) |
| 하나카드 My Trip Asiana | 신용 | [my-trip-asiana.yaml](./my-trip-asiana.yaml) |
| 하나카드 My Trip Skypass | 신용 | [my-trip-skypass.yaml](./my-trip-skypass.yaml) |
| 하나카드 VIVA G 신용 | 신용 | [viva-g.yaml](./viva-g.yaml) |
| 하나카드 VIVA G 체크카드 | 체크 | [viva-g-check.yaml](./viva-g-check.yaml) |
| 하나카드 내맘대로 T 플러스 | 신용 | [t-plus.yaml](./t-plus.yaml) |
| 하나카드 뉴 해피 | 신용 | [new-happy.yaml](./new-happy.yaml) |
| 하나카드 모두의 신세계 | 신용 | [shinseage-hana.yaml](./shinseage-hana.yaml) |
| 하나카드 몰테일 플러스 | 신용 | [malltail-plus.yaml](./malltail-plus.yaml) |
| 하나카드 미생 | 신용 | [misaeng.yaml](./misaeng.yaml) |
| 하나카드 스카이패스 체크카드 | 체크 | [skypass-check.yaml](./skypass-check.yaml) |
| 하나카드 신세계 the Mile | 신용 | [shinseage-mile.yaml](./shinseage-mile.yaml) |
| 하나카드 아모레퍼시픽 | 신용 | [amorepacific.yaml](./amorepacific.yaml) |
| 하나카드 언택트 L | 신용 | [untact-l.yaml](./untact-l.yaml) |
| 하나카드 원더카드 2.0 FREE | 신용 | [wonder-2.0-free.yaml](./wonder-2.0-free.yaml) |
| 하나카드 원더카드 2.0 HAPPY | 신용 | [wonder-2.0-happy.yaml](./wonder-2.0-happy.yaml) |
| 하나카드 원더카드 2.0 LIFE | 신용 | [wonder-2.0-life.yaml](./wonder-2.0-life.yaml) |
| 하나카드 원더카드 2.0 LIVING | 신용 | [wonder-2.0-living.yaml](./wonder-2.0-living.yaml) |
| 하나카드 원더카드 2.0 YOUNG | 신용 | [wonder-2.0-young.yaml](./wonder-2.0-young.yaml) |
| 하나카드 원더카드 2.0 베이스 | 신용 | [wonder-2.0.yaml](./wonder-2.0.yaml) |
| 하나카드 원큐 K패스 | 신용 | [k-pass-1q.yaml](./k-pass-1q.yaml) |
| 하나카드 원큐카드 | 신용 | [1q-card.yaml](./1q-card.yaml) |
| 하나카드 카카오T 신용 | 신용 | [kakao-t-credit.yaml](./kakao-t-credit.yaml) |
| 하나카드 카카오T 하나카드 | 신용 | [kakaot.yaml](./kakaot.yaml) |
| 하나카드 트래블로그 PRESTIGE | 신용 | [travellog-prestige.yaml](./travellog-prestige.yaml) |
| 하나카드 풀무원 | 신용 | [pulmuone.yaml](./pulmuone.yaml) |
<!-- END GENERATED CARD INDEX -->
