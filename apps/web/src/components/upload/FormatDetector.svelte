<script lang="ts">
  interface Props {
    fileName: string;
    detectedBank: string | null;
    detectedFormat: string;
  }

  let { fileName, detectedBank, detectedFormat }: Props = $props();

  const bankNames: Record<string, string> = {
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

  const formatLabels: Record<string, string> = {
    csv: 'CSV',
    xlsx: 'Excel',
    pdf: 'PDF',
  };
</script>

<div class="flex items-center gap-3 rounded-lg bg-blue-50 p-3 text-sm">
  <span class="text-blue-600">🔍</span>
  <div>
    <span class="font-medium">{fileName}</span>
    <span class="text-[var(--color-text-muted)]">
      — {formatLabels[detectedFormat] ?? detectedFormat} 형식
      {#if detectedBank}
        · {bankNames[detectedBank] ?? detectedBank} 감지됨
      {:else}
        · 카드사 자동 인식 중
      {/if}
    </span>
  </div>
</div>
