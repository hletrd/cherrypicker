<script lang="ts">
  import { analysisStore } from '../../lib/store.svelte.js';

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

  const issuerNamesKo: Record<string, string> = {
    hyundai: '현대카드',
    kb: 'KB국민카드',
    samsung: '삼성카드',
    shinhan: '신한카드',
    lotte: '롯데카드',
    hana: '하나카드',
    woori: '우리카드',
    ibk: 'IBK기업은행',
    nh: 'NH농협카드',
    bc: 'BC카드',
  };

  function getIssuerFromCardId(cardId: string): string {
    return cardId.split('-')[0] ?? 'unknown';
  }

  type SortKey = 'spending' | 'rate' | 'reward';

  let assignments = $derived(analysisStore.assignments);
  let expandedRows = $state<Set<string>>(new Set());
  let sortKey = $state<SortKey>('spending');

  let uniqueCardCount = $derived.by(() => {
    const ids = new Set(assignments.map((a) => a.assignedCardId));
    return ids.size;
  });

  let maxRate = $derived.by(() => {
    if (!assignments.length) return 1;
    return Math.max(...assignments.map((a) => a.rate), 0.001);
  });

  let sortedAssignments = $derived.by(() => {
    return [...assignments].sort((a, b) => {
      if (sortKey === 'spending') return b.spending - a.spending;
      if (sortKey === 'rate') return b.rate - a.rate;
      if (sortKey === 'reward') return b.reward - a.reward;
      return 0;
    });
  });

  function toggleRow(category: string) {
    const next = new Set(expandedRows);
    if (next.has(category)) {
      next.delete(category);
    } else {
      next.add(category);
    }
    expandedRows = next;
  }
</script>

