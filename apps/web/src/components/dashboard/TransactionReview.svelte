<script lang="ts">
  import { analysisStore } from '../../lib/store.svelte.js';
  import { formatWon } from '../../lib/formatters.js';
  import Icon from '../ui/Icon.svelte';
  import type { CategorizedTx } from '../../lib/analyzer.js';
  import { onMount } from 'svelte';
  import { loadCategories } from '../../lib/cards.js';

  // Category options loaded dynamically from categories.yaml taxonomy
  let categoryOptions = $state<{ id: string; label: string }[]>([]);

  // Grouped category options for rendering with <optgroup> in the select
  // dropdown. Each group has a label (parent category) and a list of
  // options including the parent itself and its subcategories. This
  // replaces the flat leading-space indentation which is trimmed by some
  // mobile browsers, making subcategories visually indistinguishable
  // from parent categories (C86-08).
  interface CategoryGroup {
    label: string;
    options: { id: string; label: string }[];
  }
  let categoryGroups = $state<CategoryGroup[]>([]);

  // Fallback used if categories fail to load. Uses grouped format so
  // the optgroup rendering works even in fallback mode (C74-01).
  const FALLBACK_GROUPS: CategoryGroup[] = [
    { label: '외식', options: [{ id: 'dining', label: '전체' }, { id: 'dining.restaurant', label: '일반음식점' }, { id: 'dining.cafe', label: '카페' }, { id: 'dining.fast_food', label: '패스트푸드' }, { id: 'dining.delivery', label: '배달' }] },
    { label: '식료품/마트', options: [{ id: 'grocery', label: '전체' }, { id: 'grocery.supermarket', label: '대형마트' }, { id: 'grocery.traditional_market', label: '전통시장' }, { id: 'grocery.online_grocery', label: '온라인식품' }] },
    { label: '편의점', options: [{ id: 'convenience_store', label: '전체' }] },
    { label: '대중교통', options: [{ id: 'public_transit', label: '전체' }, { id: 'public_transit.bus', label: '버스' }, { id: 'public_transit.subway', label: '지하철' }, { id: 'public_transit.taxi', label: '택시' }] },
    { label: '교통/주유', options: [{ id: 'transportation', label: '전체' }, { id: 'transportation.fuel', label: '주유' }, { id: 'transportation.parking', label: '주차' }, { id: 'transportation.toll', label: '고속도로통행료' }] },
    { label: '통신', options: [{ id: 'telecom', label: '전체' }] },
    { label: '보험', options: [{ id: 'insurance', label: '전체' }] },
    { label: '온라인쇼핑', options: [{ id: 'online_shopping', label: '전체' }, { id: 'online_shopping.general', label: '종합쇼핑몰' }, { id: 'online_shopping.fashion', label: '패션' }] },
    { label: '오프라인쇼핑', options: [{ id: 'offline_shopping', label: '전체' }, { id: 'offline_shopping.department_store', label: '백화점' }] },
    { label: '의료', options: [{ id: 'medical', label: '전체' }, { id: 'medical.hospital', label: '병원' }, { id: 'medical.pharmacy', label: '약국' }] },
    { label: '교육', options: [{ id: 'education', label: '전체' }, { id: 'education.academy', label: '학원' }, { id: 'education.books', label: '도서' }] },
    { label: '여가/문화', options: [{ id: 'entertainment', label: '전체' }, { id: 'entertainment.movie', label: '영화' }, { id: 'entertainment.streaming', label: '스트리밍' }] },
    { label: '여행', options: [{ id: 'travel', label: '전체' }, { id: 'travel.airline', label: '항공' }, { id: 'travel.hotel', label: '호텔/숙박' }, { id: 'travel.travel_agency', label: '여행사' }] },
    { label: '구독', options: [{ id: 'subscription', label: '전체' }] },
    { label: '공과금', options: [{ id: 'utilities', label: '전체' }, { id: 'utilities.electricity', label: '전기요금' }, { id: 'utilities.gas', label: '가스요금' }, { id: 'utilities.water', label: '수도요금' }, { id: 'utilities.apartment_mgmt', label: '관리비' }] },
    { label: '기타', options: [{ id: 'uncategorized', label: '기타' }] },
  ];

  // Flat fallback list for categoryMap construction (all IDs + labels)
  const FALLBACK_CATEGORIES = FALLBACK_GROUPS.flatMap(g => g.options);

  let categoryMap = $state<Map<string, string>>(new Map(FALLBACK_CATEGORIES.map(c => [c.id, c.label])));

  // Maps subcategory IDs to their parent category IDs for correct
  // category/subcategory assignment when the user selects a subcategory.
  let subcategoryToParent = $state<Map<string, string>>(new Map());

  let expanded = $state(false);
  let editedTxs = $state<CategorizedTx[]>([]);
  let hasEdits = $state(false);
  let reoptimizing = $state(false);
  let filterUncategorized = $state(false);
  let searchQuery = $state('');

  // Load categories on mount (browser only). Pass an AbortSignal so the
  // fetch is cancelled if the component unmounts during an Astro View
  // Transition, preventing orphaned network requests and state updates
  // on a torn-down component (C73-02).
  onMount(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const nodes = await loadCategories(controller.signal);
        // Guard against empty categories — loadCategories() returns [] on
        // AbortError. Using empty categories would produce an empty dropdown,
        // so fall back to the hardcoded list (C73-02).
        if (nodes.length === 0) {
          categoryOptions = FALLBACK_CATEGORIES;
          categoryGroups = FALLBACK_GROUPS;
          categoryMap = new Map(FALLBACK_CATEGORIES.map(c => [c.id, c.label]));
          return;
        }
        const options: { id: string; label: string }[] = [];
        const groups: CategoryGroup[] = [];
        const parentMap = new Map<string, string>();
        for (const node of nodes) {
          const groupOptions: { id: string; label: string }[] = [
            { id: node.id, label: '전체' },
          ];
          options.push({ id: node.id, label: node.labelKo });
          if (node.subcategories) {
            for (const sub of node.subcategories) {
              // Use fully-qualified IDs (e.g. "dining.cafe") for subcategories
              // to avoid duplicate option values when a subcategory ID also
              // exists as a standalone top-level category.
              const fqId = `${node.id}.${sub.id}`;
              options.push({ id: fqId, label: sub.labelKo });
              groupOptions.push({ id: fqId, label: sub.labelKo });
              parentMap.set(fqId, node.id);
            }
          }
          groups.push({ label: node.labelKo, options: groupOptions });
        }
        subcategoryToParent = parentMap;
        categoryOptions = options;
        categoryGroups = groups;
        categoryMap = new Map(options.map(c => [c.id, c.label]));
      } catch {
        // Fall back to hardcoded list
        categoryOptions = FALLBACK_CATEGORIES;
        categoryGroups = FALLBACK_GROUPS;
        categoryMap = new Map(FALLBACK_CATEGORIES.map(c => [c.id, c.label]));
      }
    })();
    return () => controller.abort();
  });

  // Sync from store when transactions change — re-sync on new upload (generation change)
  let lastSyncedGeneration = $state(0);

  // Read analysisStore.result once to get an atomic snapshot of both
  // generation and transactions. Reading .generation and .transactions
  // as separate reactive getter calls is not atomic — between them the
  // result backing store could change (e.g., during Astro View Transition
  // re-mounts). Deriving both values from the same snapshot ensures
  // consistency (C82-01).
  $effect(() => {
    const currentResult = analysisStore.result;
    const gen = analysisStore.generation;
    const txs = currentResult?.transactions ?? [];
    if (gen !== lastSyncedGeneration) {
      if (txs.length > 0) {
        editedTxs = txs.map(tx => ({ ...tx }));
      } else {
        // Clear stale transactions when the store is reset (C61-01).
        // Without this, editedTxs retains data from the previous analysis
        // after analysisStore.reset() sets transactions to [].
        editedTxs = [];
      }
      hasEdits = false;
      lastSyncedGeneration = gen;
    }
  });

  let displayTxs = $derived.by(() => {
    let list = editedTxs;
    if (filterUncategorized) {
      list = list.filter(tx => tx.category === 'uncategorized' || tx.confidence < 0.5);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(tx => {
        // Match against merchant name (English/Korean)
        if (tx.merchant.toLowerCase().includes(q)) return true;
        // Also match against category and subcategory labels (Korean)
        // e.g. searching "카페" or "cafe" finds all cafe-categorized transactions
        const catLabel = categoryMap.get(tx.category)?.toLowerCase() ?? '';
        if (catLabel.includes(q)) return true;
        if (tx.subcategory) {
          const subLabel = categoryMap.get(`${tx.category}.${tx.subcategory}`)?.toLowerCase() ?? '';
          if (subLabel.includes(q)) return true;
        }
        return false;
      });
    }
    return list;
  });

  let uncategorizedCount = $derived(
    editedTxs.filter(tx => tx.category === 'uncategorized' || tx.confidence < 0.5).length
  );

  function changeCategory(txId: string, newCategory: string) {
    const idx = editedTxs.findIndex(t => t.id === txId);
    if (idx !== -1) {
      const tx = editedTxs[idx];
      if (tx) {
        const parentCategory = subcategoryToParent.get(newCategory);
        let updated: CategorizedTx;
        if (parentCategory) {
          // User selected a subcategory (fully-qualified ID like "dining.cafe")
          // — set both parent category and subcategory. Clear rawCategory since
          // the manual override no longer corresponds to the bank-provided
          // classification (C79-01).
          const subId = newCategory.includes('.') ? newCategory.split('.')[1] ?? newCategory : newCategory;
          updated = { ...tx, category: parentCategory, subcategory: subId, confidence: 1.0, rawCategory: undefined };
        } else {
          // User selected a top-level category
          updated = { ...tx, category: newCategory, subcategory: undefined, confidence: 1.0, rawCategory: undefined };
        }
        // Svelte 5 $state tracks array index mutations — editedTxs[idx] = updated
        // is both correct and more performant than the previous editedTxs.map(...)
        // pattern which created an O(n) array copy per edit (C22-05/C39-02).
        editedTxs[idx] = updated;
        hasEdits = true;
      }
    }
  }

  async function applyEdits() {
    reoptimizing = true;
    try {
      await analysisStore.reoptimize(editedTxs);
      if (analysisStore.error) {
        // Reoptimize failed — keep edits visible so user can retry
        hasEdits = true;
      } else {
        hasEdits = false;
      }
    } finally {
      reoptimizing = false;
    }
  }
