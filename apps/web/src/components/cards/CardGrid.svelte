<script lang="ts">
  import { onMount } from 'svelte';
  import { getCards } from '../../lib/api.js';
  import type { CardSummary } from '../../lib/api.js';
  import { formatWon, getIssuerColor, formatIssuerNameKo } from '../../lib/formatters.js';
  import Icon from '../ui/Icon.svelte';

  interface Props {
    onSelectCard?: (cardId: string) => void;
  }

  let { onSelectCard }: Props = $props();

  let cards = $state<CardSummary[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let searchQuery = $state('');
  let typeFilter = $state<'all' | 'credit' | 'check' | 'prepaid'>('all');
  let sortOrder = $state<'name' | 'fee-asc' | 'fee-desc' | 'rewards'>('name');
  let issuerFilter = $state('');

  let availableIssuers = $derived([...new Set(cards.map(c => c.issuer))].sort());

  let filteredCards = $derived.by(() => {
    let result = cards.slice();

    // Type filter
    if (typeFilter === 'credit') {
      result = result.filter((c) => c.type === 'credit');
    } else if (typeFilter === 'check') {
      result = result.filter((c) => c.type === 'check');
    } else if (typeFilter === 'prepaid') {
      result = result.filter((c) => c.type === 'prepaid');
    }

    // Issuer filter
    if (issuerFilter) result = result.filter(c => c.issuer === issuerFilter);

    // Search filter
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (c) =>
          c.nameKo.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          formatIssuerNameKo(c.issuer).toLowerCase().includes(q),
      );
    }

    // Sort
    if (sortOrder === 'name') {
      result.sort((a, b) => a.nameKo.localeCompare(b.nameKo, 'ko'));
    } else if (sortOrder === 'fee-asc') {
      result.sort((a, b) => a.annualFee.domestic - b.annualFee.domestic);
    } else if (sortOrder === 'fee-desc') {
      result.sort((a, b) => b.annualFee.domestic - a.annualFee.domestic);
    } else if (sortOrder === 'rewards') {
      result.sort((a, b) => b.rewardCategories.length - a.rewardCategories.length);
    }

    return result;
  });

  onMount(() => {
    getCards()
      .then((result) => { cards = result; })
      .catch((e) => { error = e instanceof Error ? e.message : '카드를 불러오지 못했어요'; })
      .finally(() => { loading = false; });
  });
</script>

<div class="flex flex-col gap-5">
  <!-- Search + Sort row -->
  <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
    <div class="relative flex-1">
      <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[var(--color-text-muted)]">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
      </span>
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="카드 이름으로 검색"
        class="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-2 pl-9 pr-4 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all"
      />
    </div>
    <select
      bind:value={sortOrder} aria-label="정렬 기준"
      class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)] cursor-pointer"
    >
      <option value="name">이름순</option>
      <option value="fee-asc">연회비 낮은순</option>
      <option value="fee-desc">연회비 높은순</option>
      <option value="rewards">혜택 많은순</option>
    </select>
  </div>

  <!-- Type filter tabs + count badge -->
  <div class="flex items-center gap-2 flex-wrap">
    {#each [['all', '전체'], ['credit', '신용카드'], ['check', '체크카드'], ['prepaid', '선불카드']] as [val, label]}
      <button
        class="rounded-full px-4 py-1.5 text-sm font-medium transition-colors
          {typeFilter === val
            ? 'bg-[var(--color-primary)] text-white shadow-sm'
            : 'bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)]'}"
        onclick={() => (typeFilter = val as 'all' | 'credit' | 'check' | 'prepaid')}
      >
        {label}
      </button>
    {/each}
    {#if !loading}
      <span class="ml-auto rounded-full bg-[var(--color-bg)] px-3 py-1 text-xs font-medium text-[var(--color-text-muted)]">
        {filteredCards.length}개 카드
      </span>
    {/if}
  </div>

  <!-- Issuer filter pills -->
  {#if availableIssuers.length > 0}
    <div class="flex flex-wrap gap-1.5">
      <button
        class="rounded-full border px-2.5 py-1 text-xs transition-colors {issuerFilter === '' ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white' : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)]'}"
        onclick={() => (issuerFilter = '')}
      >전체</button>
      {#each availableIssuers as iss}
        <button
          class="rounded-full border px-2.5 py-1 text-xs transition-colors {issuerFilter === iss ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white' : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)]'}"
          onclick={() => (issuerFilter = iss)}
        >{formatIssuerNameKo(iss)}</button>
      {/each}
    </div>
  {/if}

  {#if loading}
    <!-- Loading skeleton: 6 card placeholders -->
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each Array(6) as _}
        <div class="animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <div class="h-3 w-20 rounded bg-gray-200"></div>
          <div class="mt-3 h-5 w-3/4 rounded bg-gray-200"></div>
          <div class="mt-2 h-3 w-1/2 rounded bg-gray-200"></div>
          <div class="mt-6 flex items-center justify-between">
            <div class="h-3 w-24 rounded bg-gray-200"></div>
            <div class="h-5 w-16 rounded-full bg-gray-200"></div>
          </div>
        </div>
      {/each}
    </div>
  {:else if error}
    <div class="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>
  {:else if filteredCards.length === 0}
    <div class="flex h-48 flex-col items-center justify-center gap-2 text-[var(--color-text-muted)]">
      {#if searchQuery.trim() || typeFilter !== 'all'}
        <span class="text-[var(--color-text-muted)] opacity-40"><Icon name="magnifying-glass" size={40} /></span>
        <p class="text-sm">검색 결과가 없어요</p>
        <button
          class="mt-1 text-xs text-[var(--color-primary)] hover:underline"
          onclick={() => { searchQuery = ''; typeFilter = 'all'; issuerFilter = ''; }}
        >
          필터 초기화
        </button>
      {:else}
        <span class="text-[var(--color-text-muted)] opacity-40"><Icon name="credit-card" size={40} /></span>
        <p class="text-sm">등록된 카드가 없어요</p>
      {/if}
    </div>
  {:else}
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each filteredCards as card}
        {@const issuerColor = getIssuerColor(card.issuer)}
        <button
          onclick={() => onSelectCard?.(card.id)}
          class="group relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg w-full cursor-pointer"
          style="border-left: 4px solid {issuerColor};"
        >
          <!-- Card type badge -->
          <span
            class="absolute right-3 top-3 rounded-full px-2 py-0.5 text-xs font-medium
              {card.type === 'credit'
                ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-400'
                : card.type === 'check'
                  ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-400'
                  : 'bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-400'}"
          >
            {card.type === 'credit' ? '신용' : card.type === 'check' ? '체크' : '선불'}
          </span>

          <div class="text-xs font-medium" style="color: {issuerColor};">
            {formatIssuerNameKo(card.issuer)}
          </div>
          <div class="mt-1 pr-10 text-base font-semibold leading-snug">{card.nameKo}</div>
          <div class="mt-0.5 text-xs text-[var(--color-text-muted)] truncate">{card.name}</div>
          <div class="mt-4 flex items-center justify-between">
            <span class="text-sm text-[var(--color-text-muted)]">
              연회비 {card.annualFee.domestic === 0 ? '없음' : formatWon(card.annualFee.domestic)}
            </span>
            {#if card.rewardCategories.length > 0}
              <span class="rounded-full bg-green-100 dark:bg-green-900 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                {card.rewardCategories.length}개 혜택
              </span>
            {/if}
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>
