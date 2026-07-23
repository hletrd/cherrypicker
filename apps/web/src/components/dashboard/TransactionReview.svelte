<script module lang="ts">
  export interface TransactionTaxonomyNode {
    id: string;
    labelKo: string;
    subcategories?: readonly TransactionTaxonomyNode[];
  }

  export interface CategoryGroup {
    label: string;
    options: { id: string; label: string }[];
  }

  export interface TransactionTaxonomy {
    options: { id: string; label: string }[];
    groups: CategoryGroup[];
    labels: Map<string, string>;
    subcategoryToParent: Map<string, string>;
    canonicalize(selection: string): {
      category: string;
      subcategory: string | undefined;
    };
  }

  /**
   * Build every transaction-editor taxonomy view from the same hierarchy.
   * Fully qualified option IDs are UI-only; edits are converted back to the
   * canonical { category: parent, subcategory: child } pair before storage.
   */
  export function buildTransactionTaxonomy(
    nodes: readonly TransactionTaxonomyNode[],
  ): TransactionTaxonomy {
    const options: { id: string; label: string }[] = [];
    const groups: CategoryGroup[] = [];
    const labels = new Map<string, string>();
    const subcategoryToParent = new Map<string, string>();

    for (const node of nodes) {
      const groupOptions = [{
        id: node.id,
        label: node.id === 'uncategorized' ? node.labelKo : `${node.labelKo} 전체`,
      }];

      options.push({ id: node.id, label: node.labelKo });
      labels.set(node.id, node.labelKo);

      for (const subcategory of node.subcategories ?? []) {
        const qualifiedId = `${node.id}.${subcategory.id}`;
        const option = { id: qualifiedId, label: subcategory.labelKo };
        options.push(option);
        groupOptions.push(option);
        labels.set(qualifiedId, subcategory.labelKo);
        subcategoryToParent.set(qualifiedId, node.id);
      }

      groups.push({ label: node.labelKo, options: groupOptions });
    }

    return {
      options,
      groups,
      labels,
      subcategoryToParent,
      canonicalize(selection) {
        const parent = subcategoryToParent.get(selection);
        return parent
          ? {
              category: parent,
              subcategory: selection.slice(parent.length + 1),
            }
          : { category: selection, subcategory: undefined };
      },
    };
  }

  // Keep this label-only fallback aligned with the published category
  // hierarchy. It is available before hydration and when the artifact fails.
  export const FALLBACK_TRANSACTION_CATEGORIES: readonly TransactionTaxonomyNode[] = [
    {
      id: 'dining',
      labelKo: '외식',
      subcategories: [
        { id: 'restaurant', labelKo: '일반음식점' },
        { id: 'cafe', labelKo: '카페' },
        { id: 'fast_food', labelKo: '패스트푸드' },
        { id: 'delivery', labelKo: '배달' },
        { id: 'bakery', labelKo: '베이커리' },
      ],
    },
    {
      id: 'grocery',
      labelKo: '식료품/마트',
      subcategories: [
        { id: 'supermarket', labelKo: '대형마트' },
        { id: 'traditional_market', labelKo: '전통시장' },
        { id: 'online_grocery', labelKo: '온라인식품' },
        { id: 'local_shopping', labelKo: '지역상점' },
      ],
    },
    { id: 'convenience_store', labelKo: '편의점' },
    {
      id: 'public_transit',
      labelKo: '대중교통',
      subcategories: [
        { id: 'bus', labelKo: '버스' },
        { id: 'subway', labelKo: '지하철' },
        { id: 'taxi', labelKo: '택시' },
      ],
    },
    {
      id: 'transportation',
      labelKo: '교통/주유',
      subcategories: [
        { id: 'fuel', labelKo: '주유' },
        { id: 'parking', labelKo: '주차' },
        { id: 'toll', labelKo: '고속도로통행료' },
        { id: 'ev_charging', labelKo: '전기차 충전' },
        { id: 'car_maintenance', labelKo: '차량정비' },
        { id: 'shared_mobility', labelKo: '공유 모빌리티' },
        { id: 'rental', labelKo: '렌탈' },
      ],
    },
    {
      id: 'online_shopping',
      labelKo: '온라인쇼핑',
      subcategories: [
        { id: 'general', labelKo: '종합쇼핑몰' },
        { id: 'fashion', labelKo: '패션' },
        { id: 'simple_pay', labelKo: '간편결제' },
        { id: 'home_shopping', labelKo: '홈쇼핑' },
      ],
    },
    {
      id: 'offline_shopping',
      labelKo: '오프라인쇼핑',
      subcategories: [
        { id: 'department_store', labelKo: '백화점' },
        { id: 'beauty', labelKo: '미용' },
        { id: 'electronics', labelKo: '전자제품' },
        { id: 'home_living', labelKo: '홈/리빙' },
        { id: 'daiso', labelKo: '다이소' },
      ],
    },
    { id: 'telecom', labelKo: '통신' },
    { id: 'insurance', labelKo: '보험' },
    {
      id: 'medical',
      labelKo: '의료',
      subcategories: [
        { id: 'hospital', labelKo: '병원' },
        { id: 'pharmacy', labelKo: '약국' },
      ],
    },
    {
      id: 'education',
      labelKo: '교육',
      subcategories: [
        { id: 'academy', labelKo: '학원' },
        { id: 'books', labelKo: '도서' },
        { id: 'language_exam', labelKo: '어학/시험' },
      ],
    },
    {
      id: 'entertainment',
      labelKo: '여가/문화',
      subcategories: [
        { id: 'movie', labelKo: '영화' },
        { id: 'streaming', labelKo: '스트리밍' },
        { id: 'gaming', labelKo: '게임' },
      ],
    },
    {
      id: 'sports',
      labelKo: '스포츠',
      subcategories: [{ id: 'golf', labelKo: '골프' }],
    },
    {
      id: 'travel',
      labelKo: '여행',
      subcategories: [
        { id: 'airline', labelKo: '항공' },
        { id: 'hotel', labelKo: '호텔/숙박' },
        { id: 'travel_agency', labelKo: '여행사' },
      ],
    },
    { id: 'subscription', labelKo: '구독' },
    {
      id: 'utilities',
      labelKo: '공과금',
      subcategories: [
        { id: 'electricity', labelKo: '전기요금' },
        { id: 'gas', labelKo: '가스요금' },
        { id: 'water', labelKo: '수도요금' },
        { id: 'apartment_mgmt', labelKo: '관리비' },
      ],
    },
    { id: 'uncategorized', labelKo: '기타' },
  ];
