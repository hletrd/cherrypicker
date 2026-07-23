export const FILE_PARSE_CONCURRENCY = 2;

export interface FileParseProgress {
  completed: number;
  total: number;
}

export type FileParseOutcome<T> =
  | { status: 'fulfilled'; value: T }
  | { status: 'rejected'; reason: unknown }
  | { status: 'cancelled' };

export interface FileParseRun {
  readonly generation: number;
  readonly signal: AbortSignal;
  isCurrent(): boolean;
  commit(effect: () => void): boolean;
}

export class LatestFileParseRun {
  #generation = 0;
  #controller: AbortController | null = null;

  begin(): FileParseRun {
    this.#controller?.abort();

    const generation = ++this.#generation;
    const controller = new AbortController();
    this.#controller = controller;
    const isCurrent = () =>
      this.#generation === generation &&
      this.#controller === controller &&
      !controller.signal.aborted;

    return Object.freeze({
      generation,
      signal: controller.signal,
      isCurrent,
      commit(effect: () => void): boolean {
        if (!isCurrent()) return false;
        effect();
        return true;
      },
    });
  }

  cancel(): void {
    this.#controller?.abort();
    this.#controller = null;
    this.#generation++;
  }
}

export interface FileParseQueueOptions<T> {
  run: FileParseRun;
  onProgress?: (progress: FileParseProgress) => void;
  release?: (item: T, index: number) => void | Promise<void>;
  yieldControl?: () => Promise<void>;
}

export interface FileParseQueueResult<T> {
  outcomes: FileParseOutcome<T>[];
  completed: number;
  cancelled: boolean;
  stale: boolean;
}

export async function yieldToBrowser(): Promise<void> {
  const scheduler = (
    globalThis as typeof globalThis & {
      scheduler?: { yield?: () => Promise<void> };
    }
  ).scheduler;
  if (typeof scheduler?.yield === 'function') {
    await scheduler.yield();
    return;
  }

  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

/**
 * Run file parsing with a fixed two-file cap.
 *
 * Workers should keep buffers, workbooks, and other format-specific objects
 * local and return only the normalized value needed for aggregation. Once a
 * worker settles, its release hook and an event-loop yield both finish before
 * that lane dequeues another file.
 */
export async function runFileParseQueue<T, R>(
  items: readonly T[],
  worker: (item: T, index: number, signal: AbortSignal) => Promise<R>,
  options: FileParseQueueOptions<T>,
): Promise<FileParseQueueResult<R>> {
  const { run } = options;
  const yieldControl = options.yieldControl ?? yieldToBrowser;
  const outcomes: Array<FileParseOutcome<R> | undefined> = new Array(
    items.length,
  );
  let nextIndex = 0;
  let completed = 0;

  const reportProgress = () => {
    if (run.isCurrent()) {
      options.onProgress?.({ completed, total: items.length });
    }
  };
  reportProgress();

  async function runLane(): Promise<void> {
    while (run.isCurrent()) {
      const index = nextIndex;
      if (index >= items.length) return;
      nextIndex++;

      const item = items[index]!;
      let outcome: FileParseOutcome<R>;
      try {
        outcome = {
          status: 'fulfilled',
          value: await worker(item, index, run.signal),
        };
      } catch (reason) {
        outcome = { status: 'rejected', reason };
      }

      try {
        await options.release?.(item, index);
      } catch (reason) {
        outcome = { status: 'rejected', reason };
      }

      outcomes[index] = outcome;
      completed++;
      reportProgress();
      await yieldControl();
    }
  }

  const laneCount = Math.min(FILE_PARSE_CONCURRENCY, items.length);
  await Promise.all(Array.from({ length: laneCount }, () => runLane()));

  for (let index = 0; index < outcomes.length; index++) {
    outcomes[index] ??= { status: 'cancelled' };
  }

  return {
    outcomes: outcomes as FileParseOutcome<R>[],
    completed,
    cancelled: run.signal.aborted,
    stale: !run.isCurrent(),
  };
}
