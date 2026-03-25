<script lang="ts">
  import { onDestroy } from 'svelte';
  import { analysisStore } from '../../lib/store.svelte.js';
  import { formatFileSize } from '../../lib/formatters.js';
  import Icon from '../ui/Icon.svelte';

  let navigateTimeout: ReturnType<typeof setTimeout> | null = null;
  onDestroy(() => { if (navigateTimeout) clearTimeout(navigateTimeout); });

  let isDragOver = $state(false);
  let uploadedFile = $state<File | null>(null);
  let fileInputEl = $state<HTMLInputElement | null>(null);
  let uploadStatus = $state<'idle' | 'uploading' | 'success' | 'error'>('idle');
  let errorMessage = $state('');
  let bank = $state('');
  let previousSpending = $state<string>('');

  // Step 1=파일선택, 2=카드사선택, 3=분석중, 4=완료
  let currentStep = $derived.by(() => {
    if (uploadStatus === 'success') return 4;
    if (uploadStatus === 'uploading') return 3;
    if (uploadedFile) return 2;
    return 1;
  });

  const STEPS = ['파일 선택', '카드사 선택', '분석 중', '완료'];

  const ACCEPTED_TYPES = [
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/pdf',
  ];
  const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx', '.xls', '.pdf'];

  const ALL_BANKS: { value: string; label: string }[] = [
    { value: 'hyundai', label: '현대카드' },
    { value: 'kb', label: 'KB국민' },
    { value: 'samsung', label: '삼성카드' },
    { value: 'shinhan', label: '신한카드' },
    { value: 'lotte', label: '롯데카드' },
    { value: 'hana', label: '하나카드' },
    { value: 'woori', label: '우리카드' },
    { value: 'ibk', label: 'IBK기업' },
    { value: 'nh', label: 'NH농협' },
    { value: 'bc', label: 'BC카드' },
    { value: 'kakao', label: '카카오뱅크' },
    { value: 'toss', label: '토스뱅크' },
    { value: 'kbank', label: '케이뱅크' },
    { value: 'bnk', label: 'BNK경남' },
    { value: 'dgb', label: 'DGB대구' },
    { value: 'suhyup', label: '수협은행' },
    { value: 'jb', label: '전북은행' },
    { value: 'kwangju', label: '광주은행' },
    { value: 'jeju', label: '제주은행' },
    { value: 'sc', label: 'SC제일' },
    { value: 'mg', label: '새마을금고' },
    { value: 'cu', label: '신협' },
    { value: 'kdb', label: 'KDB산업' },
    { value: 'epost', label: '우체국' },
  ];

  function fileIconName(file: File): string {
    const name = file.name.toLowerCase();
    if (name.endsWith('.pdf')) return 'document-text';
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) return 'table-cells';
    return 'document-text';
  }

  function isValidFile(file: File): boolean {
    if (ACCEPTED_TYPES.includes(file.type)) return true;
    return ACCEPTED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragOver = false;
    const file = e.dataTransfer?.files[0];
    if (file && isValidFile(file)) {
      uploadedFile = file;
      uploadStatus = 'idle';
      errorMessage = '';
    } else {
      errorMessage = 'CSV, Excel, PDF 파일만 지원합니다';
      uploadStatus = 'error';
    }
  }

  function handleFileInput(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file && isValidFile(file)) {
      uploadedFile = file;
      uploadStatus = 'idle';
      errorMessage = '';
    } else if (file) {
      errorMessage = 'CSV, Excel, PDF 파일만 지원합니다';
      uploadStatus = 'error';
    }
  }

  async function handleUpload() {
    if (!uploadedFile) return;
    uploadStatus = 'uploading';
    errorMessage = '';

    try {
      await analysisStore.analyze(uploadedFile, {
        bank: bank || undefined,
        previousMonthSpending: previousSpending ? parseInt(previousSpending, 10) : undefined,
      });

      uploadStatus = 'success';

      navigateTimeout = setTimeout(() => {
        window.location.href = import.meta.env.BASE_URL + 'dashboard';
      }, 1200);
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : '분석 실패';
      uploadStatus = 'error';
    }
  }

  function handleRetry() {
    uploadStatus = 'idle';
    errorMessage = '';
  }
</script>

