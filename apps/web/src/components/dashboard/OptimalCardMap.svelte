<script lang="ts">
  import { analysisStore } from '../../lib/store.svelte.js';
  import { formatWon, formatRate, getIssuerColor, getIssuerFromCardId, buildPageUrl } from '../../lib/formatters.js';
  import Icon from '../ui/Icon.svelte';
  import IssuerBadge from '../ui/IssuerBadge.svelte';

  const homeUrl = buildPageUrl('');

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
    // Guard against division by zero in bar width calculation; use a minimum
    // of 0.1% (0.001) so that when all rates are near-zero, bars are
    // proportionally small rather than appearing full-width due to a tiny
    // denominator. Lowered from 0.5% (0.005) to 0.1% for better proportional
    // accuracy at low rate ranges (C12-01).
    return computed > 0.001 ? computed : 0.001;
  });

  let sortedAssignments = $derived.by(() => {
    return [...assignments].sort((a, b) => {
      if (sortKey === 'spending') return b.spending - a.spending;
      if (sortKey === 'rate') return b.rate - a.rate;
      if (sortKey === 'reward') return b.reward - a.reward;
      return 0;
    });
  });

  // Use immutable Set pattern for reliable Svelte 5 reactivity —
  // direct .add()/.delete() mutations on $state Set may not trigger
  // re-renders in all code paths (C54-03).
  function toggleRow(category: string) {
    expandedRows = expandedRows.has(category)
      ? new Set([...expandedRows].filter(c => c !== category))
      : new Set([...expandedRows, category]);
  }
</script>