{#if analysisStore.loading}
  <div class="mt-4 space-y-3">
    {#each Array(5) as _}
      <div class="animate-pulse flex items-center gap-3 rounded-lg border border-gray-100 p-3">
        <div class="h-4 w-24 rounded bg-gray-200"></div>
        <div class="h-6 w-28 rounded-full bg-gray-200"></div>
        <div class="ml-auto h-4 w-12 rounded bg-gray-200"></div>
        <div class="h-4 w-20 rounded bg-gray-200"></div>
      </div>
    {/each}
  </div>
{:else if assignments.length > 0}
  <!-- Summary header -->
  <div class="mt-4 mb-3 flex items-center justify-between">
    <div class="text-sm text-[var(--color-text-muted)]">
      총 <strong class="text-[var(--color-text)]">{uniqueCardCount}장</strong>의 카드로 최적 혜택
    </div>
    <!-- Sort controls -->
    <div class="flex items-center gap-1 text-xs">
      <span class="text-[var(--color-text-muted)] mr-1">정렬:</span>
      {#each ([['spending', '지출순'], ['rate', '혜택률순'], ['reward', '혜택액순']] as const) as [key, label]}
        <button
          class="rounded px-2 py-0.5 transition-colors {sortKey === key ? 'bg-[var(--color-primary)] text-white' : 'bg-gray-100 text-[var(--color-text-muted)] hover:bg-gray-200'}"
          onclick={() => (sortKey = key)}
        >
          {label}
        </button>
      {/each}
    </div>
  </div>

  <div class="overflow-x-auto">
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-[var(--color-border)] text-left text-[var(--color-text-muted)]">
          <th class="pb-3 font-medium">카테고리</th>
          <th class="pb-3 font-medium">추천 카드</th>
          <th class="pb-3 font-medium">혜택 유형</th>
          <th class="pb-3 text-right font-medium">혜택률</th>
          <th class="pb-3 text-right font-medium">월 예상 혜택</th>
          <th class="pb-3 w-6"></th>
        </tr>
      </thead>
      <tbody>
        {#each sortedAssignments as a}
          {@const issuer = getIssuerFromCardId(a.assignedCardId)}
          {@const issuerColor = issuerColors[issuer] ?? '#6b7280'}
          {@const issuerName = issuerNamesKo[issuer] ?? issuer}
          {@const isExpanded = expandedRows.has(a.category)}
          {@const rateBarWidth = Math.round((a.rate / maxRate) * 100)}
          <tr
            class="border-b border-[var(--color-border)] last:border-0 hover:bg-gray-50 transition-colors cursor-pointer"
            onclick={() => toggleRow(a.category)}
          >
            <!-- Left border accent by issuer color -->
            <td class="py-3 font-medium" style="border-left: 3px solid {issuerColor}; padding-left: 8px;">
              {a.categoryNameKo}
            </td>
            <td class="py-3">
              <div class="flex flex-col gap-0.5">
                <span
                  class="inline-block rounded-full px-2 py-0.5 text-xs text-white w-fit"
                  style="background-color: {issuerColor}"
                >
                  {a.assignedCardName}
                </span>
                <span class="text-xs text-[var(--color-text-muted)]">{issuerName}</span>
              </div>
            </td>
            <td class="py-3">
              {#if a.rate > 0}
                <span class="text-base" title="할인/캐시백">💸</span>
              {:else}
                <span class="text-base" title="포인트">🎯</span>
              {/if}
            </td>
            <td class="py-3 text-right">
              <div class="flex flex-col items-end gap-1">
                <span class="font-mono font-semibold text-[var(--color-primary)]">{formatRate(a.rate)}</span>
                <div class="h-1.5 w-20 overflow-hidden rounded-full bg-gray-100">
                  <div
                    class="h-full rounded-full bg-[var(--color-primary)] transition-all duration-500"
                    style="width: {rateBarWidth}%; opacity: 0.7"
                  ></div>
                </div>
              </div>
            </td>
            <td class="py-3 text-right font-mono">{formatWon(a.reward)}</td>
            <td class="py-3 text-center text-[var(--color-text-muted)]">
              <span class="text-xs transition-transform duration-200 inline-block {isExpanded ? 'rotate-180' : ''}">▼</span>
            </td>
          </tr>

          <!-- Expanded alternatives row -->
          {#if isExpanded && a.alternatives && a.alternatives.length > 0}
            <tr class="border-b border-[var(--color-border)] last:border-0 bg-gray-50">
              <td colspan="6" class="px-6 py-3">
                <div class="text-xs text-[var(--color-text-muted)] mb-2 font-medium">대안 카드</div>
                <div class="flex flex-wrap gap-2">
                  {#each a.alternatives as alt}
                    {@const altIssuer = getIssuerFromCardId(alt.cardId)}
                    {@const altColor = issuerColors[altIssuer] ?? '#6b7280'}
                    <div class="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-xs">
                      <span
                        class="inline-block h-2 w-2 rounded-full"
                        style="background-color: {altColor}"
                      ></span>
                      <span class="font-medium">{alt.cardName}</span>
                      <span class="text-[var(--color-text-muted)]">·</span>
                      <span class="text-[var(--color-primary)]">{formatRate(alt.rate)}</span>
                    </div>
                  {/each}
                </div>
              </td>
            </tr>
          {:else if isExpanded}
            <tr class="border-b border-[var(--color-border)] last:border-0 bg-gray-50">
              <td colspan="6" class="px-6 py-3 text-xs text-[var(--color-text-muted)]">대안 카드 없음</td>
            </tr>
          {/if}
        {/each}
      </tbody>
    </table>
  </div>
{:else}
  <div class="mt-4 flex h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--color-border)]">
    <div class="text-4xl opacity-40">🗂️</div>
    <div class="text-sm font-medium text-[var(--color-text-muted)]">카드 추천 데이터가 없습니다</div>
    <div class="text-xs text-[var(--color-text-muted)]">명세서를 업로드하면 카테고리별 최적 카드가 표시됩니다</div>
  </div>
{/if}
