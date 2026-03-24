<script lang="ts">
  interface CardInfo {
    id: string;
    issuer: string;
    name: string;
    nameKo: string;
    annualFee: number;
    topBenefit: string;
  }

  let cards = $state<CardInfo[]>([]);
  let loading = $state(true);
  let filterIssuer = $state('');

  const issuerNames: Record<string, string> = {
    hyundai: '현대카드',
    kb: 'KB국민카드',
    samsung: '삼성카드',
    shinhan: '신한카드',
    lotte: '롯데카드',
    hana: '하나카드',
    woori: '우리카드',
    ibk: 'IBK기업은행',
    nh: 'NH농협카드',
    bc: 'BC카드',
  };

  function formatWon(amount: number): string {
    return amount.toLocaleString('ko-KR') + '원';
  }

  let filteredCards = $derived(
    filterIssuer ? cards.filter((c) => c.issuer === filterIssuer) : cards,
  );

  $effect(() => {
    // TODO: fetch from /api/cards
    loading = false;
    cards = [
      { id: 'hyundai-the-green-edition2', issuer: 'hyundai', name: 'the Green Edition2', nameKo: '더 그린 에디션2', annualFee: 15000, topBenefit: '대중교통 10%' },
    ];
  });
</script>

<div class="flex flex-col gap-6">
  <div class="flex gap-2">
    <button
      class="rounded-lg px-3 py-1.5 text-sm {filterIssuer === '' ? 'bg-[var(--color-primary)] text-white' : 'bg-gray-100'}"
      onclick={() => (filterIssuer = '')}
    >
      전체
    </button>
    {#each Object.entries(issuerNames) as [id, name]}
      <button
        class="rounded-lg px-3 py-1.5 text-sm {filterIssuer === id ? 'bg-[var(--color-primary)] text-white' : 'bg-gray-100 hover:bg-gray-200'}"
        onclick={() => (filterIssuer = id)}
      >
        {name}
      </button>
    {/each}
  </div>

  {#if loading}
    <div class="flex h-48 items-center justify-center text-[var(--color-text-muted)]">로딩 중...</div>
  {:else if filteredCards.length === 0}
    <div class="flex h-48 items-center justify-center text-[var(--color-text-muted)]">
      등록된 카드가 없습니다
    </div>
  {:else}
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each filteredCards as card}
        <a
          href="/cards/{card.id}"
          class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 transition-shadow hover:shadow-md"
        >
          <div class="text-xs text-[var(--color-text-muted)]">{issuerNames[card.issuer]}</div>
          <div class="mt-1 text-lg font-semibold">{card.nameKo}</div>
          <div class="mt-1 text-sm text-[var(--color-text-muted)]">{card.name}</div>
          <div class="mt-4 flex items-center justify-between">
            <span class="text-sm">연회비 {formatWon(card.annualFee)}</span>
            <span class="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">{card.topBenefit}</span>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>
