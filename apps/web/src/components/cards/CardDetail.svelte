<script lang="ts">
  import { getCardDetail } from '../../lib/api.js';
  import type { CardDetail } from '../../lib/api.js';

  interface Props {
    cardId: string | undefined;
  }

  let { cardId }: Props = $props();
  let loading = $state(true);
  let error = $state<string | null>(null);
  let card = $state<CardDetail | null>(null);

  function formatWon(amount: number): string {
    return amount.toLocaleString('ko-KR') + '원';
  }

  function formatRate(rate: number): string {
    return rate.toFixed(1) + '%';
  }

  $effect(() => {
    if (!cardId) {
      loading = false;
      return;
    }
    loading = true;
    error = null;
    getCardDetail(cardId)
      .then((result) => {
        card = result;
      })
      .catch((e) => {
        error = e instanceof Error ? e.message : '카드 정보 로드 실패';
      })
      .finally(() => {
        loading = false;
      });
  });
</script>

{#if loading}
  <div class="flex h-64 items-center justify-center text-[var(--color-text-muted)]">로딩 중...</div>
{:else if error}
  <div class="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
{:else if card}
  <div class="space-y-8">
    <div>
      <h1 class="text-3xl font-bold">{card.nameKo}</h1>
      <p class="mt-1 text-[var(--color-text-muted)]">{card.name}</p>
      <p class="mt-2 text-sm">
        연회비: 국내 {formatWon(card.annualFee.domestic)}
        / 해외 {formatWon(card.annualFee.international)}
      </p>
      {#if card.url}
        <a
          href={card.url}
          target="_blank"
          rel="noopener noreferrer"
          class="mt-2 inline-block text-sm text-[var(--color-primary)] hover:underline"
        >
          공식 카드 페이지 →
        </a>
      {/if}
    </div>

    {#if card.performanceTiers.length > 0}
      <div>
        <h2 class="text-lg font-semibold">전월실적 구간</h2>
        <div class="mt-3 flex flex-wrap gap-3">
          {#each card.performanceTiers as tier}
            <div class="rounded-lg border border-[var(--color-border)] px-4 py-3 text-center">
              <div class="text-sm font-medium">{tier.label}</div>
              <div class="mt-1 text-xs text-[var(--color-text-muted)]">
                {formatWon(tier.minSpending)} 이상
                {#if tier.maxSpending !== null}
                  ~ {formatWon(tier.maxSpending)} 미만
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if card.rewards.length > 0}
      <div>
        <h2 class="text-lg font-semibold">카테고리별 혜택</h2>
        <div class="mt-3 overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-[var(--color-border)] text-left text-[var(--color-text-muted)]">
                <th class="pb-2">카테고리</th>
                <th class="pb-2 text-right">혜택률</th>
                <th class="pb-2 text-right">월 한도</th>
                <th class="pb-2">적용 실적</th>
              </tr>
            </thead>
            <tbody>
              {#each card.rewards as reward}
                {#each reward.tiers as tier}
                  <tr class="border-b border-[var(--color-border)] last:border-0">
                    <td class="py-2 font-medium">{reward.category}</td>
                    <td class="py-2 text-right font-mono text-[var(--color-primary)]">
                      {formatRate(tier.rate)}
                    </td>
                    <td class="py-2 text-right">
                      {tier.monthlyCap !== null ? formatWon(tier.monthlyCap) : '한도 없음'}
                    </td>
                    <td class="py-2 text-[var(--color-text-muted)]">{tier.performanceTier}</td>
                  </tr>
                {/each}
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}

    {#if card.performanceExclusions.length > 0}
      <div>
        <h2 class="text-lg font-semibold">실적 제외 항목</h2>
        <ul class="mt-3 space-y-1">
          {#each card.performanceExclusions as exclusion}
            <li class="text-sm text-[var(--color-text-muted)]">• {exclusion}</li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>
{:else}
  <div class="text-[var(--color-text-muted)]">카드를 찾을 수 없습니다</div>
{/if}
