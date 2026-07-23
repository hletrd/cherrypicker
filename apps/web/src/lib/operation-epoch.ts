export interface OperationToken {
  readonly epoch: number;
  readonly signal: AbortSignal;
  isCurrent(): boolean;
}

/**
 * Owns all asynchronous mutations for one store. Starting or invalidating an
 * operation immediately makes every older token stale.
 */
export class OperationEpoch {
  #epoch = 0;
  #controller: AbortController | null = null;

  begin(): OperationToken {
    this.#controller?.abort();

    const epoch = ++this.#epoch;
    const controller = new AbortController();
    this.#controller = controller;
    return Object.freeze({
      epoch,
      signal: controller.signal,
      isCurrent: () =>
        this.#epoch === epoch &&
        this.#controller === controller &&
        !controller.signal.aborted,
    });
  }

  invalidate(): void {
    this.#controller?.abort();
    this.#controller = null;
    this.#epoch++;
  }
}
