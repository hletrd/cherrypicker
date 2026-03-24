<script lang="ts">
  import { analysisStore } from '../../lib/store.svelte.js';

  let isDragOver = $state(false);
  let uploadedFile = $state<File | null>(null);
  let uploadStatus = $state<'idle' | 'uploading' | 'success' | 'error'>('idle');
  let errorMessage = $state('');
  let bank = $state('');

  const ACCEPTED_TYPES = [
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/pdf',
  ];
  const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx', '.xls', '.pdf'];

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
    } else {
      errorMessage = 'CSV, Excel, PDF 파일만 지원합니다';
      uploadStatus = 'error';
    }
  }

  function handleFileInput(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      uploadedFile = file;
      uploadStatus = 'idle';
    }
  }

  async function handleUpload() {
    if (!uploadedFile) return;
    uploadStatus = 'uploading';

    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);

      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json() as { filePath?: string; error?: string };

      if (!res.ok) throw new Error(data.error ?? '업로드 실패');

      const analyzeRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: data.filePath,
          bank: bank || undefined,
        }),
      });

      const analyzeData = await analyzeRes.json();

      if (!analyzeRes.ok) {
        throw new Error((analyzeData as { error?: string }).error ?? '분석 실패');
      }

      // Store the result in the shared store
      analysisStore.setResult(analyzeData);

      uploadStatus = 'success';

      // Redirect to dashboard
      window.location.href = '/dashboard';
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : '업로드 실패';
      uploadStatus = 'error';
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
</script>

<div class="flex flex-col gap-4">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="rounded-xl border-2 border-dashed p-12 text-center transition-colors
      {isDragOver ? 'border-[var(--color-primary)] bg-blue-50' : 'border-[var(--color-border)]'}
      {uploadedFile ? 'bg-green-50 border-green-300' : ''}"
    ondragover={(e) => { e.preventDefault(); isDragOver = true; }}
    ondragleave={() => (isDragOver = false)}
    ondrop={handleDrop}
  >
    {#if uploadedFile}
      <div class="text-lg font-medium">{uploadedFile.name}</div>
      <div class="mt-1 text-sm text-[var(--color-text-muted)]">
        {formatFileSize(uploadedFile.size)}
      </div>
      <button
        class="mt-3 text-sm text-[var(--color-primary)] hover:underline"
        onclick={() => { uploadedFile = null; uploadStatus = 'idle'; }}
      >
        다른 파일 선택
      </button>
    {:else}
      <div class="text-4xl">📄</div>
      <p class="mt-3 text-lg">카드 명세서를 끌어다 놓으세요</p>
      <p class="mt-1 text-sm text-[var(--color-text-muted)]">CSV, Excel, PDF 지원</p>
      <label class="mt-4 inline-block cursor-pointer rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm text-white hover:bg-[var(--color-primary-dark)]">
        파일 선택
        <input type="file" class="hidden" accept=".csv,.xlsx,.xls,.pdf" onchange={handleFileInput} />
      </label>
    {/if}
  </div>

  {#if uploadedFile}
    <div class="flex items-center gap-4">
      <select
        bind:value={bank}
        class="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
      >
        <option value="">카드사 자동 인식</option>
        <option value="hyundai">현대카드</option>
        <option value="kb">KB국민카드</option>
        <option value="samsung">삼성카드</option>
        <option value="shinhan">신한카드</option>
        <option value="lotte">롯데카드</option>
        <option value="hana">하나카드</option>
        <option value="woori">우리카드</option>
        <option value="ibk">IBK기업은행</option>
        <option value="nh">NH농협카드</option>
        <option value="bc">BC카드</option>
      </select>

      <button
        onclick={handleUpload}
        disabled={uploadStatus === 'uploading'}
        class="flex-1 rounded-lg bg-[var(--color-primary)] px-6 py-2 text-white hover:bg-[var(--color-primary-dark)] disabled:opacity-50"
      >
        {#if uploadStatus === 'uploading'}
          분석 중...
        {:else}
          분석 시작
        {/if}
      </button>
    </div>
  {/if}

  {#if uploadStatus === 'error'}
    <div class="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errorMessage}</div>
  {/if}

  {#if uploadStatus === 'success'}
    <div class="rounded-lg bg-green-50 p-3 text-sm text-green-700">
      분석이 완료되었습니다! 대시보드로 이동합니다...
    </div>
  {/if}
</div>
