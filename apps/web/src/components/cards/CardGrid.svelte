<script lang="ts">
  import { onMount } from 'svelte';
  import { getCards } from '../../lib/api.js';
  import type { CardSummary } from '../../lib/api.js';
  import { formatWon, getIssuerColor, formatIssuerNameKo } from '../../lib/formatters.js';
  import {
    clampCardGridPage,
    getCardGridPage,
    getCardGridPageNumbers,
    readCardGridQuery,
    writeCardGridQuery,
    type CardGridSortOrder,
    type CardGridTypeFilter,
  } from '../../lib/card-grid-state.js';
  import Icon from '../ui/Icon.svelte';
  import IssuerBadge from '../ui/IssuerBadge.svelte';

  interface Props {
    onSelectCard?: (cardId: string) => void;
  }

  let { onSelectCard }: Props = $props();

  let cards = $state<CardSummary[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let searchQuery = $state('');
  let typeFilter = $state<CardGridTypeFilter>('all');
  let sortOrder = $state<CardGridSortOrder>('name');
  let issuerFilter = $state('');
  let currentPage = $state(1);
  let queryReady = $state(false);
  let requestController: AbortController | null = null;
  let requestGeneration = 0;
  let mounted = false;

  // Derive available issuers from type-filtered cards only (not from
  // filteredCards which also depends on issuerFilter). This breaks the
  // reactive dependency cycle: typeFilter change -> filteredCards recompute
  // -> availableIssuers recompute -> $effect resets issuerFilter ->
  // filteredCards recompute again. By basing availableIssuers on the type
  // filter alone, the $effect that resets issuerFilter no longer causes
  // a second filteredCards recomputation (C60-01).
  let availableIssuers = $derived.by(() => {
    let filtered = cards.slice();
    if (typeFilter === 'credit') filtered = filtered.filter(c => c.type === 'credit');
    else if (typeFilter === 'check') filtered = filtered.filter(c => c.type === 'check');
    else if (typeFilter === 'prepaid') filtered = filtered.filter(c => c.type === 'prepaid');
    return [...new Set(filtered.map(c => c.issuer))].sort();
  });

  // Reset issuer filter if the selected issuer is no longer available
  // after type filter change (e.g., issuer only has credit cards but
  // user selected "체크카드" filter)
  $effect(() => {
    if (
      !loading &&
      !error &&
      issuerFilter &&
      !availableIssuers.includes(issuerFilter)
    ) {
      issuerFilter = '';
      currentPage = 1;
    }
  });

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
      result.sort((a, b) => a.annualFee.domestic - b.annualFee.domestic || a.annualFee.international - b.annualFee.international);
    } else if (sortOrder === 'fee-desc') {
      result.sort((a, b) => b.annualFee.domestic - a.annualFee.domestic || b.annualFee.international - a.annualFee.international);
    } else if (sortOrder === 'rewards') {
      result.sort((a, b) => b.rewardCategories.length - a.rewardCategories.length);
    }

    return result;
  });

  let pageInfo = $derived(getCardGridPage(filteredCards, currentPage));
  let pageNumbers = $derived(
    getCardGridPageNumbers(pageInfo.page, pageInfo.totalPages),
  );

  $effect(() => {
    if (loading) return;
    const clampedPage = clampCardGridPage(currentPage, filteredCards.length);
    if (clampedPage !== currentPage) currentPage = clampedPage;
  });

  $effect(() => {
    if (!queryReady || typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.search = writeCardGridQuery(
      {
        search: searchQuery,
        type: typeFilter,
        issuer: issuerFilter,
        sort: sortOrder,
        page: currentPage,
      },
      url.searchParams,
    ).toString();
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, '', nextUrl);
  });

  function setSearchQuery(value: string) {
    searchQuery = value;
    currentPage = 1;
  }

  function setTypeFilter(value: CardGridTypeFilter) {
    typeFilter = value;
    currentPage = 1;
  }

  function setIssuerFilter(value: string) {
    issuerFilter = value;
    currentPage = 1;
  }

  function setSortOrder(value: CardGridSortOrder) {
    sortOrder = value;
  }

  function setPage(value: number) {
    currentPage = clampCardGridPage(value, filteredCards.length);
  }

  async function loadCards() {
    requestController?.abort();
    const controller = new AbortController();
    requestController = controller;
    const generation = ++requestGeneration;
    loading = true;
    error = null;
    try {
      const result = await getCards({ signal: controller.signal });
      if (mounted && !controller.signal.aborted && generation === requestGeneration) {
        cards = result;
      }
    } catch (e) {
      if (mounted && !controller.signal.aborted && generation === requestGeneration) {
        error = e instanceof Error && e.name !== 'AbortError'
          ? e.message
          : '카드를 불러오지 못했어요';
      }
    } finally {
      if (mounted && !controller.signal.aborted && generation === requestGeneration) {
        loading = false;
      }
    }
  }

  onMount(() => {
    const restored = readCardGridQuery(window.location.search);
    searchQuery = restored.search;
    typeFilter = restored.type;
    issuerFilter = restored.issuer;
    sortOrder = restored.sort;
    currentPage = restored.page;
    queryReady = true;
    mounted = true;
    void loadCards();
    return () => {
      mounted = false;
      requestController?.abort();
    };
  });
