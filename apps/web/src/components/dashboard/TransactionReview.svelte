<script lang="ts">
  import { analysisStore } from '../../lib/store.svelte.js';
  import { formatWon } from '../../lib/formatters.js';
  import Icon from '../ui/Icon.svelte';
  import type { CategorizedTx } from '../../lib/analyzer.js';
  import * as aiCategorizer from '../../lib/categorizer-ai.js';
  import { onMount } from 'svelte';

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
  let aiStatus = $state<string>('');
  let aiProgress = $state<number>(0);
  let aiRunning = $state(false);
  let aiAvailable = $state(false);

  // Check if AI is available on mount (browser only)
  onMount(() => {
    aiAvailable = aiCategorizer.isAvailable();
  });

  async function runAICategorization() {
    aiRunning = true;
    aiStatus = '모델 불러오는 중';
    aiProgress = 0;

    try {
      await aiCategorizer.initialize((p) => {
        aiStatus = p.status;
        if (p.progress) aiProgress = p.progress;
      });

      // Get uncategorized/low-confidence items
      const targets = editedTxs.filter(tx => tx.category === 'uncategorized' || tx.confidence < 0.5);

      if (targets.length === 0) {
        aiStatus = '분류할 항목이 없어요';
        setTimeout(() => { aiStatus = ''; }, 2000);
        return;
      }

      aiStatus = `${targets.length}건 분류 중`;

      const results = await aiCategorizer.categorizeBatch(
        targets.map(tx => ({ id: tx.id, name: tx.merchant })),
        (done, total) => {
          aiProgress = Math.round((done / total) * 100);
          aiStatus = `${done}/${total}건 분류 중`;
        },
      );

      // Apply results
      let changed = 0;
      for (const [txId, result] of results) {
        if (result.category !== 'uncategorized') {
          const tx = editedTxs.find(t => t.id === txId);
          if (tx) {
            tx.category = result.category;
            tx.confidence = result.confidence;
            changed++;
          }
        }
      }

      if (changed > 0) {
        hasEdits = true;
        aiStatus = `${changed}건 분류 완료`;
      } else {
        aiStatus = '새로 분류된 항목이 없어요';
      }
      setTimeout(() => { aiStatus = ''; }, 3000);
    } catch (e) {
      aiStatus = e instanceof Error ? e.message : '분류 중 문제가 생겼어요';
    } finally {
      aiRunning = false;
    }
  }

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
          <span class="rounded-full bg-amber-100 dark:bg-amber-900 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400">
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
          {#if aiAvailable && uncategorizedCount > 0}
            <button
              onclick={runAICategorization}
              disabled={aiRunning}
              class="flex items-center gap-1 rounded-lg border border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-950 dark:bg-purple-950 px-3 py-1.5 text-xs font-medium text-purple-700 dark:text-purple-400 hover:bg-purple-100 disabled:opacity-50 transition-colors"
            >
              {#if aiRunning}
                <svg class="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {aiStatus}
                {#if aiProgress > 0}({aiProgress}%){/if}
              {:else}
                <Icon name="sparkles" size={12} />
                미분류 항목 AI 분류
              {/if}
            </button>
          {/if}
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
                <th class="px-3 py-2 text-center font-medium">확신도</th>
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
                      aria-label={tx.merchant + " 카테고리"}
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
                  <td class="px-3 py-2 text-center">
                    {#if tx.confidence >= 1.0}
                      <span class="inline-block rounded-full bg-green-100 dark:bg-green-900 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:text-green-400" title="키워드 정확 일치">정확</span>
                    {:else if tx.confidence >= 0.8}
                      <span class="inline-block rounded-full bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-400" title="키워드 부분 일치">높음</span>
                    {:else if tx.confidence >= 0.5}
                      <span class="inline-block rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700" title="은행 분류 또는 YAML 키워드">보통</span>
                    {:else if tx.confidence > 0}
                      <span class="inline-block rounded-full bg-orange-100 dark:bg-orange-900 px-1.5 py-0.5 text-[10px] font-medium text-orange-700 dark:text-orange-400" title="약한 매칭">낮음</span>
                    {:else}
                      <span class="inline-block rounded-full bg-red-100 dark:bg-red-900 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-400" title="매칭 실패">없음</span>
                    {/if}
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
{:else if analysisStore.result}
  <div class="mt-4 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-xs text-[var(--color-text-muted)]">
    거래 상세 내역은 현재 브라우저 세션 메모리에만 보관되고, 페이지 이동 후에는 다시 불러오지 않아요.
  </div>
{/if}
