<script lang="ts">
  import { onMount } from 'svelte';
  import CardGrid from './CardGrid.svelte';
  import CardDetail from './CardDetail.svelte';
  import Icon from '../ui/Icon.svelte';
  import { getCardById } from '../../lib/cards.js';

  const base = import.meta.env.BASE_URL ?? '/';

  let selectedCardId = $state<string | null>(null);
  let cardName = $state<string>('');
  let fetchGeneration = 0;

  $effect(() => {
    if (!selectedCardId) { cardName = ''; return; }
    const gen = ++fetchGeneration;
    const controller = new AbortController();
    getCardById(selectedCardId, { signal: controller.signal })
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

  function selectCard(id: string) {
    selectedCardId = id;
    window.location.hash = id;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goBack() {
    selectedCardId = null;
    // Clear the hash to return to the card list view. Using hash assignment
    // instead of replaceState so the navigation is added to browser history,
    // enabling the back button to return to previously viewed cards (C19-03).
    window.location.hash = '';
  }

  onMount(() => {
    // Read card ID from URL hash on load
    const hash = window.location.hash.slice(1);
    if (hash) selectedCardId = hash;

    // Listen for browser back/forward
    const handleHashChange = () => {
      const h = window.location.hash.slice(1);
      selectedCardId = h || null;
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  });
</script>

{#if selectedCardId}
  <!-- Card detail view -->
  <nav aria-label="breadcrumb" class="mb-6">
    <ol class="flex flex-wrap items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
      <li>
        <a href={`${base}`} class="transition-colors hover:text-[var(--color-primary)]">홈</a>
      </li>
      <li class="select-none text-[var(--color-border)]">/</li>
      <li>
        <button
          class="transition-colors hover:text-[var(--color-primary)] cursor-pointer"
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
      class="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-primary)]"
      onclick={goBack}
    >
      <Icon name="arrow-left" size={16} />
      목록으로
    </button>
  </div>

  <div class="animate-[slideUp_0.3s_ease_both]">
    <CardDetail cardId={selectedCardId} />
  </div>
{:else}
  <!-- Card grid view -->
  <div class="mb-8">
    <h1 class="text-3xl font-extrabold tracking-tight">카드 목록</h1>
    <p class="mt-2 text-[var(--color-text-muted)]">어떤 카드가 있는지 살펴보세요</p>
  </div>
  <CardGrid onSelectCard={selectCard} />
{/if}