</script>

<script lang="ts">
  import { analysisStore } from '../../lib/store.svelte.js';
  import { formatWon } from '../../lib/formatters.js';
  import Icon from '../ui/Icon.svelte';
  import type { CategorizedTx } from '../../lib/analysis-result.js';
  import { onMount, tick } from 'svelte';
  import { loadCategories } from '../../lib/cards.js';

  const fallbackTaxonomy = buildTransactionTaxonomy(FALLBACK_TRANSACTION_CATEGORIES);
  // Seed a complete option set synchronously. The fetched artifact replaces the
  // whole object atomically rather than updating groups and maps independently.
  let taxonomy = $state<TransactionTaxonomy>(fallbackTaxonomy);

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
        // loadCategories() returns [] when its request was aborted. Preserve the
        // already visible fallback instead of replacing it with an empty list.
        if (nodes.length === 0) return;
        taxonomy = buildTransactionTaxonomy(nodes);
      } catch (error) {
        if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) return;
        if (typeof console !== 'undefined') console.debug('[cherrypicker] Category options fetch failed, using fallback list');
        taxonomy = fallbackTaxonomy;
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
        const catLabel = taxonomy.labels.get(tx.category)?.toLowerCase() ?? '';
        if (catLabel.includes(q)) return true;
        if (tx.subcategory) {
          const subLabel = taxonomy.labels.get(`${tx.category}.${tx.subcategory}`)?.toLowerCase() ?? '';
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

  async function changeCategory(
    txId: string,
    newCategory: string,
    selectElement: HTMLSelectElement,
  ) {
    const idx = editedTxs.findIndex(t => t.id === txId);
    if (idx !== -1) {
      const tx = editedTxs[idx];
      if (tx) {
        const visibleTxIds = displayTxs.map(visibleTx => visibleTx.id);
        const visibleIndex = visibleTxIds.indexOf(txId);
        const hadFocus = document.activeElement === selectElement;
        const panel = selectElement.closest<HTMLElement>('[data-testid="tx-review-panel"]');
        const categoryPair = taxonomy.canonicalize(newCategory);
        // Fully qualified option IDs are converted back to the analyzer's
        // parent/subcategory fields. Manual edits no longer correspond to the
        // original bank-provided classification, so clear rawCategory.
        const updated: CategorizedTx = {
          ...tx,
          ...categoryPair,
          confidence: 1.0,
          rawCategory: undefined,
        };
        // Svelte 5 $state tracks array index mutations — editedTxs[idx] = updated
        // is both correct and more performant than the previous editedTxs.map(...)
        // pattern which created an O(n) array copy per edit (C22-05/C39-02).
        editedTxs[idx] = updated;
        hasEdits = true;

        // A category/search filter can remove the edited keyed row immediately.
        // If its select owned focus, move to the next visible row, then the
        // previous row, and finally the newly available apply action.
        if (hadFocus && panel) {
          await tick();
          if (!selectElement.isConnected) {
            const candidates = [
              ...visibleTxIds.slice(visibleIndex + 1),
              ...visibleTxIds.slice(0, Math.max(visibleIndex, 0)).reverse(),
            ];
            const remainingSelects = Array.from(
              panel.querySelectorAll<HTMLSelectElement>('[data-tx-category-select]'),
            );
            const nextSelect = candidates
              .map(candidateId => remainingSelects.find(
                candidate => candidate.dataset.txId === candidateId,
              ))
              .find((candidate): candidate is HTMLSelectElement => candidate !== undefined);
            (nextSelect ?? panel.querySelector<HTMLButtonElement>('[data-testid="tx-apply-edits"]'))?.focus();
          }
        }
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
              aria-label="가맹점 검색"
              class="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs outline-none focus:border-[var(--color-focus)] focus:ring-2 focus:ring-[var(--color-focus)]"
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
              data-testid="tx-apply-edits"
              class="rounded-lg bg-[var(--color-primary-fill)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-primary-fill-hover)] disabled:opacity-50 transition-colors"
            >
              {reoptimizing ? '재계산 중' : '변경 적용'}
            </button>
          {/if}
        </div>

        <!-- Transaction list — overflow-x-auto lets narrow viewports scroll
             horizontally instead of overflowing the dashboard (C6UI-26). -->
        <p id="tx-review-scroll-hint" class="px-3 pt-3 text-xs text-[var(--color-text-muted)] sm:hidden">
          표를 좌우로 스크롤할 수 있어요
        </p>
        <!-- The overflow region needs direct focus so keyboard users can scroll it. -->
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <div
          class="max-h-[400px] overflow-x-auto overflow-y-auto focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--color-focus)]"
          role="region"
          aria-label="거래 내역 분류 표"
          aria-describedby="tx-review-scroll-hint"
          tabindex="0"
          data-testid="tx-review-scroll-region"
        >
          <table class="w-full min-w-max text-xs">
            <thead class="sticky top-0 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
              <tr class="text-left text-[var(--color-text-muted)]">
                <th scope="col" class="px-3 py-2 font-medium">날짜</th>
                <th scope="col" class="px-3 py-2 font-medium">가맹점</th>
                <th scope="col" class="px-3 py-2 text-right font-medium">금액</th>
                <th scope="col" class="px-3 py-2 font-medium">분류</th>
                <th scope="col" class="px-3 py-2 text-center font-medium">확신도</th>
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
                      data-tx-category-select
                      data-tx-id={tx.id}
                      onchange={(e) => changeCategory(tx.id, e.currentTarget.value, e.currentTarget)}
                      class="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-1 text-xs outline-none focus:border-[var(--color-focus)] focus:ring-2 focus:ring-[var(--color-focus)] cursor-pointer
                        {tx.category === 'uncategorized' ? 'border-red-300 bg-red-50 text-red-700' : tx.confidence < 0.5 ? 'border-amber-300 bg-amber-50 text-amber-700' : ''}"
                    >
                      {#each taxonomy.groups as group}
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
                      <span class="semantic-badge-success inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium" title="키워드 정확 일치">정확</span>
                    {:else if tx.confidence >= 0.8}
                      <span class="semantic-badge-confidence-high inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium" title="키워드 부분 일치">높음</span>
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
