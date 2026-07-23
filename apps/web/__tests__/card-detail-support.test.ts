import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import {
  catalogRewardCategoryKey,
  partitionCatalogRewards,
} from '../src/lib/catalog-reward-display.js';
import {
  ADDITIONAL_CONDITIONS_DISCLOSURE,
  PERFORMANCE_EXCLUSION_LABELS,
  buildSupportedRewardPresentation,
  buildIssuerCatalogUrl,
  formatPerformanceExclusion,
  formatRewardConditionsKo,
} from '../src/lib/card-detail-display.js';

describe('catalog reward display boundary', () => {
  test('keeps unsupported rewards for disclosure but out of the exact table', () => {
    const supported = {
      id: 'supported',
      category: 'dining',
      subcategory: 'cafe',
      support: { status: 'supported' as const },
    };
    const unsupported = {
      id: 'unsupported',
      category: 'travel',
      support: {
        status: 'unsupported' as const,
        reason: 'missing statement fact',
      },
    };

    const groups = partitionCatalogRewards([unsupported, supported]);

    expect(groups.supported).toEqual([supported]);
    expect(groups.unsupported).toEqual([unsupported]);
    expect(catalogRewardCategoryKey(supported)).toBe('dining.cafe');
    expect(catalogRewardCategoryKey(unsupported)).toBe('travel');
  });

  test('wires the supported table and unsupported disclosure separately', async () => {
    const source = await readFile(
      new URL(
        '../src/components/cards/CardDetail.svelte',
        import.meta.url,
      ),
      'utf8',
    );

    expect(source).toContain('for (const reward of supportedRewards)');
    expect(source).toContain('data-testid="supported-reward-table"');
    expect(source).toContain('data-testid="supported-reward-identity"');
    expect(source).toContain('data-reward-id={row.rewardId}');
    expect(source).toContain('{row.rewardLabel}');
    expect(source).toContain('{#each row.conditionLabels as condition}');
    expect(source).toContain('data-testid="unsupported-reward-disclosure"');
    expect(source).toContain('data-testid="unsupported-reward-item"');
    expect(source).toContain('{#each unsupportedRewards as reward}');
    expect(source).toContain('{formatWon(tier.maxSpending)} 이하');
    expect(source).not.toContain('{formatWon(tier.maxSpending)} 미만');
    expect(source).toContain('data-testid="card-detail-heading"');
    expect(source).toContain('tabindex="-1"');
    expect(source).toContain('use:focusDetailHeading');
    expect(source).toContain('node.focus()');
  });

  test('formats every supported eligibility field and discloses unknown conditions', () => {
    expect(formatRewardConditionsKo({
      minTransaction: 10_000,
      maxTransaction: 50_000,
      specificMerchants: ['배달의민족', '쿠팡이츠'],
      weekdays: [1, 5],
      maxUses: 2,
      usePeriod: 'month',
      channel: 'online',
      paymentType: 'domestic',
      note: '간편결제 제외',
    })).toEqual([
      '대상 가맹점: 배달의민족, 쿠팡이츠',
      '건당 최소 이용금액: 10,000원',
      '건당 최대 이용금액: 50,000원',
      '적용 요일: 월요일, 금요일',
      '결제 채널: 온라인',
      '결제 지역: 국내',
      '이용 횟수: 월 2회까지',
      '추가 안내: 간편결제 제외',
    ]);

    expect(formatRewardConditionsKo({
      futureEligibility: { membership: 'premium' },
    })).toEqual([ADDITIONAL_CONDITIONS_DISCLOSURE]);
    expect(formatRewardConditionsKo({
      weekdays: [0, 2, 6],
      maxUses: 1,
      usePeriod: 'day',
      channel: 'offline',
      paymentType: 'overseas',
    })).toEqual([
      '적용 요일: 일요일, 화요일, 토요일',
      '결제 채널: 오프라인',
      '결제 지역: 해외',
      '이용 횟수: 일 1회까지',
    ]);
    expect(formatRewardConditionsKo({
      maxUses: 2,
    })).toEqual([ADDITIONAL_CONDITIONS_DISCLOSURE]);
    expect(formatRewardConditionsKo(undefined)).toEqual([]);
  });

  test('keeps production LOCA LIKIT Eat benefits distinct with merchant scope', async () => {
    const artifact = JSON.parse(
      await readFile(
        new URL('../public/data/card-details/lotte.json', import.meta.url),
        'utf8',
      ),
    ) as {
      cards: Array<{
        card: { id: string };
        rewards: Parameters<typeof buildSupportedRewardPresentation>[0][];
      }>;
    };
    const card = artifact.cards.find(
      ({ card: meta }) => meta.id === 'lotte-likit-eat',
    );
    expect(card).toBeDefined();

    const presentations = card!.rewards.map(
      buildSupportedRewardPresentation,
    );
    expect(presentations).toEqual([
      {
        rewardId: 'reward-001',
        rewardLabel: '음식점 60% 결제일 할인',
        category: 'dining',
        conditionLabels: ['대상 가맹점: 음식점'],
      },
      {
        rewardId: 'reward-002',
        rewardLabel: '배달앱 60% 결제일 할인',
        category: 'dining',
        conditionLabels: [
          '대상 가맹점: 배달의민족, 쿠팡이츠, 요기요',
        ],
      },
      {
        rewardId: 'reward-003',
        rewardLabel: '카페 60% 결제일 할인',
        category: 'dining',
        conditionLabels: [
          '대상 가맹점: 스타벅스, 투썸플레이스, 할리스커피, 폴바셋',
        ],
      },
    ]);
  });

  test('names grid category counts and sorting as benefit areas', async () => {
    const source = await readFile(
      new URL('../src/components/cards/CardGrid.svelte', import.meta.url),
      'utf8',
    );

    expect(source).toContain(
      '<option value="rewards">혜택 분야 많은순</option>',
    );
    expect(source).toContain(
      '{card.rewardCategories.length}개 혜택 분야',
    );
    expect(source).not.toContain('>혜택 많은순</option>');
    expect(source).not.toContain(
      '{card.rewardCategories.length}개 혜택\n',
    );
  });

  test('moves focus into detail and restores the originating card with Korean navigation copy', async () => {
    const [pageSource, gridSource] = await Promise.all([
      readFile(
        new URL('../src/components/cards/CardPage.svelte', import.meta.url),
        'utf8',
      ),
      readFile(
        new URL('../src/components/cards/CardGrid.svelte', import.meta.url),
        'utf8',
      ),
    ]);

    expect(pageSource).toContain('aria-label="이동 경로"');
    expect(pageSource).toContain('onReady={handleDetailReady}');
    expect(pageSource).toContain('focusCardId={returnFocusCardId}');
    expect(pageSource).toContain('onFocusRestored={handleFocusRestored}');
    expect(pageSource).toContain('document.title = `${name} | CherryPicker`');
    expect(pageSource).toContain('resolveCardSelectionQuery');
    expect(pageSource).toContain('pushCardSelectionHistory');
    expect(pageSource).toContain(
      "window.addEventListener('popstate', handlePopState)",
    );
    expect(pageSource).not.toContain("window.addEventListener('hashchange'");
    expect(pageSource).not.toContain('window.location.hash =');
    expect(pageSource).not.toContain(
      "document.querySelector<HTMLElement>('[data-testid=\"card-detail-heading\"]')?.focus()",
    );
    expect(gridSource).toContain('data-card-id={card.id}');
    expect(gridSource).toContain('use:restoreCardFocus={card.id}');
    expect(gridSource).toContain('node.focus()');
    expect(gridSource).toContain('onFocusRestored?.()');
  });
});

