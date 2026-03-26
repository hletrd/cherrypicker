<script lang="ts">
  import { analysisStore } from '../../lib/store.svelte.js';
  import { formatWon } from '../../lib/formatters.js';
  import Icon from '../ui/Icon.svelte';
  import type { CategorizedTx } from '../../lib/analyzer.js';

  // Category options for dropdown
  const CATEGORIES = [
    { id: 'dining', label: '외식' },
    { id: 'restaurant', label: '음식점' },
    { id: 'cafe', label: '카페' },
    { id: 'fast_food', label: '패스트푸드' },
    { id: 'delivery', label: '배달' },
    { id: 'grocery', label: '식료품' },
    { id: 'supermarket', label: '대형마트' },
    { id: 'traditional_market', label: '전통시장' },
    { id: 'online_grocery', label: '온라인장보기' },
    { id: 'convenience_store', label: '편의점' },
    { id: 'public_transit', label: '대중교통' },
    { id: 'taxi', label: '택시' },
    { id: 'fuel', label: '주유' },
    { id: 'parking', label: '주차' },
    { id: 'toll', label: '통행료' },
    { id: 'online_shopping', label: '온라인쇼핑' },
    { id: 'offline_shopping', label: '오프라인쇼핑' },
    { id: 'department_store', label: '백화점' },
    { id: 'fashion', label: '패션' },
    { id: 'telecom', label: '통신' },
    { id: 'insurance', label: '보험' },
    { id: 'medical', label: '의료' },
    { id: 'hospital', label: '병원' },
    { id: 'pharmacy', label: '약국' },
    { id: 'education', label: '교육' },
    { id: 'academy', label: '학원' },
    { id: 'books', label: '도서' },
    { id: 'entertainment', label: '엔터테인먼트' },
    { id: 'movie', label: '영화' },
    { id: 'streaming', label: '스트리밍' },
    { id: 'subscription', label: '구독' },
    { id: 'travel', label: '여행' },
    { id: 'airline', label: '항공' },
    { id: 'hotel', label: '숙박' },
    { id: 'utilities', label: '공과금' },
    { id: 'electricity', label: '전기' },
    { id: 'gas', label: '가스' },
    { id: 'water', label: '수도' },
    { id: 'uncategorized', label: '미분류' },
  ];

  const categoryMap = new Map(CATEGORIES.map(c => [c.id, c.label]));

  let expanded = $state(false);
  let editedTxs = $state<CategorizedTx[]>([]);
  let hasEdits = $state(false);
  let reoptimizing = $state(false);
  let filterUncategorized = $state(false);
  let searchQuery = $state('');

  // Sync from store when transactions change
  $effect(() => {
    const txs = analysisStore.transactions;
    if (txs.length > 0 && editedTxs.length === 0) {
      editedTxs = txs.map(tx => ({ ...tx }));
    }
  });

  let displayTxs = $derived.by(() => {
    let list = editedTxs;
    if (filterUncategorized) {
      list = list.filter(tx => tx.category === 'uncategorized' || tx.confidence < 0.5);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(tx => tx.merchant.toLowerCase().includes(q));
    }
    return list;
  });

  let uncategorizedCount = $derived(
    editedTxs.filter(tx => tx.category === 'uncategorized' || tx.confidence < 0.5).length
  );

  function changeCategory(txId: string, newCategory: string) {
    const tx = editedTxs.find(t => t.id === txId);
    if (tx) {
      tx.category = newCategory;
      tx.confidence = 1.0; // manually set = full confidence
      hasEdits = true;
    }
  }

  async function applyEdits() {
    reoptimizing = true;
    try {
      await analysisStore.reoptimize(editedTxs);
      hasEdits = false;
    } finally {
      reoptimizing = false;
    }
  }
</script>

{#if editedTxs.length > 0}
  <div class="mt-4">
    <button
      class="flex w-full items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-[var(--color-bg)]"
      onclick={() => (expanded = !expanded)}
    >
      <span class="flex items-center gap-2">
        <Icon name="receipt" size={16} />
        거래 내역 확인
        <span class="rounded-full bg-[var(--color-bg)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
          {editedTxs.length}건
        </span>
        {#if uncategorizedCount > 0}
          <span class="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
            미분류 {uncategorizedCount}건
          </span>
        {/if}
      </span>
      <span class="text-xs transition-transform duration-200 inline-block {expanded ? 'rotate-180' : ''}">▼</span>
    </button>

    {#if expanded}
      <div class="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
        <!-- Controls bar -->
        <div class="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] p-3">
          <div class="relative flex-1 min-w-[150px]">
            <input
              type="text"
              bind:value={searchQuery}
              placeholder="가맹점 검색"
              class="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <label class="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] cursor-pointer">
            <input type="checkbox" bind:checked={filterUncategorized} class="rounded" />
            미분류만 보기
          </label>
          {#if hasEdits}
            <button
              onclick={applyEdits}
              disabled={reoptimizing}
              class="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-primary-dark)] disabled:opacity-50 transition-colors"
            >
              {reoptimizing ? '재계산 중' : '변경 적용'}
            </button>
          {/if}
        </div>

        <!-- Transaction list -->
        <div class="max-h-[400px] overflow-y-auto">
          <table class="w-full text-xs">
            <thead class="sticky top-0 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
              <tr class="text-left text-[var(--color-text-muted)]">
                <th class="px-3 py-2 font-medium">날짜</th>
                <th class="px-3 py-2 font-medium">가맹점</th>
                <th class="px-3 py-2 text-right font-medium">금액</th>
                <th class="px-3 py-2 font-medium">분류</th>
              </tr>
            </thead>
            <tbody>
              {#each displayTxs as tx (tx.id)}
                <tr class="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg)] transition-colors">
                  <td class="px-3 py-2 text-[var(--color-text-muted)] whitespace-nowrap">
                    {tx.date}
                  </td>
                  <td class="px-3 py-2 font-medium max-w-[200px] truncate" title={tx.merchant}>
                    {tx.merchant}
                  </td>
                  <td class="px-3 py-2 text-right font-mono whitespace-nowrap">
                    {formatWon(tx.amount)}
                  </td>
                  <td class="px-3 py-2">
                    <select
                      value={tx.category}
                      onchange={(e) => changeCategory(tx.id, (e.target as HTMLSelectElement).value)}
                      class="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-1 text-xs outline-none focus:border-[var(--color-primary)] cursor-pointer
                        {tx.confidence < 0.5 ? 'border-amber-300 bg-amber-50 text-amber-700' : ''}
                        {tx.category === 'uncategorized' ? 'border-red-300 bg-red-50 text-red-700' : ''}"
                    >
                      {#each CATEGORIES as cat}
                        <option value={cat.id}>{cat.label}</option>
                      {/each}
                    </select>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
          {#if displayTxs.length === 0}
            <div class="py-8 text-center text-xs text-[var(--color-text-muted)]">
              {searchQuery ? '검색 결과가 없어요' : '거래 내역이 없어요'}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
{/if}
