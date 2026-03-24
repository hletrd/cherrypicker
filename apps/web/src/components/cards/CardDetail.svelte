<script lang="ts">
  interface Props {
    cardId: string | undefined;
  }

  let { cardId }: Props = $props();
  let loading = $state(true);
  let card = $state<Record<string, unknown> | null>(null);

  function formatWon(amount: number): string {
    return amount.toLocaleString('ko-KR') + '원';
  }

  function formatRate(rate: number): string {
    return (rate * 100).toFixed(1) + '%';
  }

  $effect(() => {
    // TODO: fetch card detail from API using cardId
    loading = false;
    card = {
      id: cardId,
      issuer: 'hyundai',
      name: 'the Green Edition2',
      nameKo: '더 그린 에디션2',
      annualFee: { domestic: 15000, international: 15000 },
      performanceTiers: [
        { label: '무실적', minSpending: 0 },
        { label: '30만원 이상', minSpending: 300000 },
        { label: '60만원 이상', minSpending: 600000 },
      ],
      rewards: [
        { category: '외식', rate: 0.01, cap: 10000, tier: '60만원 이상' },
        { category: '편의점', rate: 0.01, cap: 5000, tier: '60만원 이상' },
        { category: '대중교통', rate: 0.10, cap: 5000, tier: '30만원 이상' },
        { category: '온라인쇼핑', rate: 0.005, cap: 5000, tier: '30만원 이상' },
      ],
    };
  });
</script>

{#if loading}
  <div class="flex h-64 items-center justify-center text-[var(--color-text-muted)]">로딩 중...</div>
{:else if card}
  <div class="space-y-8">
    <div>
      <h1 class="text-3xl font-bold">{card.nameKo}</h1>
      <p class="mt-1 text-[var(--color-text-muted)]">{card.name}</p>
      <p class="mt-2 text-sm">
        연회비: 국내 {formatWon((card.annualFee as { domestic: number }).domestic)}
        / 해외 {formatWon((card.annualFee as { international: number }).international)}
      </p>
    </div>

    <div>
      <h2 class="text-lg font-semibold">전월실적 구간</h2>
      <div class="mt-3 flex gap-3">
        {#each card.performanceTiers as tier}
          <div class="rounded-lg border border-[var(--color-border)] px-4 py-3 text-center">
            <div class="text-sm font-medium">{(tier as { label: string }).label}</div>
            <div class="mt-1 text-xs text-[var(--color-text-muted)]">
              {formatWon((tier as { minSpending: number }).minSpending)} 이상
            </div>
          </div>
        {/each}
      </div>
    </div>

    <div>
      <h2 class="text-lg font-semibold">카테고리별 혜택</h2>
      <div class="mt-3 overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-[var(--color-border)] text-left text-[var(--color-text-muted)]">
              <th class="pb-2">카테고리</th>
              <th class="pb-2 text-right">혜택률</th>
              <th class="pb-2 text-right">월 한도</th>
              <th class="pb-2">필요 실적</th>
            </tr>
          </thead>
          <tbody>
            {#each card.rewards as reward}
              {@const r = reward as { category: string; rate: number; cap: number; tier: string }}
              <tr class="border-b border-[var(--color-border)] last:border-0">
                <td class="py-2 font-medium">{r.category}</td>
                <td class="py-2 text-right font-mono text-[var(--color-primary)]">{formatRate(r.rate)}</td>
                <td class="py-2 text-right">{formatWon(r.cap)}</td>
                <td class="py-2 text-[var(--color-text-muted)]">{r.tier}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </div>
{:else}
  <div class="text-[var(--color-text-muted)]">카드를 찾을 수 없습니다</div>
{/if}
