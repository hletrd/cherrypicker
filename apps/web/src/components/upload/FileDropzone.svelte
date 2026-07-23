<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { analysisStore } from '../../lib/store.svelte.js';
  import { formatFileSize, buildPageUrl } from '../../lib/formatters.js';
  import { detectBankFromText } from '../../lib/parser/detect.js';
  import type { BankId } from '../../lib/parser/types.js';
  import {
    STATEMENT_FILE_ACCEPT,
    SUPPORTED_STATEMENT_FORMAT_LABELS,
  } from '../../lib/supported-formats.js';
  import {
    MAX_PREVIOUS_SPENDING_KRW,
    validatePreviousSpending,
  } from '../../lib/upload-validation.js';
  import {
    LatestFileParseRun,
    type FileParseProgress,
  } from '../../lib/file-parse-queue.js';
  import {
    MAX_UPLOAD_FILE_BYTES,
    MAX_UPLOAD_FILE_COUNT,
    MAX_UPLOAD_TOTAL_BYTES,
    admitUploadFiles,
  } from '../../lib/upload-admission.js';
  import Icon from '../ui/Icon.svelte';

  const analysisRuns = new LatestFileParseRun();
  onDestroy(() => {
    analysisRuns.cancel();
    analysisStore.cancelAnalysis();
  });

  // Flag-based beforeunload guard: survives Astro View Transition remounts
  // because the listener is registered once and simply checks a flag (C6UI-16).
  let isBlockingNavigation = $state(false);
  function beforeUnloadGuard(e: BeforeUnloadEvent): string | undefined {
    if (!isBlockingNavigation) return;
    const msg = '분석이 진행 중이에요. 페이지를 벗어나면 분석 결과가 사라져요.';
    e.preventDefault();
    e.returnValue = msg; // legacy Chromium
    return msg;
  }
  onMount(() => {
    window.addEventListener('beforeunload', beforeUnloadGuard);
    return () => {
      window.removeEventListener('beforeunload', beforeUnloadGuard);
    };
  });

  // Page-wide drag & drop: 화면 아무 데나 파일을 던져도 작동
  // Active guard prevents stale handlers from mutating isDragOver after
  // the component is unmounted during Astro View Transitions (C37-03).
  onMount(() => {
    let active = true;
    let dragCount = 0;
    function onDragEnter(e: DragEvent) {
      if (!active) return;
      e.preventDefault();
      dragCount++;
      if (dragCount === 1) isDragOver = true;
    }
    function onDragLeave(e: DragEvent) {
      if (!active) return;
      e.preventDefault();
      dragCount--;
      if (dragCount <= 0) { dragCount = 0; isDragOver = false; }
    }
    function onDragOver(e: DragEvent) { if (!active) return; e.preventDefault(); }
    async function onPageDrop(e: DragEvent) {
      if (!active) return;
      e.preventDefault();
      dragCount = 0;
      isDragOver = false;
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const hasErrors = addFiles(Array.from(files));
        if (hasErrors) {
          await focusRetryAction();
        } else {
          await focusFileAction(Math.max(0, uploadedFiles.length - 1));
        }
      }
    }
    document.addEventListener('dragenter', onDragEnter);
    document.addEventListener('dragleave', onDragLeave);
    document.addEventListener('dragover', onDragOver);
    document.addEventListener('drop', onPageDrop);
    return () => {
      active = false;
      document.removeEventListener('dragenter', onDragEnter);
      document.removeEventListener('dragleave', onDragLeave);
      document.removeEventListener('dragover', onDragOver);
      document.removeEventListener('drop', onPageDrop);
    };
  });

  let isDragOver = $state(false);
  let uploadedFiles = $state<File[]>([]);
  let uploadRootEl = $state<HTMLDivElement | null>(null);
  let primaryFileInputEl = $state<HTMLInputElement | null>(null);
  let addFileInputEl = $state<HTMLInputElement | null>(null);
  let submitButtonEl = $state<HTMLButtonElement | null>(null);
  let retryButtonEl = $state<HTMLButtonElement | null>(null);
  let dashboardButtonEl = $state<HTMLButtonElement | null>(null);
  let uploadStatus = $state<'idle' | 'uploading' | 'success' | 'error'>('idle');
  let analysisProgress = $state<FileParseProgress>({ completed: 0, total: 0 });
  let errorMessages = $state<string[]>([]);
  let bank = $state('');
  let previousSpending = $state<string>('');
  let previousSpendingError = $state<string | null>(null);
  let previousSpendingTouched = $state(false);
  let previousSpendingInputEl = $state<HTMLInputElement | null>(null);
  let showAllBanks = $state(false);
  let detectedBankId = $state<BankId | null>(null);
  let detectedBankLabel = $derived(() => {
    if (!detectedBankId) return '';
    const entry = ALL_BANKS.find(b => b.value === detectedBankId);
    return entry ? entry.label : '';
  });

  // Step 1=파일선택, 2=카드사선택, 3=분석중, 4=완료
  let currentStep = $derived.by(() => {
    if (uploadStatus === 'success') return 4;
    if (uploadStatus === 'uploading') return 3;
    if (uploadedFiles.length > 0) return 2;
    return 1;
  });
  let uploadStatusMessage = $derived.by(() => {
    if (uploadStatus === 'uploading') {
      return `파일을 분석하는 중이에요. ${analysisProgress.completed}/${analysisProgress.total} 완료`;
    }
    if (uploadStatus === 'success') {
      return analysisStore.result?.parseErrors.length
        ? '분석이 끝났어요. 확인할 항목이 있어요. 대시보드 보기 버튼을 눌러 결과를 확인하세요.'
        : '분석이 끝났어요. 대시보드 보기 버튼을 눌러 결과를 확인하세요.';
    }
    if (uploadStatus === 'error') {
      return `파일을 처리하지 못했어요. ${errorMessages.join(' ')}`;
    }
    if (uploadedFiles.length > 0) {
      return `${uploadedFiles.length}개 파일을 선택했어요. 분석 설정을 확인하세요.`;
    }
    return '분석할 카드 명세서 파일을 선택하세요.';
  });

  const STEPS = ['파일 선택', '카드사 선택', '분석 중', '완료'];

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

  // Top 8 banks shown by default; rest revealed via "더보기" button
  const TOP_BANKS = ALL_BANKS.slice(0, 8);
  const displayedBanks = $derived(showAllBanks ? ALL_BANKS : TOP_BANKS);

  function fileIconName(file: File): string {
    const name = file.name.toLowerCase();
    if (name.endsWith('.pdf')) return 'document-text';
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) return 'table-cells';
    if (name.endsWith('.json') || name.endsWith('.ofx') || name.endsWith('.qfx') || name.endsWith('.html') || name.endsWith('.htm')) return 'document-chart';
    return 'document-text';
  }

  function invalidateAnalysisOwnership(): void {
    analysisRuns.cancel();
    analysisStore.cancelAnalysis();
    analysisProgress = { completed: 0, total: 0 };
    isBlockingNavigation = false;
    if (uploadStatus === 'uploading') {
      uploadStatus = 'idle';
    }
  }

  function beginAdmittedFileMutation(): void {
    invalidateAnalysisOwnership();
  }

  /** Read the first uploaded file's text and run bank detection.
   *  Only reads enough for detection (first ~4KB) to avoid loading
   *  large files entirely into memory. */
  async function detectBankFromFile(): Promise<void> {
    if (uploadedFiles.length === 0) {
      detectedBankId = null;
      return;
    }
    try {
      const file = uploadedFiles[0]!;
      // For PDF files, text extraction requires the full parser — skip
      // quick detection since the parser will detect the bank anyway.
      if (file.name.toLowerCase().endsWith('.pdf')) {
        detectedBankId = null;
        return;
      }
      const blob = file.slice(0, 4096);
      const text = await blob.text();
      detectedBankId = detectBankFromText(text);
    } catch {
      // Detection failure is non-critical — just don't show a hint
      detectedBankId = null;
    }
  }

  function addFiles(newFiles: File[]): boolean {
    const admission = admitUploadFiles(uploadedFiles, newFiles);
    // Add valid files first
    if (admission.accepted.length > 0) {
      // Admission is the mutation boundary. It invalidates both the analysis
      // run before the selected files change.
      beginAdmittedFileMutation();
      uploadedFiles = [...uploadedFiles, ...admission.accepted];
      uploadStatus = 'idle';
      errorMessages = [];
      // Auto-detect bank from first file content (non-blocking)
      detectBankFromFile();
    }
    // Show individual file errors — accumulate ALL error types so the user
    // can see all issues at once instead of discovering them one retry at a
    // time (C72-04).
    const errorParts: string[] = [];
    if (admission.oversized.length > 0) {
      errorParts.push(
        `파일 크기는 ${formatFileSize(MAX_UPLOAD_FILE_BYTES)} 이하여야 합니다 (초과: ${admission.oversized.map((file) => `${file.name} (${formatFileSize(file.size)})`).join(', ')})`,
      );
    }
    if (admission.unsupported.length > 0) {
      errorParts.push(`${SUPPORTED_STATEMENT_FORMAT_LABELS} 파일만 지원합니다 (제외됨: ${admission.unsupported.map((file) => file.name).join(', ')})`);
    }
    if (admission.duplicates.length > 0) {
      errorParts.push(`같은 파일이 이미 있어요 (제외됨: ${admission.duplicates.map((file) => file.name).join(', ')})`);
    }
    if (admission.overAggregateBytes.length > 0) {
      errorParts.push(
        `전체 파일 크기는 ${formatFileSize(MAX_UPLOAD_TOTAL_BYTES)} 이하여야 합니다 (제외됨: ${admission.overAggregateBytes.map((file) => file.name).join(', ')})`,
      );
    }
    if (admission.overFileCount.length > 0) {
      errorParts.push(
        `파일은 최대 ${MAX_UPLOAD_FILE_COUNT}개까지 추가할 수 있어요 (제외됨: ${admission.overFileCount.map((file) => file.name).join(', ')})`,
      );
    }
    if (errorParts.length > 0) {
      errorMessages = errorParts;
      uploadStatus = 'error';
    }
    return errorParts.length > 0;
  }

  async function focusFileAction(index: number): Promise<void> {
    await tick();
    const removeButtons = uploadRootEl?.querySelectorAll<HTMLButtonElement>(
      '[data-upload-file-remove]',
    );
    if (removeButtons?.length) {
      removeButtons[Math.min(index, removeButtons.length - 1)]?.focus();
    } else {
      primaryFileInputEl?.focus();
    }
  }

  async function focusRetryAction(): Promise<void> {
    await tick();
    retryButtonEl?.focus();
  }

  async function removeFile(index: number) {
    beginAdmittedFileMutation();
    uploadedFiles = uploadedFiles.filter((_, i) => i !== index);
    if (uploadedFiles.length === 0) {
      uploadStatus = 'idle';
      errorMessages = [];
      previousSpendingError = null;
      previousSpendingTouched = false;
      bank = '';
      previousSpending = '';
      detectedBankId = null;
      if (primaryFileInputEl) primaryFileInputEl.value = '';
      if (addFileInputEl) addFileInputEl.value = '';
    } else {
      detectBankFromFile();
    }
    await focusFileAction(index);
  }

  async function clearAllFiles() {
    beginAdmittedFileMutation();
    uploadedFiles = [];
    uploadStatus = 'idle';
    errorMessages = [];
    previousSpendingError = null;
    previousSpendingTouched = false;
    bank = '';
    previousSpending = '';
    detectedBankId = null;
    if (primaryFileInputEl) primaryFileInputEl.value = '';
    if (addFileInputEl) addFileInputEl.value = '';
    await tick();
    primaryFileInputEl?.focus();
  }

  async function handleFileInput(e: Event) {
    const target = e.target as HTMLInputElement;
    const selectedFiles = target.files ? Array.from(target.files) : [];
    let hasErrors = false;
    if (selectedFiles.length > 0) {
      hasErrors = addFiles(selectedFiles);
    }
    // Reset input so same file can be re-added after removal
    target.value = '';
    if (hasErrors) {
      await focusRetryAction();
    } else if (selectedFiles.length > 0) {
      await focusFileAction(Math.max(0, uploadedFiles.length - 1));
    }
  }

  async function handleUpload(event?: SubmitEvent) {
    event?.preventDefault();
    if (uploadedFiles.length === 0) return;
    previousSpendingTouched = true;
    const previousSpendingValidation = validatePreviousSpending(previousSpending);
    if (!previousSpendingValidation.valid) {
      previousSpendingError = previousSpendingValidation.message;
      queueMicrotask(() => previousSpendingInputEl?.focus());
      return;
    }
    previousSpendingError = null;
    const files = [...uploadedFiles];
    const run = analysisRuns.begin();
    analysisProgress = { completed: 0, total: files.length };
    uploadStatus = 'uploading';
    errorMessages = [];
    isBlockingNavigation = true;

    try {
      await analysisStore.analyze(
        files,
        {
          bank: bank || undefined,
          previousMonthSpending: previousSpendingValidation.value,
        },
        {
          run,
          onProgress: (progress) => {
            run.commit(() => {
              analysisProgress = progress;
            });
          },
        },
      );
      if (!run.isCurrent()) return;

      // analysisStore.analyze() catches errors internally (sets error, result=null)
      // without re-throwing, so we must check analysisStore.error here.
      if (analysisStore.error) {
        errorMessages = [analysisStore.error];
        uploadStatus = 'error';
        await tick();
        retryButtonEl?.focus();
      } else {
        uploadStatus = 'success';
        await tick();
        dashboardButtonEl?.focus();
      }
    } catch (e) {
      if (!run.isCurrent()) return;
      errorMessages = [e instanceof Error ? e.message : '분석 실패'];
      uploadStatus = 'error';
      await tick();
      retryButtonEl?.focus();
    } finally {
      // Clear the navigation block once analysis settles. Success now waits
      // for the explicit dashboard action instead of auto-navigating.
      if (run.isCurrent()) {
        isBlockingNavigation = false;
      }
    }
  }

  function handlePreviousSpendingInvalid(event: Event) {
    event.preventDefault();
    previousSpendingTouched = true;
    const validation = validatePreviousSpending(previousSpending);
    previousSpendingError = validation.valid
      ? '전월 카드 이용액을 원 단위 정수로 입력해 주세요.'
      : validation.message;
    queueMicrotask(() => previousSpendingInputEl?.focus());
  }

  function updatePreviousSpendingError(): void {
    const validation = validatePreviousSpending(previousSpending);
    previousSpendingError = validation.valid ? null : validation.message;
  }

  function handlePreviousSpendingInput(): void {
    if (previousSpendingTouched || previousSpendingError !== null) {
      updatePreviousSpendingError();
    }
  }

  function handlePreviousSpendingBlur(): void {
    previousSpendingTouched = true;
    updatePreviousSpendingError();
  }

  async function revealAllBanks(): Promise<void> {
    showAllBanks = true;
    await tick();
    const firstAdditionalBank = ALL_BANKS[TOP_BANKS.length];
    if (!firstAdditionalBank) return;
    uploadRootEl
      ?.querySelector<HTMLButtonElement>(
        `[data-testid="bank-pill-${firstAdditionalBank.value}"]`,
      )
      ?.focus();
  }

  async function handleRetry() {
    invalidateAnalysisOwnership();
    uploadStatus = 'idle';
    errorMessages = [];
    await tick();
    if (uploadedFiles.length > 0) {
      submitButtonEl?.focus();
    } else {
      primaryFileInputEl?.focus();
    }
  }

  async function openDashboard(): Promise<void> {
    const dashboardUrl = buildPageUrl('dashboard');
    try {
      const { navigate } = await import('astro:transitions/client');
      await navigate(dashboardUrl);
    } catch {
      if (typeof console !== 'undefined') {
        console.debug(
          '[cherrypicker] Astro View Transitions not available, falling back to full page reload',
        );
      }
      window.location.href = dashboardUrl;
    }
  }
