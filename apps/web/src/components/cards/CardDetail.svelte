<script lang="ts">
  import { onMount } from 'svelte';
  import { getCardDetail } from '../../lib/api.js';
  import type { CardDetail, RewardTier } from '../../lib/api.js';
  import { formatWon, formatCatalogReward, getCategoryIconName, getIssuerColor, buildPageUrl } from '../../lib/formatters.js';
  import { loadCategories } from '../../lib/cards.js';
  import { buildCategoryLabelMap, FALLBACK_CATEGORY_LABELS } from '../../lib/category-labels.js';
  import {
    catalogRewardCategoryKey,
    partitionCatalogRewards,
  } from '../../lib/catalog-reward-display.js';
  import { safeExternalHref } from '../../lib/external-url.js';
  import Icon from '../ui/Icon.svelte';
  import IssuerBadge from '../ui/IssuerBadge.svelte';

  interface Props {
    cardId: string | undefined;
    onReady?: (cardName: string) => void;
  }

  let { cardId, onReady }: Props = $props();
  let loading = $state(true);
  let error = $state<string | null>(null);
  let card = $state<CardDetail | null>(null);
  let fetchGeneration = 0;
  let categoryLabels = $state<Map<string, string>>(new Map());
  let retryKey = $state(0);
  const loggedOrphanTierIds = new Set<string>();
  // Track whether category labels have been loaded (or attempted) so the
  // rewards table doesn't briefly flash raw category IDs before labels arrive (C61-04).
  let categoryLabelsReady = $state(false);

  onMount(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const nodes = await loadCategories(controller.signal);
        if (!controller.signal.aborted) {
          categoryLabels = nodes.length > 0
            ? buildCategoryLabelMap(nodes)
            : FALLBACK_CATEGORY_LABELS;
        }
      } catch {
        // Use fallback labels when categories fetch fails (C1-01). An unmount
        // abort is expected and must stay quiet.
        if (!controller.signal.aborted) {
          if (typeof console !== 'undefined') console.debug('[cherrypicker] Category labels fetch failed in CardDetail, using fallback');
          categoryLabels = FALLBACK_CATEGORY_LABELS;
        }
      }
      if (!controller.signal.aborted) {
        categoryLabelsReady = true;
      }
    })();
    return () => controller.abort();
  });

  function rateColorClass(rate: number | null): string {
    if (rate !== null && rate >= 5) return 'text-green-700 dark:text-green-300 font-semibold';
    if (rate !== null && rate >= 2) return 'text-[var(--color-primary-fg)] font-medium';
    return 'text-[var(--color-text-muted)]';
  }

  function formatRewardRate(tier: RewardTier): string {
    return formatCatalogReward(tier);
  }

  function focusDetailHeading(node: HTMLElement) {
    node.focus();
  }

  function logOrphanPerformanceTiers(detail: CardDetail) {
    const tierIds = new Set(detail.performanceTiers.map(tier => tier.id));
    for (const reward of detail.rewards) {
      for (const tier of reward.tiers) {
        if (tier.performanceTier
          && !tierIds.has(tier.performanceTier)
          && !loggedOrphanTierIds.has(tier.performanceTier)) {
          loggedOrphanTierIds.add(tier.performanceTier);
          console.warn(`[cherrypicker] Unknown performance tier: ${tier.performanceTier}`);
        }
      }
    }
  }

  // Group rewards by performanceTier label
  type RewardEntry = CardDetail['rewards'][number];
  type TierRow = RewardEntry['tiers'][number];

  interface FlatRow {
    category: string;
    tier: TierRow;
  }

  let rewardGroups = $derived(
    partitionCatalogRewards(card?.rewards ?? []),
  );
  let supportedRewards = $derived(rewardGroups.supported);
  let unsupportedRewards = $derived(rewardGroups.unsupported);

  let groupedByPerf = $derived.by(() => {
    if (!card) return [] as { perfLabel: string; rows: FlatRow[] }[];
    const tierLabels = new Map(card.performanceTiers.map(tier => [tier.id, tier.label]));
    const map = new Map<string, FlatRow[]>();
    for (const reward of supportedRewards) {
      for (const t of reward.tiers) {
        let key = '기본';
        if (t.performanceTier) {
          key = tierLabels.get(t.performanceTier) ?? '실적 조건 확인 필요';
        }
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push({
          category: catalogRewardCategoryKey(reward),
          tier: t,
        });
      }
    }
    return Array.from(map.entries()).map(([perfLabel, rows]) => ({ perfLabel, rows }));
  });

  let globalLimit = $derived.by(() => {
    if (!card?.globalConstraints) return null;
    return card.globalConstraints.monthlyTotalDiscountCap;
  });
  let officialCardUrl = $derived(safeExternalHref(card?.url));

  $effect(() => {
    const retryAttempt = retryKey;
    void retryAttempt;
    if (!cardId) {
      loading = false;
      error = null;
      card = null;
      return;
    }
    loading = true;
    error = null;
    card = null;
    const gen = ++fetchGeneration;
    const controller = new AbortController();
    getCardDetail(cardId, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted && gen === fetchGeneration) {
          if (!result) throw new Error('카드를 찾을 수 없어요');
          logOrphanPerformanceTiers(result);
          card = result;
          onReady?.(result.nameKo);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted && gen === fetchGeneration) {
          error = e instanceof Error && e.name !== 'AbortError' ? e.message : '카드 정보를 불러올 수 없어요';
        }
      })
      .finally(() => {
        if (!controller.signal.aborted && gen === fetchGeneration) loading = false;
      });
    return () => { controller.abort(); };
  });