<div class="flex flex-col gap-5">

  <!-- Step indicator -->
  <div class="flex items-center justify-center gap-0">
    {#each STEPS as step, i}
      {@const stepNum = i + 1}
      {@const isActive = currentStep === stepNum}
      {@const isDone = currentStep > stepNum}
      <div class="flex items-center">
        <div class="flex flex-col items-center gap-1">
          <div
            class="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all duration-300
              {isDone
                ? 'bg-green-500 text-white'
                : isActive
                  ? 'bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/30'
                  : 'bg-gray-200 text-gray-400'}"
          >
            {#if isDone}
              <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
              </svg>
            {:else}
              {stepNum}
            {/if}
          </div>
          <span
            class="text-xs transition-colors duration-200
              {isActive ? 'font-semibold text-[var(--color-primary)]' : isDone ? 'text-green-600' : 'text-gray-400'}"
          >
            {step}
          </span>
        </div>
        {#if i < STEPS.length - 1}
          <div
            class="mb-4 h-px w-8 transition-colors duration-300 sm:w-12
              {currentStep > stepNum ? 'bg-green-400' : 'bg-gray-200'}"
          ></div>
        {/if}
      </div>
    {/each}
  </div>

  <!-- Drop zone -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="rounded-2xl border-2 p-10 text-center transition-all duration-200
      {isDragOver
        ? 'animate-pulse border-[var(--color-primary)] bg-blue-50 shadow-inner'
        : uploadedFile
          ? 'border-green-400 bg-green-50'
          : 'border-dashed border-[var(--color-border)] hover:border-[var(--color-primary)]/50'}"
    ondragover={(e) => { e.preventDefault(); isDragOver = true; }}
    ondragleave={() => (isDragOver = false)}
    ondrop={handleDrop}
  >
    {#if uploadStatus === 'success'}
      <!-- Success state with checkmark -->
      <div class="flex flex-col items-center gap-3">
        <div class="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 animate-bounce">
          <svg class="h-8 w-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p class="text-base font-semibold text-green-700">분석 완료</p>
        <p class="text-sm text-green-600">대시보드로 이동할게요</p>
      </div>
    {:else if uploadedFile}
      <div class="flex flex-col items-center gap-2">
        <div class="text-[var(--color-text-muted)]">
          <Icon name={fileIconName(uploadedFile)} size={40} />
        </div>
        <p class="text-base font-semibold">{uploadedFile.name}</p>
        <p class="text-sm text-[var(--color-text-muted)]">{formatFileSize(uploadedFile.size)}</p>
        <button
          class="mt-1 text-sm text-[var(--color-primary)] hover:underline"
          onclick={() => { uploadedFile = null; uploadStatus = 'idle'; errorMessage = ''; if (fileInputEl) fileInputEl.value = ''; }}
        >
          다른 파일 선택
        </button>
      </div>
    {:else}
      <div class="flex flex-col items-center gap-2">
        <div class="text-[var(--color-text-muted)]">
          <Icon name={isDragOver ? 'folder-open' : 'arrow-up-tray'} size={40} />
        </div>
        <p class="mt-1 text-base font-medium">카드 명세서를 끌어다 놓으세요</p>
        <p class="text-sm text-[var(--color-text-muted)]">CSV, Excel, PDF 지원</p>
        <label class="mt-3 inline-block cursor-pointer rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[var(--color-primary-dark)] transition-colors">
          파일 선택
          <input type="file" class="hidden" accept=".csv,.xlsx,.xls,.pdf" onchange={handleFileInput} bind:this={fileInputEl} />
        </label>
      </div>
    {/if}
  </div>

  <!-- Bank selector + Upload (shown after file selected, before success) -->
  {#if uploadedFile && uploadStatus !== 'success'}
    <div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-4">
      <div>
        <p class="mb-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">카드사를 고르면 더 정확해요</p>
        <div class="flex flex-wrap gap-2">
          <!-- Auto-detect pill -->
          <button
            class="rounded-full border px-3 py-1.5 text-xs font-medium transition-all
              {bank === ''
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white shadow-sm'
                : 'border-[var(--color-border)] bg-transparent text-[var(--color-text-muted)] hover:border-gray-400'}"
            onclick={() => (bank = '')}
          >
            자동 인식
          </button>
          {#each ALL_BANKS as b}
            <button
              class="rounded-full border px-3 py-1.5 text-xs font-medium transition-all
                {bank === b.value
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white shadow-sm'
                  : 'border-[var(--color-border)] bg-transparent text-[var(--color-text-muted)] hover:border-gray-400'}"
              onclick={() => (bank = b.value)}
            >
              {b.label}
            </button>
          {/each}
        </div>
      </div>

      <!-- Previous month spending input -->
      <div>
        <p class="mb-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">전월 카드 이용액</p>
        <div class="relative">
          <input
            type="number"
            bind:value={previousSpending}
            placeholder="500,000"
            min="0"
            step="10000"
            class="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all"
          />
          <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-text-muted)]">원</span>
        </div>
        <p class="mt-1 text-xs text-[var(--color-text-muted)]">입력하지 않으면 50만원으로 계산해요</p>
      </div>

      <!-- Upload button -->
      <button
        onclick={handleUpload}
        disabled={uploadStatus === 'uploading'}
        class="w-full rounded-xl py-3 text-sm font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-60
          {uploadStatus === 'uploading'
            ? 'bg-[var(--color-primary)]/80'
            : 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] shadow-sm hover:shadow-md'}"
      >
        {#if uploadStatus === 'uploading'}
          <span class="flex items-center justify-center gap-2">
            <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            분석하는 중
          </span>
        {:else}
          분석 시작
        {/if}
      </button>

      <!-- Progress bar during upload -->
      {#if uploadStatus === 'uploading'}
        <div class="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
          <div class="h-full animate-[loading_1.5s_ease-in-out_infinite] rounded-full bg-[var(--color-primary)]"
            style="width: 60%;"></div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Error state -->
  {#if uploadStatus === 'error'}
    <div class="flex items-start gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700 border border-red-200">
      <svg class="mt-0.5 h-5 w-5 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
      <div class="flex-1">
        <p class="font-medium">문제가 생겼어요</p>
        <p class="mt-0.5 text-red-600">{errorMessage}</p>
      </div>
      <button
        class="shrink-0 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 transition-colors"
        onclick={handleRetry}
      >
        다시 시도
      </button>
    </div>
  {/if}
</div>