describe('card detail labels and issuer navigation', () => {
  test('localizes every shipped exclusion and humanizes future identifiers', async () => {
    const catalog = JSON.parse(
      await readFile(
        new URL('../public/data/cards-optimizer.json', import.meta.url),
        'utf8',
      ),
    ) as {
      cards: { performanceExclusions: string[] }[];
    };
    const shippedExclusions = new Set(
      catalog.cards.flatMap(card => card.performanceExclusions),
    );

    for (const exclusion of shippedExclusions) {
      expect(PERFORMANCE_EXCLUSION_LABELS[exclusion]).toBeTruthy();
      expect(formatPerformanceExclusion(exclusion)).not.toContain('_');
    }
    expect(formatPerformanceExclusion('future_program-fee')).toBe(
      'future program fee',
    );
    expect(formatPerformanceExclusion('   ')).toBe('기타 실적 제외 항목');
  });

  test('preserves and safely encodes the issuer catalog query', async () => {
    const target = new URL(
      buildIssuerCatalogUrl('신한 & 공동', '/cards'),
      'https://example.test',
    );
    expect(target.pathname).toBe('/cards');
    expect(target.searchParams.get('issuer')).toBe('신한 & 공동');

    const source = await readFile(
      new URL('../src/components/cards/CardDetail.svelte', import.meta.url),
      'utf8',
    );
    expect(source).toContain('buildIssuerCatalogUrl(issuer)');
    expect(source).toContain('onclick={() => openIssuerCatalog(card.issuer)}');
    expect(source).toContain('data-testid="same-issuer-cards"');
  });

  test('labels discontinued details as unavailable for new issuance', async () => {
    const source = await readFile(
      new URL('../src/components/cards/CardDetail.svelte', import.meta.url),
      'utf8',
    );
    expect(source).toContain('{#if card.discontinued}');
    expect(source).toContain(
      'data-testid="card-detail-discontinued-badge"',
    );
    expect(source).toContain('단종 · 신규 발급 불가');
  });
});