</script>

<div
  class="flex flex-col gap-5"
  aria-busy={uploadStatus === 'uploading'}
  bind:this={uploadRootEl}
>
  <p
    class="sr-only"
    role="status"
    aria-live="polite"
    aria-atomic="true"
    data-testid="upload-status"
  >
    {uploadStatusMessage}
  </p>

  <!-- Step indicator — a stepper is an ordered list with aria-current="step"
       on the active item per WAI-ARIA APG; role="progressbar" was incorrect
       because screen readers read it as a single 1-of-4 percentage and never
       announce the step labels (C6UI-02). -->
  <ol class="flex items-center justify-center gap-0 list-none p-0 m-0" aria-label="업로드 단계" data-testid="step-indicator">
    {#each STEPS as step, i}
      {@const stepNum = i + 1}
      {@const isActive = currentStep === stepNum}
      {@const isDone = currentStep > stepNum}
      <li class="flex items-center" aria-current={isActive ? 'step' : undefined} data-testid={`step-${stepNum}`}>
        <div class="flex flex-col items-center gap-1">
          <div
            class="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all duration-300
              {isDone
                ? 'bg-green-500 text-white'
                : isActive
                  ? 'bg-[var(--color-primary-fill)] text-white shadow-md'
                  : 'bg-[var(--color-border)] text-[var(--color-text)]'}"
            data-testid={`step-number-${stepNum}`}
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
              {isActive ? 'font-semibold text-[var(--color-primary-fg)]' : isDone ? 'text-green-700 dark:text-green-300' : 'text-[var(--color-text-muted)]'}"
          >
            {step}
          </span>
        </div>
        {#if i < STEPS.length - 1}
          <div
            class="mb-4 h-0.5 w-8 transition-colors duration-300 sm:w-12
              {currentStep > stepNum ? 'bg-green-400' : 'bg-[var(--color-border)]'}"
            aria-hidden="true"
          ></div>
        {/if}
      </li>
    {/each}
  </ol>

  <!-- Drag status live region for screen readers -->
  <div aria-live="polite" aria-atomic="true" class="sr-only">
    {#if isDragOver}파일을 놓으세요{/if}
  </div>

  <!-- Drop zone. The file input remains the sole keyboard interaction target;
       the surrounding region only communicates page-wide drag-and-drop state. -->
  <div
    class="rounded-2xl border-2 p-6 text-center transition-all duration-200
      {isDragOver
        ? 'animate-pulse border-[var(--color-primary-fg)] bg-[var(--color-primary-light)] shadow-inner'
        : uploadedFiles.length > 0
          ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
          : 'border-dashed border-[var(--color-border)] hover:border-[var(--color-primary-fg)]'}"
    role="region"
    aria-label="카드 명세서 업로드"
    ondragover={(e) => { e.preventDefault(); isDragOver = true; }}
    ondragleave={() => (isDragOver = false)}
  >
    {#if uploadStatus === 'success'}
      <!-- Success state with checkmark -->
      <div class="flex flex-col items-center gap-3">
        <div class="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 animate-bounce">
          <svg class="h-8 w-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p class="text-base font-semibold text-green-700 dark:text-green-300">
          {analysisStore.result?.parseErrors.length ? '분석 완료 — 확인할 항목 있음' : '분석 완료'}
        </p>
        <!-- text-green-700 on white is 5.09:1 (passes WCAG AA 4.5:1);
             text-green-600 was 3.77:1 (fails) — C6UI-31. -->
        <p class="text-sm text-green-700 dark:text-green-300">결과를 확인할 준비가 됐어요</p>
        <button
          type="button"
          class="mt-1 rounded-xl bg-[var(--color-primary-fill)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-primary-fill-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] focus:ring-offset-2"
          onclick={openDashboard}
          bind:this={dashboardButtonEl}
        >
          대시보드 보기
        </button>
      </div>
    {:else if uploadedFiles.length > 0}
      <!-- File list -->
      <div class="flex flex-col gap-2">
        {#each uploadedFiles as file, i}
          <div class="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-left">
            <div class="shrink-0 text-[var(--color-text-muted)]">
              <Icon name={fileIconName(file)} size={20} />
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-[var(--color-text)]">{file.name}</p>
              <p class="text-xs text-[var(--color-text-muted)]">{formatFileSize(file.size)}</p>
            </div>
            <button
              type="button"
              class="shrink-0 rounded-lg p-1 text-[var(--color-text-muted)] hover:bg-red-50 hover:text-red-500 transition-colors"
              onclick={() => removeFile(i)}
              aria-label={`${file.name} 제거`}
              data-upload-file-remove
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        {/each}
        <!-- Add / clear buttons -->
        <div class="mt-1 flex items-center gap-2">
          <label class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-primary-fg)] hover:text-[var(--color-primary-fg)] focus-within:outline-none focus-within:ring-2 focus-within:ring-[var(--color-focus)]">
            <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            파일 추가
            <input type="file" class="sr-only" accept={STATEMENT_FILE_ACCEPT} multiple onchange={handleFileInput} bind:this={addFileInputEl} />
          </label>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)] hover:border-red-300 hover:text-red-500 transition-colors"
            onclick={clearAllFiles}
          >
            전체 삭제
          </button>
        </div>
      </div>
    {:else}
      <div class="flex flex-col items-center gap-2">
        <div class="text-[var(--color-text-muted)]">
          <Icon name={isDragOver ? 'folder-open' : 'arrow-up-tray'} size={40} />
        </div>
        <p id="dropzone-title" class="mt-1 text-base font-medium">카드 명세서를 끌어다 놓으세요</p>
        <p class="text-sm text-[var(--color-text-muted)]">{SUPPORTED_STATEMENT_FORMAT_LABELS} 지원 · 여러 파일 동시 업로드 가능</p>
        <label class="mt-3 inline-block cursor-pointer rounded-xl bg-[var(--color-primary-fill)] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[var(--color-primary-fill-hover)] focus-within:outline-none focus-within:ring-2 focus-within:ring-[var(--color-focus)] focus-within:ring-offset-2">
          파일 선택
          <input type="file" class="sr-only" accept={STATEMENT_FILE_ACCEPT} multiple onchange={handleFileInput} bind:this={primaryFileInputEl} />
        </label>
      </div>
    {/if}
  </div>

  <!-- Bank selector + Upload (shown after file selected, before success) -->
  {#if uploadedFiles.length > 0 && uploadStatus !== 'success'}
    <form class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-4" onsubmit={handleUpload}>
      <fieldset
        class="space-y-4 disabled:cursor-wait disabled:opacity-70"
        disabled={uploadStatus === 'uploading'}
        aria-busy={uploadStatus === 'uploading'}
        data-testid="analysis-options"
      >
        <legend class="sr-only">분석 설정</legend>
      <div>
        <p class="mb-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">카드사를 고르면 더 정확해요</p>
        <div class="flex flex-wrap gap-2" role="group" aria-label="카드사 선택">
          <!-- Auto-detect pill -->
          <button
            type="button"
            class="rounded-full border px-3 py-1.5 text-xs font-medium transition-all
              {bank === ''
                ? 'border-[var(--color-primary-fill)] bg-[var(--color-primary-fill)] text-white shadow-sm'
                : 'border-[var(--color-border)] bg-transparent text-[var(--color-text-muted)] hover:border-gray-400'}"
            aria-pressed={bank === ''}
            data-testid="bank-pill-auto"
            onclick={() => (bank = '')}
          >
            자동 인식
          </button>
          {#if detectedBankId && bank === ''}
            <span class="inline-flex items-center gap-1 rounded-full bg-green-50 dark:bg-green-900/20 px-2.5 py-1 text-xs font-medium text-green-700 dark:text-green-400" data-testid="detected-bank-hint">
              <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
              {detectedBankLabel()} 인식됨
            </span>
          {/if}
          {#each displayedBanks as b}
            <button
              type="button"
              class="rounded-full border px-3 py-1.5 text-xs font-medium transition-all
                {bank === b.value
                  ? 'border-[var(--color-primary-fill)] bg-[var(--color-primary-fill)] text-white shadow-sm'
                  : 'border-[var(--color-border)] bg-transparent text-[var(--color-text-muted)] hover:border-gray-400'}"
              aria-pressed={bank === b.value}
              data-testid={`bank-pill-${b.value}`}
              onclick={() => (bank = b.value)}
            >
              {b.label}
            </button>
          {/each}
          {#if !showAllBanks && ALL_BANKS.length > TOP_BANKS.length}
            <button
              type="button"
              class="rounded-full border border-dashed border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)] hover:border-[var(--color-focus)] hover:text-[var(--color-primary-fg)] transition-all"
              onclick={revealAllBanks}
            >
              더보기 ({ALL_BANKS.length - TOP_BANKS.length})
            </button>
          {/if}
        </div>
      </div>

      <!-- Previous month spending input -->
      <div>
        <label for="previous-spending" class="mb-2.5 block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">전월 카드 이용액</label>
        <div class="relative">
          <input
            id="previous-spending"
            type="number"
            inputmode="numeric"
            bind:value={previousSpending}
            bind:this={previousSpendingInputEl}
            oninput={handlePreviousSpendingInput}
            onblur={handlePreviousSpendingBlur}
            oninvalid={handlePreviousSpendingInvalid}
            placeholder="500000"
            min="0"
            max={MAX_PREVIOUS_SPENDING_KRW}
            step="1"
            aria-invalid={previousSpendingError ? 'true' : undefined}
            aria-describedby={previousSpendingError ? 'previous-spending-error previous-spending-help' : 'previous-spending-help'}
            data-testid="previous-spending-input"
            class="w-full rounded-xl border bg-[var(--color-surface)] px-4 py-2 pr-9 text-sm outline-none transition-all focus:ring-2 focus:ring-[var(--color-focus)]
              {previousSpendingError ? 'border-red-500' : 'border-[var(--color-border)] focus:border-[var(--color-focus)]'}"
          />
          <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-text-muted)]">원</span>
        </div>
        {#if previousSpendingError}
          <p id="previous-spending-error" class="mt-1 text-xs text-red-700 dark:text-red-300" role="alert">
            {previousSpendingError}
          </p>
        {/if}
        {#if uploadedFiles.length >= 2}
          <p id="previous-spending-help" class="mt-1 text-xs text-[var(--color-text-muted)]">정확한 전월 명세서가 있으면 자동으로 사용해요. 직접 입력하면 덮어써요.</p>
        {:else}
          <p id="previous-spending-help" class="mt-1 text-xs text-[var(--color-text-muted)]">입력하지 않고 정확한 전월 명세서도 없으면 전월실적을 0원으로 가정해요.</p>
        {/if}
      </div>
      </fieldset>

      <!-- Upload button -->
      <button
        type="submit"
        disabled={uploadStatus === 'uploading'}
        aria-busy={uploadStatus === 'uploading'}
        bind:this={submitButtonEl}
        class="w-full rounded-xl py-3 text-sm font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-60
          {uploadStatus === 'uploading'
            ? 'bg-[var(--color-primary-fill)]/80'
            : 'bg-[var(--color-primary-fill)] hover:bg-[var(--color-primary-fill-hover)] shadow-sm hover:shadow-md'}"
      >
        {#if uploadStatus === 'uploading'}
          <span class="flex items-center justify-center gap-2">
            <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            분석하는 중 ({analysisProgress.completed}/{analysisProgress.total})
          </span>
        {:else}
          분석 시작 {uploadedFiles.length > 1 ? `(${uploadedFiles.length}개 파일)` : ''}
        {/if}
      </button>

    </form>
  {/if}


  <!-- Error state -->
  {#if uploadStatus === 'error'}
    <div role="alert" data-testid="upload-error-banner" class="flex items-start gap-3 rounded-xl bg-red-50 dark:bg-red-950 p-4 text-sm text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">
      <svg class="mt-0.5 h-5 w-5 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
      <div class="flex-1">
        <p class="font-medium">문제가 생겼어요</p>
        <ul class="mt-1 list-disc list-inside space-y-0.5 text-red-700 dark:text-red-300">
          {#each errorMessages as msg}
            <li>{msg}</li>
          {/each}
        </ul>
      </div>
      <button
        class="shrink-0 rounded-lg border border-red-300 bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-950 dark:hover:text-red-200 transition-colors"
        onclick={handleRetry}
        bind:this={retryButtonEl}
      >
        다시 시도
      </button>
    </div>
  {/if}
</div>
