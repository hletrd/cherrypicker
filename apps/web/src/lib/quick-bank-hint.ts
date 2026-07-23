import { OperationEpoch } from './operation-epoch.js';

/**
 * Owns one asynchronous hint derived from the current first item. A result can
 * commit only while both its operation token and first-item identity remain
 * current.
 */
export class LatestFirstItemHint<Item extends object, Result> {
  readonly #operations = new OperationEpoch();

  invalidate(): void {
    this.#operations.invalidate();
  }

  async detect(
    item: Item,
    read: () => Promise<Result>,
    currentFirst: () => Item | undefined,
    commit: (result: Result | null) => void,
  ): Promise<void> {
    const operation = this.#operations.begin();
    let result: Result;
    try {
      result = await read();
    } catch {
      if (operation.isCurrent() && currentFirst() === item) {
        commit(null);
      }
      return;
    }
    if (operation.isCurrent() && currentFirst() === item) {
      commit(result);
    }
  }
}
