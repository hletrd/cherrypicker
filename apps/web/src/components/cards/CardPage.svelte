<script lang="ts">
  import { onMount } from 'svelte';
  import CardGrid from './CardGrid.svelte';
  import CardDetail from './CardDetail.svelte';
  import Icon from '../ui/Icon.svelte';

  const base = import.meta.env.BASE_URL ?? '/';

  let selectedCardId = $state<string | null>(null);

  function selectCard(id: string) {
    selectedCardId = id;
    window.location.hash = id;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goBack() {
    selectedCardId = null;
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
        {selectedCardId}
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
    <p class="mt-2 text-[var(--color-text-muted)]">등록된 카드별 혜택을 둘러보세요</p>
  </div>
  <CardGrid onSelectCard={selectCard} />
{/if}
