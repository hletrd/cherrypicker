export interface NavigationTimerScheduler {
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

const browserTimerScheduler: NavigationTimerScheduler = {
  setTimeout(callback, delayMs) {
    return globalThis.setTimeout(callback, delayMs);
  },
  clearTimeout(handle) {
    globalThis.clearTimeout(
      handle as ReturnType<typeof globalThis.setTimeout>,
    );
  },
};

/**
 * Owns one delayed navigation. Every schedule or cancel invalidates the prior
 * owner, and async callbacks can recheck that owner after their own awaits.
 */
export class PendingNavigation {
  readonly #scheduler: NavigationTimerScheduler;
  #generation = 0;
  #timeout: unknown = null;

  constructor(scheduler: NavigationTimerScheduler = browserTimerScheduler) {
    this.#scheduler = scheduler;
  }

  schedule(
    callback: (owner: number) => void | Promise<void>,
    delayMs: number,
  ): number {
    this.cancel();
    const owner = ++this.#generation;
    this.#timeout = this.#scheduler.setTimeout(() => {
      this.#timeout = null;
      if (!this.isCurrent(owner)) return;
      void callback(owner);
    }, delayMs);
    return owner;
  }

  cancel(): void {
    if (this.#timeout !== null) {
      this.#scheduler.clearTimeout(this.#timeout);
      this.#timeout = null;
    }
    this.#generation++;
  }

  isCurrent(owner: number): boolean {
    return this.#generation === owner;
  }
}