{#if analysisStore.loading}
  <div class="mt-4 space-y-3">
    {#each Array(5) as _}
      <div class="animate-pulse flex items-center gap-3 rounded-lg border border-[var(--color-border)] p-3">
        <div class="h-4 w-24 rounded bg-[var(--color-border)]"></div>
        <div class="h-6 w-28 rounded-full bg-[var(--color-border)]"></div>
        <div class="ml-auto h-4 w-12 rounded bg-[var(--color-border)]"></div>
        <div class="h-4 w-20 rounded bg-[var(--color-border)]"></div>
      </div>
    {/each}
  </div>
{:else if assignments.length > 0}
  <div class="mt-4 mb-3 flex flex-wrap items-center justify-between gap-3">
    <div class="text-sm text-[var(--color-text-muted)]">
      총 <strong class="text-[var(--color-text)]">{uniqueCardCount}장</strong>의 카드면 충분해요
    </div>
    <div class="flex flex-wrap items-center gap-1 text-xs print:hidden" role="group" aria-label="추천 카드 정렬" data-print-control>
      <span class="mr-1 text-[var(--color-text-muted)]">정렬:</span>
      {#each ([['spending', '지출순'], ['rate', '혜택률순'], ['reward', '혜택액순']] as const) as [key, label]}
        <button
          type="button"
          class="min-h-11 rounded px-3 py-2 transition-colors {sortKey === key ? 'bg-[var(--color-primary-fill)] text-white' : 'bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)]'}"
          aria-pressed={sortKey === key}
          onclick={() => (sortKey = key)}
        >
          {label}
        </button>
      {/each}
    </div>
  </div>

  <!-- Narrow screens use cards so long Korean names and values never force
       the document wider than the viewport. -->
  <div data-testid="optimal-card-mobile-list" class="space-y-3 md:hidden print:hidden">
    {#each sortedAssignments as a (a.category)}
      {@const issuer = getIssuerFromCardId(a.assignedCardId)}
      {@const issuerColor = getIssuerColor(issuer)}
      {@const isExpanded = expandedRows.has(a.category)}
      <article class="min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4" style="border-left: 3px solid {issuerColor};">
        <div class="flex min-w-0 items-start justify-between gap-3">
          <div class="min-w-0">
            <h3 class="break-keep [overflow-wrap:anywhere] font-semibold">{a.categoryNameKo}</h3>
            <div class="mt-2 flex min-w-0 flex-wrap items-center gap-2">
              <IssuerBadge {issuer} />
              <span class="min-w-0 break-keep [overflow-wrap:anywhere] text-sm">{a.assignedCardName}</span>
            </div>
          </div>
          <button
            type="button"
            class="min-h-11 shrink-0 rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-primary-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
            aria-label={`${a.categoryNameKo}의 대안 카드 ${isExpanded ? '닫기' : '보기'}`}
            aria-expanded={isExpanded}
            aria-controls={`mobile-alternatives-${a.category}`}
            onclick={() => toggleRow(a.category)}
          >
            대안 {isExpanded ? '닫기' : '보기'}
          </button>
        </div>
        <dl class="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt class="text-[var(--color-text-muted)]">혜택률</dt>
          <dd class="text-right font-mono font-semibold text-[var(--color-primary-fg)]">{formatRate(a.rate)}</dd>
          <dt class="text-[var(--color-text-muted)]">월 예상 혜택</dt>
          <dd class="text-right font-mono">{formatWon(a.reward)}</dd>
        </dl>
        <div id={`mobile-alternatives-${a.category}`} class="mt-3 border-t border-[var(--color-border)] pt-3 {isExpanded ? 'block' : 'hidden'}">
          {#if a.alternatives?.length}
            <p class="mb-2 text-xs font-medium text-[var(--color-text-muted)]">대안 카드</p>
            <div class="space-y-2">
              {#each a.alternatives as alt}
                {@const altIssuer = getIssuerFromCardId(alt.cardId)}
                <div class="flex min-w-0 items-center gap-2 rounded-lg bg-[var(--color-bg)] p-2 text-xs">
                  <IssuerBadge issuer={altIssuer} />
                  <span class="min-w-0 flex-1 break-keep [overflow-wrap:anywhere] font-medium">{alt.cardName}</span>
                  <span class="whitespace-nowrap text-[var(--color-primary-fg)]">{formatRate(alt.rate)}</span>
                </div>
              {/each}
            </div>
          {:else}
            <p class="text-xs text-[var(--color-text-muted)]">대안 없음</p>
          {/if}
        </div>
      </article>
    {/each}
  </div>

  <table data-testid="optimal-card-table" class="hidden w-full text-sm md:table print:table">
    <thead>
      <tr class="border-b border-[var(--color-border)] text-left text-[var(--color-text-muted)]">
        <th scope="col" class="pb-3 font-medium">카테고리</th>
        <th scope="col" class="pb-3 font-medium">추천 카드</th>
        <th scope="col" class="pb-3 text-right font-medium">혜택률</th>
        <th scope="col" class="pb-3 text-right font-medium">월 예상 혜택</th>
        <th scope="col" class="pb-3 text-center font-medium print:hidden">대안</th>
      </tr>
    </thead>
    <tbody>
      {#each sortedAssignments as a (a.category)}
        {@const issuer = getIssuerFromCardId(a.assignedCardId)}
        {@const issuerColor = getIssuerColor(issuer)}
        {@const isExpanded = expandedRows.has(a.category)}
        {@const rateBarWidth = Math.round((a.rate / maxRate) * 100)}
        <tr class="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg)]">
          <th scope="row" class="py-3 text-left font-medium" style="border-left: 3px solid {issuerColor}; padding-left: 8px;">
            {a.categoryNameKo}
          </th>
          <td class="py-3">
            <div class="flex min-w-0 items-center gap-2">
              <IssuerBadge {issuer} />
              <span class="break-keep [overflow-wrap:anywhere]">{a.assignedCardName}</span>
            </div>
          </td>
          <td class="py-3 text-right">
            <div class="flex flex-col items-end gap-1">
              <span class="font-mono font-semibold text-[var(--color-primary-fg)]">{formatRate(a.rate)}</span>
              <div class="h-2.5 w-20 overflow-hidden rounded-full bg-[var(--color-bg)]">
                <div class="h-full rounded-full bg-[var(--color-primary-fill)]" style="width: {rateBarWidth}%; opacity: 0.75"></div>
              </div>
            </div>
          </td>
          <td class="py-3 text-right font-mono">{formatWon(a.reward)}</td>
          <td class="py-3 text-center print:hidden">
            <button
              type="button"
              class="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
              aria-label={`${a.categoryNameKo}, ${a.assignedCardName} 대안 카드 ${isExpanded ? '닫기' : '보기'}`}
              aria-expanded={isExpanded}
              aria-controls={`desktop-alternatives-${a.category}`}
              onclick={() => toggleRow(a.category)}
            >
              <span aria-hidden="true" class="inline-block text-xs transition-transform duration-200 {isExpanded ? 'rotate-180' : ''}">▼</span>
            </button>
          </td>
        </tr>
        <tr id={`desktop-alternatives-${a.category}`} class="border-b border-[var(--color-border)] bg-[var(--color-bg)] print:hidden {isExpanded ? 'table-row' : 'hidden'}">
          <td colspan="5" class="px-6 py-3">
            {#if a.alternatives?.length}
              <p class="mb-2 text-xs font-medium text-[var(--color-text-muted)]">대안 카드</p>
              <div class="flex flex-wrap gap-2">
                {#each a.alternatives as alt}
                  {@const altIssuer = getIssuerFromCardId(alt.cardId)}
                  <div class="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs">
                    <IssuerBadge issuer={altIssuer} />
                    <span class="font-medium">{alt.cardName}</span>
                    <span class="text-[var(--color-text-muted)]">·</span>
                    <span class="text-[var(--color-primary-fg)]">{formatRate(alt.rate)}</span>
                  </div>
                {/each}
              </div>
            {:else}
              <span class="text-xs text-[var(--color-text-muted)]">대안 없음</span>
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
{:else}
  <div class="mt-4 flex h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--color-border)]">
    <div class="opacity-40 text-[var(--color-text-muted)]">
      <Icon name="credit-card" size={40} />
    </div>
    <div class="text-sm font-medium text-[var(--color-text-muted)]">아직 추천 결과가 없어요</div>
    <div class="text-xs text-[var(--color-text-muted)]">명세서를 올리면 어떤 카드가 좋은지 알려줘요</div>
    <a
      href={homeUrl}
      class="mt-3 inline-flex items-center gap-1 rounded-lg bg-[var(--color-primary-fill)] px-4 py-2 text-xs font-medium text-white hover:bg-[var(--color-primary-fill-hover)] transition-colors"
    >
      명세서 올리러 가기
    </a>
  </div>
{/if}
