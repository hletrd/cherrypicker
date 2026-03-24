<script lang="ts">
  interface Assignment {
    category: string;
    categoryNameKo: string;
    cardName: string;
    cardIssuer: string;
    rate: number;
    monthlyReward: number;
  }

  let assignments = $state<Assignment[]>([]);
  let loading = $state(true);

  function formatWon(amount: number): string {
    return amount.toLocaleString('ko-KR') + '원';
  }

  function formatRate(rate: number): string {
    return (rate * 100).toFixed(1) + '%';
  }

  const issuerColors: Record<string, string> = {
    hyundai: '#1a1a1a',
    kb: '#ffb800',
    samsung: '#1428a0',
    shinhan: '#0046ff',
    lotte: '#ed1c24',
    hana: '#009490',
    woori: '#0066b3',
    ibk: '#004ea2',
    nh: '#03674b',
    bc: '#f04e3e',
  };

  $effect(() => {
    // TODO: fetch from optimizer API
    loading = false;
    assignments = [
      { category: 'dining', categoryNameKo: '외식', cardName: 'the Green Edition2', cardIssuer: 'hyundai', rate: 0.01, monthlyReward: 5200 },
      { category: 'grocery', categoryNameKo: '식료품', cardName: 'KB Pay', cardIssuer: 'kb', rate: 0.015, monthlyReward: 5700 },
      { category: 'online_shopping', categoryNameKo: '온라인쇼핑', cardName: 'taptap O', cardIssuer: 'samsung', rate: 0.02, monthlyReward: 6200 },
      { category: 'public_transit', categoryNameKo: '대중교통', cardName: 'the Green Edition2', cardIssuer: 'hyundai', rate: 0.10, monthlyReward: 5000 },
      { category: 'convenience_store', categoryNameKo: '편의점', cardName: 'Deep Dream', cardIssuer: 'shinhan', rate: 0.01, monthlyReward: 1200 },
    ];
  });
</script>

{#if loading}
  <div class="flex h-48 items-center justify-center text-[var(--color-text-muted)]">로딩 중...</div>
{:else}
  <div class="mt-4 overflow-x-auto">
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-[var(--color-border)] text-left text-[var(--color-text-muted)]">
          <th class="pb-3 font-medium">카테고리</th>
          <th class="pb-3 font-medium">추천 카드</th>
          <th class="pb-3 text-right font-medium">혜택률</th>
          <th class="pb-3 text-right font-medium">월 예상 혜택</th>
        </tr>
      </thead>
      <tbody>
        {#each assignments as a}
          <tr class="border-b border-[var(--color-border)] last:border-0">
            <td class="py-3 font-medium">{a.categoryNameKo}</td>
            <td class="py-3">
              <span
                class="inline-block rounded-full px-2 py-0.5 text-xs text-white"
                style="background-color: {issuerColors[a.cardIssuer] ?? '#6b7280'}"
              >
                {a.cardName}
              </span>
            </td>
            <td class="py-3 text-right font-mono text-[var(--color-primary)]">{formatRate(a.rate)}</td>
            <td class="py-3 text-right font-mono">{formatWon(a.monthlyReward)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
