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

  function getIssuerFromCardId(cardId: string): string {
    return cardId.split('-')[0] ?? 'unknown';
  }

  let assignments = $derived(analysisStore.assignments);
</script>

{#if analysisStore.loading}
  <div class="flex h-48 items-center justify-center text-[var(--color-text-muted)]">로딩 중...</div>
{:else if assignments.length > 0}
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
          {@const issuer = getIssuerFromCardId(a.assignedCardId)}
          <tr class="border-b border-[var(--color-border)] last:border-0">
            <td class="py-3 font-medium">{a.categoryNameKo}</td>
            <td class="py-3">
              <span
                class="inline-block rounded-full px-2 py-0.5 text-xs text-white"
                style="background-color: {issuerColors[issuer] ?? '#6b7280'}"
              >
                {a.assignedCardName}
              </span>
            </td>
            <td class="py-3 text-right font-mono text-[var(--color-primary)]">{formatRate(a.rate)}</td>
            <td class="py-3 text-right font-mono">{formatWon(a.reward)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{:else}
  <div class="flex h-48 items-center justify-center text-[var(--color-text-muted)]">
    명세서를 업로드하세요
  </div>
{/if}