</script>

{#if editedTxs.length > 0}
  <div class="mt-4">
    <button
      class="flex w-full items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-[var(--color-bg)]"
      aria-expanded={expanded}
      aria-controls="tx-review-panel"
      data-testid="tx-review-toggle"
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
      <div id="tx-review-panel" data-testid="tx-review-panel" class="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
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

        <!-- Transaction list — overflow-x-auto lets narrow viewports scroll
             horizontally instead of overflowing the dashboard (C6UI-26). -->
        <div class="max-h-[400px] overflow-x-auto overflow-y-auto">
          <table class="w-full min-w-max text-xs">
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
                      disabled={reoptimizing}
                      value={tx.subcategory ? `${tx.category}.${tx.subcategory}` : tx.category}
                      aria-label={tx.merchant + " 카테고리"}
                      data-testid={`tx-category-select-${tx.id}`}
                      onchange={(e) => changeCategory(tx.id, (e.target as HTMLSelectElement).value)}
                      class="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-1 text-xs outline-none focus:border-[var(--color-primary)] cursor-pointer
                        {tx.category === 'uncategorized' ? 'border-red-300 bg-red-50 text-red-700' : tx.confidence < 0.5 ? 'border-amber-300 bg-amber-50 text-amber-700' : ''}"
                    >
                      {#each categoryGroups as group}
                        <optgroup label={group.label}>
                          {#each group.options as opt}
                            <option value={opt.id}>{opt.label}</option>
                          {/each}
                        </optgroup>
                      {/each}
                    </select>
                  </td>
                  <td class="px-3 py-2 text-center">
                    {#if tx.confidence >= 1.0}
                      <span class="inline-block rounded-full bg-green-100 dark:bg-green-900 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:text-green-400" title="키워드 정확 일치">정확</span>
                    {:else if tx.confidence >= 0.8}
                      <span class="inline-block rounded-full bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-400" title="키워드 부분 일치">높음</span>
                    {:else if tx.confidence >= 0.5}
                      <span class="inline-block rounded-full bg-amber-100 dark:bg-amber-900 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400" title="은행 분류 또는 YAML 키워드">보통</span>
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
