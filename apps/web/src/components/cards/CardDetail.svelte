<script lang="ts">
  import { getCardDetail } from '../../lib/api.js';
  import type { CardDetail, RewardTier } from '../../lib/api.js';
  import { formatWon, formatPercent, getCategoryEmoji, getIssuerColor, formatIssuerNameKo } from '../../lib/formatters.js';

  interface Props {
    cardId: string | undefined;
  }

  let { cardId }: Props = $props();
  let loading = $state(true);
  let error = $state<string | null>(null);
  let card = $state<CardDetail | null>(null);
  let fetchGeneration = 0;

  function rateColorClass(rate: number): string {
    const pct = rate * 100;
    if (pct >= 5) return 'text-green-600 font-semibold';
    if (pct >= 2) return 'text-blue-600 font-medium';
    return 'text-gray-500';
  }

  function formatRewardRate(tier: RewardTier): string {
    return formatPercent(tier.rate);
  }

  // Group rewards by performanceTier label
  type RewardEntry = CardDetail['rewards'][number];
  type TierRow = RewardEntry['tiers'][number];

  interface FlatRow {
    category: string;
    tier: TierRow;
    isFirstForCategory: boolean;
  }

  let groupedByPerf = $derived.by(() => {
    if (!card) return [] as { perfLabel: string; rows: FlatRow[] }[];
    const map = new Map<string, FlatRow[]>();
    for (const reward of card.rewards) {
      for (const t of reward.tiers) {
        const key = t.performanceTier ?? '기본';
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push({ category: reward.category, tier: t, isFirstForCategory: true });
      }
    }
    return Array.from(map.entries()).map(([perfLabel, rows]) => ({ perfLabel, rows }));
  });

  let globalLimit = $derived.by(() => {
    if (!card?.globalConstraints) return null;
    const gc = card.globalConstraints as Record<string, unknown>;
    if (typeof gc.monthlyTotalDiscountCap === 'number') return gc.monthlyTotalDiscountCap as number;
    return null;
  });

  $effect(() => {
    if (!cardId) { loading = false; return; }
    loading = true;
    error = null;
    const gen = ++fetchGeneration;
    getCardDetail(cardId)
      .then((result) => {
        if (gen === fetchGeneration) card = result;
      })
      .catch((e) => {
        if (gen === fetchGeneration) error = e instanceof Error ? e.message : '카드 정보 로드 실패';
      })
      .finally(() => {
        if (gen === fetchGeneration) loading = false;
      });
  });
</script>

{#if loading}
  <!-- Loading skeleton -->
  <div class="animate-pulse space-y-6">
    <div class="h-28 rounded-2xl bg-gray-200"></div>
    <div class="space-y-3 px-1">
      <div class="h-7 w-56 rounded bg-gray-200"></div>
      <div class="h-4 w-40 rounded bg-gray-200"></div>
      <div class="h-4 w-32 rounded bg-gray-200"></div>
    </div>
    <div class="h-24 rounded-xl bg-gray-200"></div>
    <div class="h-48 rounded-xl bg-gray-200"></div>
  </div>
{:else if error}
  <div class="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>
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
          <span class="text-sm font-semibold" style="color: {issuerColor};">
            {formatIssuerNameKo(card.issuer)}
          </span>
          <span
            class="rounded-full px-2.5 py-0.5 text-xs font-medium
              {card.type === 'credit' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}"
          >
            {card.type === 'credit' ? '신용카드' : '체크카드'}
          </span>
        </div>
        <h1 class="mt-1.5 text-2xl font-bold tracking-tight">{card.nameKo}</h1>
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
            <span class="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
              월 최대 할인 한도 {formatWon(globalLimit)}
            </span>
          {/if}
        </div>
        {#if card.url}
          <a
            href={card.url}
            target="_blank"
            rel="noopener noreferrer"
            class="mt-3 inline-flex items-center gap-1 text-sm hover:underline"
            style="color: {issuerColor};"
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
                <div class="text-xs font-bold text-[var(--color-primary)]">{tier.label}</div>
                <div class="mt-1 text-xs text-[var(--color-text-muted)]">
                  {formatWon(tier.minSpending)} 이상
                </div>
                {#if tier.maxSpending !== null}
                  <div class="text-xs text-[var(--color-text-muted)]">
                    {formatWon(tier.maxSpending)} 미만
                  </div>
                {/if}
              </div>
              {#if i < card.performanceTiers.length - 1}
                <div class="h-px w-4 shrink-0 bg-gray-300"></div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Rewards table grouped by performance tier -->
    {#if card.rewards.length > 0}
      <div>
        <h2 class="text-base font-semibold text-[var(--color-text)]">카테고리별 혜택</h2>
        <div class="mt-3 overflow-x-auto rounded-xl border border-[var(--color-border)]">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-[var(--color-border)] bg-gray-50/60 text-left text-xs text-[var(--color-text-muted)]">
                <th class="px-4 py-2.5 font-medium">카테고리</th>
                <th class="px-4 py-2.5 text-right font-medium">혜택률</th>
                <th class="px-4 py-2.5 text-right font-medium">월 한도</th>
                <th class="px-4 py-2.5 font-medium">적용 실적</th>
              </tr>
            </thead>
            <tbody>
              {#each groupedByPerf as group}
                <!-- Performance tier header row -->
                <tr class="border-b border-[var(--color-border)] bg-blue-50/50">
                  <td colspan="4" class="px-4 py-1.5 text-xs font-semibold text-blue-700">
                    {group.perfLabel}
                  </td>
                </tr>
                {#each group.rows as row}
                  <tr class="border-b border-[var(--color-border)] last:border-0 hover:bg-gray-50/50 transition-colors">
                    <td class="px-4 py-2.5 font-medium">
                      <span class="mr-1.5">{getCategoryEmoji(row.category)}</span>{row.category}
                    </td>
                    <td class="px-4 py-2.5 text-right font-mono {rateColorClass(row.tier.rate)}">
                      {formatRewardRate(row.tier)}
                    </td>
                    <td class="px-4 py-2.5 text-right text-[var(--color-text-muted)]">
                      {row.tier.monthlyCap !== null ? formatWon(row.tier.monthlyCap) : '한도 없음'}
                    </td>
                    <td class="px-4 py-2.5 text-[var(--color-text-muted)]">{row.tier.performanceTier}</td>
                  </tr>
                {/each}
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}

    <!-- Performance exclusions -->
    {#if card.performanceExclusions.length > 0}
      <div>
        <h2 class="text-base font-semibold text-[var(--color-text)]">실적 제외 항목</h2>
        <ul class="mt-3 space-y-1.5 rounded-xl border border-[var(--color-border)] bg-gray-50/50 p-4">
          {#each card.performanceExclusions as exclusion}
            <li class="flex items-start gap-2 text-sm text-[var(--color-text-muted)]">
              <span class="mt-0.5 shrink-0 text-gray-400">•</span>
              {exclusion}
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    <!-- Same issuer cards link -->
    <div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <p class="text-sm text-[var(--color-text-muted)]">
        같은 카드사의 다른 카드도 확인해보세요
      </p>
      <a
        href="/cards"
        class="mt-2 inline-flex items-center gap-1 text-sm font-medium hover:underline"
        style="color: {issuerColor};"
      >
        {formatIssuerNameKo(card.issuer)} 카드 전체 보기 →
      </a>
    </div>
  </div>
{:else}
  <div class="text-[var(--color-text-muted)]">카드를 찾을 수 없습니다</div>
{/if}
