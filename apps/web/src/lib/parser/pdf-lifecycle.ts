interface PDFTextItem {
  str: string;
  transform: unknown;
}

interface PDFPageLike {
  getTextContent(): Promise<{ items: unknown[] }>;
}

export interface PDFDocumentLike {
  numPages: number;
  getPage(pageNumber: number): Promise<PDFPageLike>;
  cleanup(): void | Promise<void>;
  destroy(): void | Promise<void>;
}

export interface PDFLoadingTaskLike {
  promise: Promise<PDFDocumentLike>;
  destroy(): void | Promise<void>;
}

function abortError(): DOMException {
  return new DOMException('PDF 분석이 취소되었어요.', 'AbortError');
}

function abortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

export async function extractPDFTextFromLoadingTask(
  loadingTask: PDFLoadingTaskLike,
  signal?: AbortSignal,
): Promise<string> {
  let document: PDFDocumentLike | undefined;
  let loadingTaskDestroyPromise: Promise<void> | undefined;
  const destroyLoadingTask = (): Promise<void> => {
    loadingTaskDestroyPromise ??= (async () => {
      await loadingTask.destroy();
    })();
    return loadingTaskDestroyPromise;
  };
  const onAbort = () => {
    void destroyLoadingTask().catch(() => {});
  };
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    document = await abortable(loadingTask.promise, signal);
    let fullText = '';

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      if (signal?.aborted) throw abortError();
      const page = await abortable(document.getPage(pageNumber), signal);
      const content = await abortable(page.getTextContent(), signal);
      let lastY = -1;
      let lastEndX = -1;
      let pageText = '';

      for (const candidate of content.items) {
        if (signal?.aborted) throw abortError();
        if (
          !candidate ||
          typeof candidate !== 'object' ||
          !('str' in candidate) ||
          !('transform' in candidate)
        ) {
          continue;
        }
        const item = candidate as PDFTextItem;
        const transform = item.transform;
        if (!Array.isArray(transform) || transform.length < 6) continue;

        const y = transform[5] ?? 0;
        if (lastY !== -1 && Math.abs(y - lastY) > 5) {
          pageText += '\n';
          lastEndX = -1;
        } else if (lastEndX !== -1 && item.str.length > 0) {
          pageText += ' ';
        }

        pageText += item.str;
        lastY = y;
        lastEndX = (transform[4] ?? 0) + item.str.length * 6;
      }

      fullText += `${pageText}\n`;
    }

    return fullText;
  } finally {
    signal?.removeEventListener('abort', onAbort);
    const disposeDocument = async () => {
      if (!document) return;
      try {
        await document.cleanup();
      } finally {
        await document.destroy();
      }
    };
    await Promise.allSettled([disposeDocument(), destroyLoadingTask()]);
  }
}