</script>

<div class="flex flex-col gap-5" aria-busy={loading}>
  <!-- Search + Sort row -->
  <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
    <div class="flex-1">
      <label for="card-search" class="mb-1 block text-sm font-medium text-[var(--color-text)]">카드 검색</label>
      <div class="relative">
        <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[var(--color-text-muted)]">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
        </span>
        <input
          id="card-search"
          type="text"
          value={searchQuery}
          oninput={(event) => setSearchQuery(event.currentTarget.value)}
          placeholder="카드 이름으로 검색"
          class="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-2 pl-9 pr-4 text-sm outline-none focus:border-[var(--color-focus)] focus:ring-2 focus:ring-[var(--color-focus)] transition-all"
        />
      </div>
    </div>
    <div>
      <label for="card-sort" class="mb-1 block text-sm font-medium text-[var(--color-text)]">정렬</label>
      <select
        id="card-sort"
        value={sortOrder}
        onchange={(event) => setSortOrder(event.currentTarget.value as CardGridSortOrder)}
        class="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-focus)] focus:ring-2 focus:ring-[var(--color-focus)] cursor-pointer"
      >
        <option value="name">이름순</option>
        <option value="fee-asc">연회비 낮은순</option>
        <option value="fee-desc">연회비 높은순</option>
        <option value="rewards">혜택 많은순</option>
      </select>
    </div>
  </div>

  <!-- Type filter tabs + count badge -->
  <div class="flex items-center gap-2 flex-wrap" role="group" aria-labelledby="card-type-filter-label">
    <span id="card-type-filter-label" class="w-full text-sm font-medium text-[var(--color-text)]">카드 종류</span>
    {#each [['all', '전체'], ['credit', '신용카드'], ['check', '체크카드'], ['prepaid', '선불카드']] as [val, label]}
      <button
        type="button"
        class="rounded-full px-4 py-1.5 text-sm font-medium transition-colors
          {typeFilter === val
            ? 'bg-[var(--color-primary-fill)] text-white shadow-sm'
            : 'bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)]'}"
        onclick={() => setTypeFilter(val as CardGridTypeFilter)}
        aria-pressed={typeFilter === val}
      >
        {label}
      </button>
    {/each}
    {#if !loading}
      <span class="ml-auto rounded-full bg-[var(--color-bg)] px-3 py-1 text-xs font-medium text-[var(--color-text-muted)]" aria-live="polite">
        {filteredCards.length}개 카드
      </span>
    {/if}
  </div>

  <!-- Issuer filter pills -->
  {#if availableIssuers.length > 0}
    <div class="flex flex-wrap gap-1.5" role="group" aria-labelledby="issuer-filter-label">
      <span id="issuer-filter-label" class="w-full text-sm font-medium text-[var(--color-text)]">카드사</span>
      <button
        type="button"
        class="rounded-full border px-2.5 py-1 text-xs transition-colors {issuerFilter === '' ? 'border-[var(--color-primary-fill)] bg-[var(--color-primary-fill)] text-white' : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)]'}"
        onclick={() => setIssuerFilter('')}
        aria-pressed={issuerFilter === ''}
      >전체</button>
      {#each availableIssuers as iss}
        <button
          type="button"
          class="rounded-full border px-2.5 py-1 text-xs transition-colors {issuerFilter === iss ? 'border-[var(--color-primary-fill)] bg-[var(--color-primary-fill)] text-white' : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)]'}"
          onclick={() => setIssuerFilter(iss)}
          aria-pressed={issuerFilter === iss}
        >{formatIssuerNameKo(iss)}</button>
      {/each}
    </div>
  {/if}

  {#if loading}
    <p class="sr-only" role="status">카드 목록을 불러오는 중이에요</p>
    <!-- Loading skeleton: 6 card placeholders -->
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each Array(6) as _}
        <div class="animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <div class="h-3 w-20 rounded bg-[var(--color-border)]"></div>
          <div class="mt-3 h-5 w-3/4 rounded bg-[var(--color-border)]"></div>
          <div class="mt-2 h-3 w-1/2 rounded bg-[var(--color-border)]"></div>
          <div class="mt-6 flex items-center justify-between">
            <div class="h-3 w-24 rounded bg-[var(--color-border)]"></div>
            <div class="h-5 w-16 rounded-full bg-[var(--color-border)]"></div>
          </div>
        </div>
      {/each}
    </div>
  {:else if error}
    <div class="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200" role="alert">
      <p>{error}</p>
      <button
        type="button"
        class="mt-3 rounded-lg bg-[var(--color-primary-fill)] px-3 py-2 font-semibold text-white hover:bg-[var(--color-primary-fill-hover)]"
        onclick={() => void loadCards()}
      >다시 시도</button>
    </div>
  {:else if filteredCards.length === 0}
    <div class="flex h-48 flex-col items-center justify-center gap-2 text-[var(--color-text-muted)]">
      {#if searchQuery.trim() || typeFilter !== 'all' || issuerFilter}
        <span class="text-[var(--color-text-muted)] opacity-40"><Icon name="magnifying-glass" size={40} /></span>
        <p class="text-sm">검색 결과가 없어요</p>
        <button
          type="button"
          class="mt-1 text-xs text-[var(--color-primary-fg)] hover:underline"
          onclick={() => {
            searchQuery = '';
            typeFilter = 'all';
            issuerFilter = '';
            currentPage = 1;
          }}
        >
          필터 초기화
        </button>
      {:else}
        <span class="text-[var(--color-text-muted)] opacity-40"><Icon name="credit-card" size={40} /></span>
        <p class="text-sm">등록된 카드가 없어요</p>
      {/if}
    </div>
  {:else}
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="card-grid-page">
      {#each pageInfo.items as card}
        {@const issuerColor = getIssuerColor(card.issuer)}
        <button
          type="button"
          onclick={() => onSelectCard?.(card.id)}
          data-testid="card-grid-card"
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

          <IssuerBadge issuer={card.issuer} compact />
          <div class="mt-1 pr-10 break-keep [overflow-wrap:anywhere] text-base font-semibold leading-snug">{card.nameKo}</div>
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

    <div class="mt-6 flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p
        class="text-sm text-[var(--color-text-muted)]"
        aria-live="polite"
        data-testid="card-grid-page-range"
      >
        {pageInfo.start}–{pageInfo.end} / {pageInfo.totalItems}개
      </p>
      <nav class="flex flex-wrap items-center justify-center gap-1" aria-label="카드 목록 페이지">
        <button
          type="button"
          class="min-h-11 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="이전 페이지"
          disabled={pageInfo.page === 1}
          onclick={() => setPage(pageInfo.page - 1)}
        >
          이전
        </button>
        {#each pageNumbers as pageNumber}
          <button
            type="button"
            class="min-h-11 min-w-11 rounded-lg border px-3 py-2 text-sm transition-colors
              {pageInfo.page === pageNumber
                ? 'border-[var(--color-primary-fill)] bg-[var(--color-primary-fill)] text-white'
                : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:border-[var(--color-focus)]'}"
            aria-label={`${pageNumber}페이지`}
            aria-current={pageInfo.page === pageNumber ? 'page' : undefined}
            onclick={() => setPage(pageNumber)}
          >
            {pageNumber}
          </button>
        {/each}
        <button
          type="button"
          class="min-h-11 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="다음 페이지"
          disabled={pageInfo.page === pageInfo.totalPages}
          onclick={() => setPage(pageInfo.page + 1)}
        >
          다음
        </button>
      </nav>
    </div>
  {/if}
</div>
