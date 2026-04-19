<script lang="ts">
  import { analysisStore } from '../../lib/store.svelte.js';
  import { formatWon, formatRate, getIssuerColor, formatIssuerNameKo, getIssuerFromCardId } from '../../lib/formatters.js';
  import Icon from '../ui/Icon.svelte';

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
    const computed = assignments.reduce((max, a) => Math.max(max, a.rate), 0);
    // Guard against division by zero in bar width calculation; use a small
    // epsilon proportional to typical rate magnitudes rather than a fixed 0.001
    // to avoid inflating bars when all rates are very small (< 0.1%).
    return computed > 0 ? computed : 0.0001;
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
      총 <strong class="text-[var(--color-text)]">{uniqueCardCount}장</strong>의 카드면 충분해요
    </div>
    <!-- Sort controls -->
    <div class="flex items-center gap-1 text-xs">
      <span class="text-[var(--color-text-muted)] mr-1">정렬:</span>
      {#each ([['spending', '지출순'], ['rate', '혜택률순'], ['reward', '혜택액순']] as const) as [key, label]}
        <button
          class="rounded px-2 py-0.5 transition-colors {sortKey === key ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)]'}"
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
          <th class="pb-3 text-right font-medium">혜택률</th>
          <th class="pb-3 text-right font-medium">월 예상 혜택</th>
          <th class="pb-3 w-6"></th>
        </tr>
      </thead>
      <tbody>
        {#each sortedAssignments as a}
          {@const issuer = getIssuerFromCardId(a.assignedCardId)}
          {@const issuerColor = getIssuerColor(issuer)}
          {@const issuerName = formatIssuerNameKo(issuer)}
          {@const isExpanded = expandedRows.has(a.category)}
          {@const rateBarWidth = Math.round((a.rate / maxRate) * 100)}
          <tr
            class="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg)] transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-1"
            role="button"
            tabindex="0"
            aria-label={`${a.categoryNameKo} — ${a.assignedCardName}`}
            aria-expanded={isExpanded}
            onclick={() => toggleRow(a.category)}
            onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleRow(a.category); } }}
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
            <td class="py-3 text-right">
              <div class="flex flex-col items-end gap-1">
                <span class="font-mono font-semibold text-[var(--color-primary)]">{formatRate(a.rate)}</span>
                <div class="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--color-bg)]">
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
            <tr class="border-b border-[var(--color-border)] last:border-0 bg-[var(--color-bg)]">
              <td colspan="5" class="px-6 py-3">
                <div class="text-xs text-[var(--color-text-muted)] mb-2 font-medium">대안 카드</div>
                <div class="flex flex-wrap gap-2">
                  {#each a.alternatives as alt}
                    {@const altIssuer = getIssuerFromCardId(alt.cardId)}
                    {@const altColor = getIssuerColor(altIssuer)}
                    <div class="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs">
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
            <tr class="border-b border-[var(--color-border)] last:border-0 bg-[var(--color-bg)]">
              <td colspan="5" class="px-6 py-3 text-xs text-[var(--color-text-muted)]">대안 없음</td>
            </tr>
          {/if}
        {/each}
      </tbody>
    </table>
  </div>
{:else}
  <div class="mt-4 flex h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--color-border)]">
    <div class="opacity-40 text-[var(--color-text-muted)]">
      <Icon name="credit-card" size={40} />
    </div>
    <div class="text-sm font-medium text-[var(--color-text-muted)]">아직 추천 결과가 없어요</div>
    <div class="text-xs text-[var(--color-text-muted)]">명세서를 올리면 어떤 카드가 좋은지 알려줘요</div>
    <a
      href={import.meta.env.BASE_URL ?? '/'}
      class="mt-3 inline-flex items-center gap-1 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-medium text-white hover:bg-[var(--color-primary-dark)] transition-colors"
    >
      명세서 올리러 가기
    </a>
  </div>
{/if}
