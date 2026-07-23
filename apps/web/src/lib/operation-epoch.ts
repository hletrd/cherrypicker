export interface OperationToken {
  readonly epoch: number;
  isCurrent(): boolean;
}

/**
 * Owns all asynchronous mutations for one store. Starting or invalidating an
 * operation immediately makes every older token stale.
 */
export class OperationEpoch {
  #epoch = 0;

  begin(): OperationToken {
    const epoch = ++this.#epoch;
    return Object.freeze({
      epoch,
      isCurrent: () => this.#epoch === epoch,
    });
  }

  invalidate(): void {
    this.#epoch++;
  }
}
