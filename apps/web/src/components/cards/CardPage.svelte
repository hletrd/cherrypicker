<script lang="ts">
  import { onMount } from 'svelte';
  import CardGrid from './CardGrid.svelte';
  import CardDetail from './CardDetail.svelte';
  import Icon from '../ui/Icon.svelte';
  import { getCardSummaryById } from '../../lib/cards.js';
  import {
    buildPageUrl,
    buildSkipLinkUrl,
  } from '../../lib/formatters.js';
  import {
    pushCardSelectionHistory,
    resolveCardSelectionQuery,
  } from '../../lib/card-navigation-state.js';

  const homeUrl = buildPageUrl('');

  let selectedCardId = $state<string | null>(null);
  let cardName = $state<string>('');
  let returnFocusCardId = $state<string | null>(null);
  let fetchGeneration = 0;
  let navigationGeneration = 0;
  let navigationController: AbortController | null = null;
  let listDocumentTitle = '카드 목록 | CherryPicker';

  $effect(() => {
    if (!selectedCardId) { cardName = ''; return; }
    const gen = ++fetchGeneration;
    const controller = new AbortController();
    getCardSummaryById(selectedCardId, { signal: controller.signal })
      .then(c => {
        if (!controller.signal.aborted && gen === fetchGeneration) {
          cardName = c?.nameKo ?? selectedCardId ?? '';
        }
      })
      .catch(() => {
        if (!controller.signal.aborted && gen === fetchGeneration) {
          cardName = selectedCardId ?? '';
        }
      });
    return () => { controller.abort(); };
  });

  function cancelSelectionSync() {
    navigationGeneration++;
    navigationController?.abort();
    navigationController = null;
  }

  function syncSkipLinkHref() {
    const skipLink = document.getElementById('skip-link');
    if (skipLink instanceof HTMLAnchorElement) {
      skipLink.setAttribute(
        'href',
        buildSkipLinkUrl(window.location.pathname, window.location.search),
      );
    }
  }

  function selectCard(id: string) {
    cancelSelectionSync();
    pushCardSelectionHistory(window.history, window.location, id);
    syncSkipLinkHref();
    returnFocusCardId = id;
    selectedCardId = id;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  function goBack() {
    cancelSelectionSync();
    returnFocusCardId = selectedCardId ?? returnFocusCardId;
    pushCardSelectionHistory(window.history, window.location, null);
    syncSkipLinkHref();
    selectedCardId = null;
    document.title = listDocumentTitle;
  }

  function handleDetailReady(name: string) {
    cardName = name;
    document.title = `${name} | CherryPicker`;
  }

  function handleFocusRestored() {
    returnFocusCardId = null;
  }

  onMount(() => {
    listDocumentTitle = document.title;
    const syncSelectionFromLocation = async () => {
      navigationController?.abort();
      const controller = new AbortController();
      navigationController = controller;
      const generation = ++navigationGeneration;
      const search = window.location.search;
      syncSkipLinkHref();

      try {
        const candidate = await resolveCardSelectionQuery(
          search,
          (cardId) => getCardSummaryById(cardId, {
            signal: controller.signal,
          }),
        );
        if (
          !controller.signal.aborted &&
          generation === navigationGeneration &&
          window.location.search === search
        ) {
          if (!candidate) {
            if (selectedCardId) returnFocusCardId = selectedCardId;
            selectedCardId = null;
            document.title = listDocumentTitle;
          } else {
            selectedCardId = candidate;
          }
        }
      } catch {
        if (
          !controller.signal.aborted &&
          generation === navigationGeneration &&
          window.location.search === search
        ) {
          if (selectedCardId) returnFocusCardId = selectedCardId;
          selectedCardId = null;
          document.title = listDocumentTitle;
        }
      } finally {
        if (navigationController === controller) {
          navigationController = null;
        }
      }
    };

    const handlePopState = () => {
      void syncSelectionFromLocation();
    };
    void syncSelectionFromLocation();
    window.addEventListener('popstate', handlePopState);
    return () => {
      cancelSelectionSync();
      window.removeEventListener('popstate', handlePopState);
    };
  });
</script>

{#if selectedCardId}
  <!-- Card detail view -->
  <nav aria-label="이동 경로" class="mb-6">
    <ol class="flex flex-wrap items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
      <li>
        <a href={homeUrl} class="transition-colors hover:text-[var(--color-primary-fg)]">홈</a>
      </li>
      <li class="select-none text-[var(--color-border)]">/</li>
      <li>
        <button
          type="button"
          class="transition-colors hover:text-[var(--color-primary-fg)] text-inherit bg-transparent border-none cursor-pointer p-0 font-inherit"
          onclick={goBack}
        >카드 목록</button>
      </li>
      <li class="select-none text-[var(--color-border)]">/</li>
      <li class="font-medium text-[var(--color-text)]" aria-current="page">
        {cardName || selectedCardId}
      </li>
    </ol>
  </nav>

  <div class="mb-4">
    <button
      class="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-primary-fg)]"
      onclick={goBack}
    >
      <Icon name="arrow-left" size={16} />
      목록으로
    </button>
  </div>

  <div class="animate-[slideUp_0.3s_ease_both]">
    <CardDetail cardId={selectedCardId} onReady={handleDetailReady} />
  </div>
{:else}
  <!-- Card grid view -->
  <div class="mb-8">
    <h1 class="text-3xl font-extrabold tracking-tight">카드 목록</h1>
    <p class="mt-2 text-[var(--color-text-muted)]">어떤 카드가 있는지 살펴보세요</p>
  </div>
  <CardGrid
    onSelectCard={selectCard}
    focusCardId={returnFocusCardId}
    onFocusRestored={handleFocusRestored}
  />
{/if}