</script>

<div aria-busy={loading}>
{#if loading}
  <p class="sr-only" role="status">카드 정보를 불러오는 중이에요</p>
  <div class="animate-pulse space-y-6" aria-hidden="true">
    <div class="h-28 rounded-2xl bg-[var(--color-border)]"></div>
    <div class="space-y-3 px-1">
      <div class="h-7 w-56 rounded bg-[var(--color-border)]"></div>
      <div class="h-4 w-40 rounded bg-[var(--color-border)]"></div>
      <div class="h-4 w-32 rounded bg-[var(--color-border)]"></div>
    </div>
    <div class="h-24 rounded-xl bg-[var(--color-border)]"></div>
    <div class="h-48 rounded-xl bg-[var(--color-border)]"></div>
  </div>
{:else if error}
  <div class="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200" role="alert">
    <p>{error}</p>
    <button
      type="button"
      class="mt-3 rounded-lg bg-[var(--color-primary-fill)] px-3 py-2 font-semibold text-white hover:bg-[var(--color-primary-fill-hover)]"
      onclick={() => (retryKey += 1)}
    >다시 시도</button>
  </div>
{:else if card}
  {@const issuerColor = getIssuerColor(card.issuer)}
  <div class="space-y-8">

    <!-- Issuer-colored header banner -->
    <div
      class="relative overflow-hidden rounded-2xl p-6"
      style="background: linear-gradient(135deg, {issuerColor}22 0%, {issuerColor}08 60%, transparent 100%); border: 1px solid {issuerColor}33;"
    >
      <div
        class="absolute left-0 top-0 h-full w-1.5 rounded-l-2xl"
        style="background-color: {issuerColor};"
      ></div>
      <div class="pl-2">
        <div class="flex items-center gap-2">
          <IssuerBadge issuer={card.issuer} />
          <span
            class="rounded-full px-2.5 py-0.5 text-xs font-medium
              {card.type === 'credit'
                ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-400'
                : card.type === 'check'
                  ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-400'
                  : 'bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-400'}"
          >
            {card.type === 'credit' ? '신용카드' : card.type === 'check' ? '체크카드' : '선불카드'}
          </span>
        </div>
        <h1
          class="mt-1.5 text-2xl font-bold tracking-tight"
          data-testid="card-detail-heading"
          tabindex="-1"
          use:focusDetailHeading
        >{card.nameKo}</h1>
        <p class="mt-0.5 text-sm text-[var(--color-text-muted)]">{card.name}</p>
        <div class="mt-3 flex flex-wrap items-center gap-4 text-sm">
          <span>
            국내 연회비
            <span class="ml-1 font-semibold">
              {card.annualFee.domestic === 0 ? '없음' : formatWon(card.annualFee.domestic)}
            </span>
          </span>
          {#if card.annualFee.international > 0}
            <span>
              해외 연회비
              <span class="ml-1 font-semibold">{formatWon(card.annualFee.international)}</span>
            </span>
          {/if}
          {#if globalLimit !== null}
            <span class="rounded-full bg-amber-100 dark:bg-amber-900 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
              월 최대 할인 한도 {formatWon(globalLimit)}
            </span>
          {/if}
        </div>
        {#if officialCardUrl}
          <a
            href={officialCardUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--color-primary-fg)] hover:underline"
          >
            공식 카드 페이지
            <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        {/if}
      </div>
    </div>

    <!-- Performance tiers: connected steps -->
    {#if card.performanceTiers.length > 0}
      <div>
        <h2 class="text-base font-semibold text-[var(--color-text)]">전월실적 구간</h2>
        <div class="mt-3 flex flex-wrap items-stretch gap-0">
          {#each card.performanceTiers as tier, i}
            <div class="flex items-center">
              <div class="flex flex-col items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-center shadow-sm min-w-[100px]">
                <div class="text-xs font-bold text-[var(--color-primary-fg)]">{tier.label}</div>
                <div class="mt-1 text-xs text-[var(--color-text-muted)]">
                  {formatWon(tier.minSpending)} 이상
                </div>
                {#if tier.maxSpending !== null}
                  <div class="text-xs text-[var(--color-text-muted)]">
                    {formatWon(tier.maxSpending)} 이하
                  </div>
                {/if}
              </div>
              {#if i < card.performanceTiers.length - 1}
                <div class="h-px w-4 shrink-0 bg-[var(--color-border)]"></div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Rewards table grouped by performance tier -->
    {#if supportedRewards.length > 0 && categoryLabelsReady}
      <div data-testid="supported-reward-table">
        <h2 class="text-base font-semibold text-[var(--color-text)]">카테고리별 혜택</h2>
        <p id="card-rewards-scroll-hint" class="print-scroll-hint mt-2 text-xs text-[var(--color-text-muted)] md:hidden">
          표를 좌우로 스크롤할 수 있어요
        </p>
        <div
          data-testid="card-rewards-scroll-region"
          class="mt-2 overflow-x-auto rounded-xl border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] sm:mt-3"
          role="region"
          aria-label="카테고리별 카드 혜택 표"
          tabindex="0"
        >
          <table class="min-w-[640px] w-full text-sm">
            <thead>
              <tr class="border-b border-[var(--color-border)] bg-[var(--color-bg)] text-left text-xs text-[var(--color-text-muted)]">
                <th scope="col" class="px-4 py-2.5 font-medium">카테고리</th>
                <th scope="col" class="px-4 py-2.5 text-right font-medium">혜택</th>
                <th scope="col" class="px-4 py-2.5 text-right font-medium">월 한도</th>
                <th scope="col" class="px-4 py-2.5 font-medium">적용 실적</th>
              </tr>
            </thead>
            <tbody>
              {#each groupedByPerf as group}
                <!-- Performance tier header row -->
                <tr class="border-b border-[var(--color-border)] bg-blue-50 dark:bg-blue-900/50">
                  <td colspan="4" class="px-4 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
                    {group.perfLabel}
                  </td>
                </tr>
                {#each group.rows as row}
                  <tr class="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg)] transition-colors">
                    <td class="px-4 py-2.5 font-medium">
                      <span class="mr-1.5 inline-flex items-center text-[var(--color-text-muted)]">
                        <Icon name={getCategoryIconName(row.category)} size={14} />
                      </span>{categoryLabels.get(row.category) ?? row.category}
                    </td>
                    <td class="px-4 py-2.5 text-right font-mono {rateColorClass(row.tier.rate)}">
                      {formatRewardRate(row.tier)}
                    </td>
                    <td class="px-4 py-2.5 text-right text-[var(--color-text-muted)]">
                      {row.tier.monthlyCap !== null ? formatWon(row.tier.monthlyCap) : '무제한'}
                    </td>
                    <td class="px-4 py-2.5 text-[var(--color-text-muted)]">{group.perfLabel}</td>
                  </tr>
                {/each}
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}

    {#if unsupportedRewards.length > 0 && categoryLabelsReady}
      <section
        class="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
        aria-labelledby="unsupported-catalog-rewards-heading"
        data-testid="unsupported-reward-disclosure"
      >
        <h2 id="unsupported-catalog-rewards-heading" class="font-semibold">
          조건 확인이 필요한 혜택
        </h2>
        <p class="mt-1 text-xs">
          명세서만으로 적용 조건을 확인할 수 없어 아래 항목은 확정 혜택표와
          추천 계산에서 제외했어요.
        </p>
        <ul class="mt-3 space-y-2">
          {#each unsupportedRewards as reward}
            {@const categoryKey = catalogRewardCategoryKey(reward)}
            <li
              class="rounded-lg border border-amber-200 bg-white/60 px-3 py-2 dark:border-amber-800 dark:bg-black/10"
              data-testid="unsupported-reward-item"
            >
              <div class="font-medium">
                {reward.label ?? categoryLabels.get(categoryKey) ?? categoryKey}
              </div>
              {#if reward.label}
                <div class="mt-0.5 text-xs opacity-80">
                  {categoryLabels.get(categoryKey) ?? categoryKey}
                </div>
              {/if}
              <div class="mt-1 text-xs opacity-80">
                적용 조건을 자동으로 확인할 수 없어요.
              </div>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <!-- Performance exclusions -->
    {#if card.performanceExclusions.length > 0}
      <div>
        <h2 class="text-base font-semibold text-[var(--color-text)]">실적 제외 항목</h2>
        <ul class="mt-3 space-y-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          {#each card.performanceExclusions as exclusion}
            <li class="flex items-start gap-2 text-sm text-[var(--color-text-muted)]">
              <span class="mt-0.5 shrink-0 text-[var(--color-text-muted)]">•</span>
              {exclusion}
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    <!-- Same issuer cards link -->
    <div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <p class="text-sm text-[var(--color-text-muted)]">
        같은 카드사의 다른 카드
      </p>
      <button
        type="button"
        class="mt-2 inline-flex items-center gap-1 text-sm font-medium text-[var(--color-primary-fg)] hover:underline cursor-pointer"
        onclick={async () => {
          // Use Astro client-side navigation to preserve in-memory store
          // state instead of a full page reload (C62-15). Fall back to
          // full reload if View Transitions are not enabled.
          try {
            const { navigate } = await import('astro:transitions/client');
            navigate(buildPageUrl('cards'));
          } catch {
            if (typeof console !== 'undefined') console.debug('[cherrypicker] Astro View Transitions not available in CardDetail, falling back to full page reload');
            window.location.href = buildPageUrl('cards');
          }
        }}
      >
        카드 목록으로 돌아가기
      </button>
    </div>
  </div>
{:else}
  <div class="text-[var(--color-text-muted)]">카드를 찾을 수 없어요</div>
{/if}
</div>
